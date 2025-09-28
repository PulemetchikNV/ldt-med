import os
import sys
import json
import logging
from pathlib import Path
import torch
import time
from torch.cuda.amp import autocast
import numpy as np
import pydicom
import SimpleITK as sitk
from collections import defaultdict
import zipfile
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed

from monai.config import print_config
from monai.inferers import sliding_window_inference
from monai.networks.nets import SegResNet
from monai.transforms import Compose, EnsureType
from monai.transforms.intensity.array import HistogramNormalize

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')


class ChannelWiseHistogramNormalize:
    def __init__(self, num_bins: int = 256):
        self.normalizer = HistogramNormalize(num_bins=num_bins)

    def __call__(self, img_tensor: torch.Tensor) -> torch.Tensor:
        normalized_channels = [self.normalizer(channel.unsqueeze(0)) for channel in img_tensor]
        return torch.cat(normalized_channels, dim=0)


class DicomMeningiomaLoader:
    def __init__(self, modality_map: dict, imputation_strategy: dict, reference_modality_preference: list):
        self.modality_map = modality_map
        self.imputation_strategy = imputation_strategy
        self.reference_modality_preference = reference_modality_preference

    def _scan_directory(self, dicom_root: Path) -> dict:
        series = defaultdict(list)
        for root, _, files in os.walk(dicom_root):
            for file in files:
                filepath = Path(root) / file
                try:
                    ds = pydicom.dcmread(filepath, stop_before_pixels=True, force=True)
                    if "SeriesInstanceUID" in ds: series[ds.SeriesInstanceUID].append(filepath)
                except pydicom.errors.InvalidDicomError:
                    continue
        return series

    def _identify_modality(self, series_files: list) -> str | None:
        ds = pydicom.dcmread(series_files[0], stop_before_pixels=True, force=True)
        
        # Список тегов для проверки в порядке приоритета
        tags_to_check = ["SeriesDescription", "ProtocolName", "ImageType"]
        
        for tag in tags_to_check:
            tag_value = ds.get(tag, "")
            
            # ImageType может быть списком, объединим его в строку
            if isinstance(tag_value, pydicom.multival.MultiValue):
                tag_value = " ".join(tag_value)
                
            tag_value = tag_value.lower().strip()

            if not tag_value:
                continue

            best_match, max_len = None, -1
            for modality_name, keywords in self.modality_map.items():
                for keyword in keywords:
                    if keyword in tag_value and len(keyword) > max_len:
                        max_len, best_match = len(keyword), modality_name
            
            if best_match:
                return best_match  # Возвращаем первое найденное совпадение

        return None # Если ничего не найдено во всех тегах

    def _resample_image_to_reference(self, image: sitk.Image, ref_image: sitk.Image) -> sitk.Image:
        resampler = sitk.ResampleImageFilter()
        resampler.SetReferenceImage(ref_image)
        resampler.SetInterpolator(sitk.sitkLinear)
        resampler.SetDefaultPixelValue(0)
        return resampler.Execute(image)

    def _sort_series_files(self, series_files: list) -> list:
        """Ensure a deterministic slice order for a DICOM series.

        Some scanners store slices with non-monotonic ImagePositionPatient values
        (e.g. multi-slab acquisitions).  SimpleITK's ImageSeriesReader sorts
        primarily by physical position and may therefore interleave slabs,
        producing pronounced striping artifacts after resampling.  When the
        InstanceNumber tag is present it encodes the intended slice order, so we
        prefer it.  As a fallback we sort by the projection of
        ImagePositionPatient onto the slice normal; if neither tag is available
        we keep the original order.
        """

        ordered: list[tuple[int, float, Path]] = []
        normal_vec = None

        for path in series_files:
            try:
                ds = pydicom.dcmread(str(path), stop_before_pixels=True, force=True)
            except Exception:
                continue

            instance_number = getattr(ds, "InstanceNumber", None)
            if instance_number is not None:
                ordered.append((0, float(instance_number), path))
                continue

            ipp = ds.get("ImagePositionPatient")
            iop = ds.get("ImageOrientationPatient")
            if ipp is not None and iop is not None:
                if normal_vec is None:
                    # Compute slice normal once we have orientation information.
                    row = np.array(iop[:3], dtype=float)
                    col = np.array(iop[3:], dtype=float)
                    cross = np.cross(row, col)
                    if np.linalg.norm(cross) > 0:
                        normal_vec = cross
                if normal_vec is not None:
                    position = float(np.dot(normal_vec, np.array(ipp, dtype=float)))
                    ordered.append((1, position, path))
                    continue

            # Fallback – retain original ordering.
            ordered.append((2, float(len(ordered)), path))

        ordered.sort(key=lambda item: (item[0], item[1]))
        return [entry[2] for entry in ordered]

    def _process_series(self, series_files: list) -> tuple[str | None, sitk.Image | None]:
        """Helper function to process a single DICOM series."""
        modality_name = self._identify_modality(series_files)
        if not modality_name:
            return None, None
        try:
            sorted_files = self._sort_series_files(series_files)
            reader = sitk.ImageSeriesReader()
            reader.SetFileNames([str(f) for f in sorted_files])
            sitk_img = reader.Execute()
            return modality_name, sitk_img
        except Exception as e:
            logging.warning(f"Не удалось загрузить серию '{modality_name}': {e}")
            return modality_name, None

    # --- ИЗМЕНЕНО: Теперь возвращаем и 4D numpy массив ---
    def __call__(self, dicom_root: Path) -> tuple[torch.Tensor | None, np.ndarray | None, sitk.Image | None]:
        series_dict = self._scan_directory(dicom_root)

        logging.info("--- НАЧАЛО ДИАГНОСТИКИ КАРТЫ МОДАЛЬНОСТЕЙ ---")
        # ... (диагностический блок остается без изменений) ...

        found_modalities = defaultdict(list)
        with ThreadPoolExecutor() as executor:
            future_to_series = {executor.submit(self._process_series, files): uid for uid, files in series_dict.items()}
            for future in as_completed(future_to_series):
                try:
                    modality_name, sitk_img = future.result()
                    if modality_name and sitk_img is not None:
                        found_modalities[modality_name].append(sitk_img)
                except Exception as exc:
                    series_uid = future_to_series[future]
                    logging.error(f"Серия {series_uid} сгенерировала исключение: {exc}")

        if not found_modalities:
            logging.error("Не найдено ни одной распознанной DICOM-серии.")
            return None, None, None

        ref_image = None
        # ... (блок выбора эталона остается без изменений) ...
        for mod_pref in self.reference_modality_preference:
            if mod_pref in found_modalities:
                ref_image = max(found_modalities[mod_pref], key=lambda img: img.GetSize()[2])
                logging.info(f"Выбрана эталонная модальность: '{mod_pref}' с размером {ref_image.GetSize()}")
                break

        if ref_image is None:
            logging.error("Не удалось выбрать эталонное изображение. Инференс невозможен.")
            return None, None, None

        # Create isotropic (1x1x1) reference image based on the chosen reference image
        try:
            original_spacing = ref_image.GetSpacing()
            original_size = ref_image.GetSize()
            new_spacing = (1.0, 1.0, 1.0)
            new_size = [
                int(round(original_size[i] * (original_spacing[i] / new_spacing[i])))
                for i in range(3)
            ]
            resampler = sitk.ResampleImageFilter()
            resampler.SetOutputSpacing(new_spacing)
            resampler.SetSize(new_size)
            resampler.SetOutputOrigin(ref_image.GetOrigin())
            resampler.SetOutputDirection(ref_image.GetDirection())
            resampler.SetInterpolator(sitk.sitkLinear)
            resampler.SetDefaultPixelValue(0)
            try:
                resampler.SetOutputPixelType(ref_image.GetPixelID())
            except Exception:
                pass
            isotropic_ref_image = resampler.Execute(ref_image)
            # Use isotropic reference for downstream operations
            ref_image = isotropic_ref_image
        except Exception:
            pass

        final_volume_channels = []
        # ... (блок ресэмплинга и сборки каналов остается без изменений) ...
        for modality in ['t1', 't1c', 't2', 'flair']:
            image_to_process = None
            if modality in found_modalities:
                image_to_process = max(found_modalities[modality], key=lambda img: img.GetSize()[2])
            else:
                substitute_key = self.imputation_strategy.get(modality)
                logging.warning(f"Модальность '{modality}' не найдена. Стратегия: '{substitute_key}'.")
                if substitute_key in found_modalities:
                    image_to_process = max(found_modalities[substitute_key], key=lambda img: img.GetSize()[2])

            if image_to_process:
                resampled_image = self._resample_image_to_reference(image_to_process, ref_image)
                arr = sitk.GetArrayFromImage(resampled_image)
                print("shape of array", arr.shape)
                final_volume_channels.append(arr)
            else:
                logging.warning(f"Не удалось найти замену для '{modality}'. Создаем пустой канал.")
                shape = ref_image.GetSize()[::-1]
                final_volume_channels.append(np.zeros(shape, dtype=np.float32))

        volume_np = np.stack(final_volume_channels, axis=0).astype(np.float32)
        # Возвращаем тензор, numpy-массив и эталон
        return torch.from_numpy(volume_np), volume_np, ref_image


class MeningiomaDicomInference:
    def __init__(self, config: dict):
        self.config = config
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.use_amp = self.device.type == 'cuda'
        self.model = self._load_model()
        modality_map = self._load_json_map(config['modality_map_path'])
        self.dicom_loader = DicomMeningiomaLoader(
            modality_map, config['imputation_strategy'], config['reference_modality_preference']
        )
        self.pre_transforms = Compose([
            ChannelWiseHistogramNormalize(num_bins=256),
            EnsureType(device=self.device)
        ])
        self.config['base_results_dir'].mkdir(parents=True, exist_ok=True)
        logging.info(f"Инференс настроен для устройства: {self.device}. Использование AMP: {self.use_amp}")

    def _load_model(self) -> SegResNet:
        model = SegResNet(**self.config['model_params']).to(self.device)
        model.load_state_dict(torch.load(self.config['model_path'], map_location=self.device))
        model.eval()
        logging.info(f"Модель успешно загружена: {self.config['model_path']}")
        return model

    def _load_json_map(self, map_path: Path) -> dict:
        try:
            with open(map_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logging.error(f"Ошибка загрузки файла карты модальностей {map_path}: {e}")
            sys.exit(1)

    # --- ИЗМЕНЕНО: Метод теперь принимает и 4D numpy-массив ---
    def _save_packaged_results(self, pred_tensor: torch.Tensor, ref_image: sitk.Image, source_4d_np: np.ndarray,
                               patient_id: str):
        patient_dir = self.config['base_results_dir'] / patient_id
        patient_dir.mkdir(parents=True, exist_ok=True)
        logging.info(f"Создана директория для результатов пациента: {patient_dir}")

        try:
            logging.info("Начало сохранения 4D-входа модели...")
            source_4d_image = sitk.GetImageFromArray(np.moveaxis(source_4d_np, 0, -1), isVector=True)
            source_4d_image.CopyInformation(ref_image)
            source_4d_path = patient_dir / "source_4channel.nii.gz"
            sitk.WriteImage(source_4d_image, str(source_4d_path))
            logging.info(f"4D-вход модели сохранен: {source_4d_path}")

            logging.info("Начало сохранения 3D-эталонного изображения...")
            ref_image_path = patient_dir / "source_reference.nii.gz"
            sitk.WriteImage(ref_image, str(ref_image_path))
            logging.info(f"3D-эталонное изображение сохранено: {ref_image_path}")

            logging.info("Начало обработки и сохранения маски сегментации...")
            
            # Убираем размерность пакета (batch)
            logits = pred_tensor.squeeze(0)  # Форма: [3, H, W, D]
            
            # Находим класс с максимальным логитом для каждого пикселя
            prediction_mask = torch.argmax(logits, dim=0)  # Форма: [H, W, D]
            
            # Создаем итоговую маску, добавляя 1 (т.к. argmax возвращает 0, 1, 2)
            final_mask_np = (prediction_mask + 1).cpu().numpy().astype(np.uint8)
            
            # Убираем ложные срабатывания в фоне:
            # оставляем метку класса, только если максимальный логит > 0
            max_logits, _ = torch.max(logits, dim=0)
            final_mask_np[max_logits.cpu().numpy() < 0] = 0

            output_mask = sitk.GetImageFromArray(final_mask_np)
            output_mask.CopyInformation(ref_image)
            mask_path = patient_dir / "segmentation.nii.gz"
            sitk.WriteImage(output_mask, str(mask_path))
            logging.info(f"Маска сегментации сохранена: {mask_path}")
        except Exception as e:
            logging.error(f"Произошла ошибка при сохранении результатов: {e}", exc_info=True)
            raise

    def run(self, zip_path: Path):
        total_start_time = time.time()
        patient_id = zip_path.stem
        logging.info(f"--- НАЧАЛО ИНФЕРЕНСА ДЛЯ ПАЦИЕНТА {patient_id} ---")

        with tempfile.TemporaryDirectory() as temp_dir:
            t0 = time.time()
            logging.info(f"Распаковка архива во временную директорию: {temp_dir}")
            with zipfile.ZipFile(zip_path, 'r') as zip_ref: zip_ref.extractall(temp_dir)
            logging.info(f"Распаковка завершена за {time.time() - t0:.2f} сек.")

            t0 = time.time()
            input_tensor, source_4d_np, ref_image = self.dicom_loader(Path(temp_dir))
            if input_tensor is None: return
            logging.info(f"Загрузка и обработка DICOM завершена за {time.time() - t0:.2f} сек.")

            t0 = time.time()
            input_tensor = self.pre_transforms(input_tensor)
            logging.info(f"Пре-трансформации завершены за {time.time() - t0:.2f} сек.")

            t0 = time.time()
            with torch.no_grad():
                with autocast(enabled=self.use_amp):
                    outputs = sliding_window_inference(
                        inputs=input_tensor.unsqueeze(0), predictor=self.model, **self.config['inference_params']
                    )
            logging.info(f"Инференс (sliding_window_inference) завершен за {time.time() - t0:.2f} сек.")

            t0 = time.time()
            self._save_packaged_results(outputs, ref_image, source_4d_np, patient_id)
            logging.info(f"Сохранение результатов завершено за {time.time() - t0:.2f} сек.")

        logging.info(f"--- ОБЩЕЕ ВРЕМЯ ОБРАБОТКИ для пациента {patient_id}: {time.time() - total_start_time:.2f} сек. ---")


if __name__ == "__main__":
    base_dir = Path(__file__).parent.resolve()
    zip_archive_path = Path(r"C:\Users\stere\OneDrive\Рабочий стол\040104.zip")

    config = {
        'model_path': base_dir / "meningioma_model_brats" / "best_model.pth",
        'base_results_dir': base_dir / "meningioma_inference_results",
        'modality_map_path': base_dir / "modality_map.json",
        'model_params': {
            'blocks_down': [1, 2, 2, 4], 'blocks_up': [1, 1, 1],
            'init_filters': 16, 'in_channels': 4, 'out_channels': 3, 'dropout_prob': 0.2,
        },
        'inference_params': {
            'roi_size': (128, 128, 128), 'sw_batch_size': 4,
            'overlap': 0.5, 'mode': "gaussian", 'sigma_scale': 0.125
        },
        'imputation_strategy': {
            't1c': 't1', 'flair': 't2', 't1': 't2', 't2': 't1'
        },
        'reference_modality_preference': ['t1c', 't1', 't2', 'flair']
    }

    pipeline = MeningiomaDicomInference(config)
    pipeline.run(zip_archive_path)
