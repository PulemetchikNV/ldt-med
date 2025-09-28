import torch
from fastapi import FastAPI, File, UploadFile, Query
from fastapi.middleware.cors import CORSMiddleware
import tempfile
import nibabel as nib
import numpy as np
from PIL import Image
import base64
from io import BytesIO
from typing import Optional, Tuple
from pathlib import Path
import shutil
import uuid
import traceback
from dicom_zip_processor import MeningiomaDicomInference

# Импорты из MONAI для работы с 3D-данными
from monai.networks.nets import SegResNet
from monai.transforms import (
    Compose,
    LoadImaged,
    EnsureChannelFirstd,
    Resized,
    NormalizeIntensityd,
)
from monai.data import NibabelReader

# 1. Определение архитектуры модели (как и раньше)
model = SegResNet(
    blocks_down=[1, 2, 2, 4],
    blocks_up=[1, 1, 1],
    init_filters=16,
    in_channels=4,
    out_channels=3,
    dropout_prob=0.2,
)

# --- Correctly define base directory and model path ---
base_dir = Path(__file__).parent.resolve()
model_path = base_dir / "best_model.pth"

try:
    model.load_state_dict(torch.load(model_path, map_location=torch.device('cpu')))
    print("Model loaded successfully.")
except Exception as e:
    print(f"An error occurred while loading the model: {e}")

model.eval()

# 2. Создание пайплайна трансформаций для 3D-данных
# Этот пайплайн будет применяться к NIfTI файлам
transform = Compose(
    [
        # Загружаем данные из файла
        LoadImaged(keys=["image"], reader=NibabelReader()),
        # Убеждаемся, что канал на первом месте (C, H, W, D)
        EnsureChannelFirstd(keys=["image"]),
        # Изменяем размер до 224x224x224 (пример, можно изменить)
        Resized(keys=["image"], spatial_size=(224, 224, 224)),
        # Нормализуем интенсивность пикселей
        NormalizeIntensityd(keys=["image"], nonzero=True, channel_wise=True),
    ]
)

# 3. Создание FastAPI приложения
app = FastAPI(root_path="/api")

# A simple in-memory cache to store paths to result files
# In a production scenario, a more robust solution like Redis or a DB would be used.
RESULTS_CACHE = {}
STATIC_RESULTS_DIR = Path(__file__).parent / "static_results"
STATIC_RESULTS_DIR.mkdir(exist_ok=True)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4. Эндпоинт для предсказания на 3D-данных (остается для обратной совместимости или других нужд)
@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".nii.gz") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    try:
        data = {"image": tmp_path}
        processed_data = transform(data)
        image_tensor = processed_data["image"].unsqueeze(0)
        if image_tensor.shape[1] == 1:
            image_tensor = image_tensor.repeat(1, 4, 1, 1, 1)
        with torch.no_grad():
            outputs = model(image_tensor)
        has_tumor = torch.sum(torch.sigmoid(outputs) > 0.5) > 0
        prediction_class = "Tumor" if has_tumor else "No Tumor"
        mask = torch.argmax(outputs, dim=1).squeeze(0).cpu().numpy().astype(np.uint8)
        slice_idx = mask.shape[2] // 2
        mask_slice = mask[:, :, slice_idx]
        mask_img = Image.fromarray(mask_slice * 255, 'L')
        buffered_mask = BytesIO()
        mask_img.save(buffered_mask, format="PNG")
        mask_str = base64.b64encode(buffered_mask.getvalue()).decode("utf-8")
        original_slice = image_tensor.squeeze(0).cpu().numpy()[0, :, :, slice_idx]
        original_slice = (original_slice - original_slice.min()) / (original_slice.max() - original_slice.min())
        original_slice_img = Image.fromarray((original_slice * 255).astype(np.uint8), 'L')
        buffered_orig = BytesIO()
        original_slice_img.save(buffered_orig, format="PNG")
        orig_str = base64.b64encode(buffered_orig.getvalue()).decode("utf-8")
        return {"prediction": prediction_class, "mask": mask_str, "original_slice": orig_str}
    except Exception as e:
        return {"error": f"Failed to process NIfTI file: {str(e)}"}

# --- Configuration for ZIP/DICOM processing ---
zip_inference_config = {
    'model_path': model_path,
    'base_results_dir': STATIC_RESULTS_DIR,
    'modality_map_path': base_dir / "modality_map.json",
    'model_params': {
        'blocks_down': [1, 2, 2, 4], 'blocks_up': [1, 1, 1],
        'init_filters': 16, 'in_channels': 4, 'out_channels': 3, 'dropout_prob': 0.2,
    },
    'inference_params': {
        'roi_size': (128, 128, 128), 'sw_batch_size': 4,
        'overlap': 0.6, 'mode': "gaussian", 'sigma_scale': 0.125
    },
    'imputation_strategy': {
        't1c': 't1', 'flair': 't2', 't1': 't2', 't2': 't1'
    },
    'reference_modality_preference': ['t1c', 't1', 't2', 'flair']
}

@app.post("/predict_zip")
async def predict_zip(file: UploadFile = File(...)):
    request_id = str(uuid.uuid4())
    results_dir = STATIC_RESULTS_DIR / request_id
    results_dir.mkdir()
    zip_path = results_dir / file.filename
    with open(zip_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    try:
        config = zip_inference_config.copy()
        config['base_results_dir'] = results_dir
        pipeline = MeningiomaDicomInference(config)
        pipeline.run(zip_path)
        zip_stem = zip_path.stem
        patient_results_path = results_dir / zip_stem
        
        # Encrypt the result files before caching their path
        original_path = patient_results_path / "source_reference.nii.gz"
        mask_path = patient_results_path / "segmentation.nii.gz"
        
        if not original_path.exists() or not mask_path.exists():
            raise FileNotFoundError("Inference did not produce the expected output files.")
            
        RESULTS_CACHE[request_id] = patient_results_path
        
        # We need to read the number of slices from the file
        _, mask_data = _load_volume(patient_results_path, "mask")
        total_slices = mask_data.shape[2]
        has_tumor = np.sum(mask_data) > 0
        prediction_class = "Tumor" if has_tumor else "No Tumor"
        return {
            "prediction": prediction_class,
            "patient_id": request_id,
            "total_slices": total_slices
        }
    except Exception as e:
        tb_str = traceback.format_exc()
        print(f"Error during ZIP processing: {e}\n{tb_str}")
        return {"error": f"Failed to process ZIP file: {str(e)}\n\nTRACEBACK:\n{tb_str}"}

@app.get("/slice/{patient_id}/{volume_type}/{slice_index}")
async def get_slice(patient_id: str, volume_type: str, slice_index: int):
    results_path = _resolve_results_path(patient_id)
    if not results_path:
        return {"error": "Invalid patient ID or results have expired."}
    if volume_type not in {"original", "mask"}:
        return {"error": "Invalid volume type requested."}
    try:
        _, data = _load_volume(results_path, volume_type)
    except FileNotFoundError:
        return {"error": f"{volume_type} data not found."}
    except Exception as e:
        print(f"Error loading volume in get_slice: {e}")
        return {"error": "Failed to load volume."}

    if not (0 <= slice_index < data.shape[2]):
        return {"error": "Slice index out of bounds."}

    slice_data = np.asarray(data[:, :, slice_index])

    try:
        if volume_type == "original":
            if slice_data.max() > slice_data.min():
                slice_data = (slice_data - slice_data.min()) / (slice_data.max() - slice_data.min())
            img = Image.fromarray((slice_data * 255).astype(np.uint8), 'L')
        else:
            rgba_data = np.zeros((slice_data.shape[0], slice_data.shape[1], 4), dtype=np.uint8)
            rgba_data[slice_data == 1] = [255, 0, 0, 255]
            rgba_data[slice_data == 2] = [0, 255, 0, 255]
            rgba_data[slice_data == 3] = [0, 0, 255, 255]
            img = Image.fromarray(rgba_data, 'RGBA')
        buffered = BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        return {"slice_data": img_str}
    except Exception as e:
        print(f"Error getting slice: {e}")
        return {"error": f"Failed to retrieve slice: {str(e)}"}

@app.get("/")
def read_root():
    return {"message": "Backend is running and configured for 3D NIfTI files."}

# --------------------
# New helpers & endpoints for volume meta and orthogonal slices
# --------------------

def _resolve_results_path(patient_id: str) -> Optional[Path]:
    results_path = RESULTS_CACHE.get(patient_id)
    if results_path and results_path.exists():
        return results_path
    patient_dir = STATIC_RESULTS_DIR / patient_id
    if not patient_dir.is_dir():
        return None
    try:
        sub_dir = next(d for d in patient_dir.iterdir() if d.is_dir())
        RESULTS_CACHE[patient_id] = sub_dir
        return sub_dir
    except StopIteration:
        return None

def _load_volume(results_path: Path, volume_type: str) -> Tuple[nib.Nifti1Image, np.ndarray]:
    file_map = {
        "original": "source_reference.nii.gz",
        "mask": "segmentation.nii.gz",
    }
    if volume_type not in file_map:
        raise ValueError("Invalid volume type")
    file_path = results_path / file_map[volume_type]
    if not file_path.exists():
        raise FileNotFoundError(f"{volume_type} data not found")
    nii = nib.load(str(file_path))
    canonical = nib.as_closest_canonical(nii)
    data = canonical.get_fdata()
    if volume_type == "mask":
        data = np.asarray(data, dtype=np.uint8)
    else:
        data = np.asarray(data, dtype=np.float32)
    return canonical, data

@app.get("/volume/{patient_id}/meta")
def get_volume_meta(patient_id: str, volume_type: str = Query("original")):
    try:
        results_path = _resolve_results_path(patient_id)
        if not results_path:
            return {"error": "Invalid patient ID or results have expired."}
        nii, data = _load_volume(results_path, volume_type)
        shape = list(data.shape[:3])
        # zooms may have length 3 or more; take first 3
        try:
            spacing = list(nib.affines.voxel_sizes(nii.affine))
        except Exception:
            spacing = list(nii.header.get_zooms()[:3]) if hasattr(nii, 'header') else [1.0, 1.0, 1.0]
        affine = nii.affine.tolist()
        vmin = float(np.nanmin(data)) if data.size else 0.0
        vmax = float(np.nanmax(data)) if data.size else 1.0
        available = []
        for vt in ("original", "mask"):
            try:
                _ = _load_volume(results_path, vt)
                available.append(vt)
            except Exception:
                pass
        return {
            "shape": shape,
            "spacing": spacing,
            "affine": affine,
            "intensity": {"min": vmin, "max": vmax},
            "available_volumes": available,
        }
    except Exception as e:
        print(f"Error get_volume_meta: {e}")
        return {"error": str(e)}

def _normalize_to_uint8(arr: np.ndarray, wl: Optional[float], ww: Optional[float]) -> np.ndarray:
    a = arr.astype(np.float32)
    if wl is not None and ww is not None and ww > 0:
        low = wl - ww / 2.0
        high = wl + ww / 2.0
        a = np.clip((a - low) / max(high - low, 1e-6), 0.0, 1.0)
    else:
        amin, amax = float(np.nanmin(a)), float(np.nanmax(a))
        if amax > amin:
            a = (a - amin) / (amax - amin)
        else:
            a = np.zeros_like(a, dtype=np.float32)
    return (a * 255.0).astype(np.uint8)

def _overlay_mask(rgb: np.ndarray, mask_slice: np.ndarray, alpha: float = 0.4) -> np.ndarray:
    out = rgb.copy()
    alpha = float(np.clip(alpha, 0.0, 1.0))
    # simple coloring by class id
    colors = {
        1: np.array([255, 0, 0], dtype=np.uint8),
        2: np.array([0, 255, 0], dtype=np.uint8),
        3: np.array([0, 0, 255], dtype=np.uint8),
    }
    mask_int = mask_slice.astype(np.int32)
    for cls, color in colors.items():
        m = mask_int == cls
        if np.any(m):
            out[m] = (alpha * color + (1 - alpha) * out[m]).astype(np.uint8)
    return out

def _encode_png(img_array: np.ndarray) -> str:
    img = Image.fromarray(img_array)
    buf = BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")

def _make_square_slice(slice_data: np.ndarray, fill_value: int | float = 0) -> np.ndarray:
    """Pad a 2D slice to a square canvas without distorting the image."""
    h, w = slice_data.shape
    target = max(h, w)
    if h == target and w == target:
        return slice_data

    pad_h = target - h
    pad_w = target - w
    pad_top = pad_h // 2
    pad_bottom = pad_h - pad_top
    pad_left = pad_w // 2
    pad_right = pad_w - pad_left
    return np.pad(
        slice_data,
        ((pad_top, pad_bottom), (pad_left, pad_right)),
        mode="constant",
        constant_values=fill_value,
    )

@app.get("/orthoslices/{patient_id}")
def get_orthoslices(
    patient_id: str,
    i: int = Query(0, ge=0),
    j: int = Query(0, ge=0),
    k: int = Query(0, ge=0),
    modality: str = Query("original"),
    overlay: Optional[str] = Query(None),
    alpha: float = Query(0.4),
    wl: Optional[float] = Query(None),
    ww: Optional[float] = Query(None),
    scale: float = Query(1.0)
):
    try:
        results_path = _resolve_results_path(patient_id)
        if not results_path:
            return {"error": "Invalid patient ID or results have expired."}

        # Загружаем NIfTI через _load_volume (он возвращает nii, data)
        nii, data = _load_volume(results_path, modality)
        data = np.asarray(data)

        if data.ndim < 3:
            return {"error": f"Volume has wrong number of dimensions: {data.shape}"}

        if data.ndim > 3:
            if data.shape[0] <= 4:
                data = data[0]
            else:
                data = data[..., 0]

        if data.ndim != 3:
            return {"error": f"Unable to reduce volume to 3 dimensions, got shape {data.shape}"}

        data = np.ascontiguousarray(data)
        X, Y, Z = data.shape

        ii = int(np.clip(i if i is not None else X // 2, 0, X - 1))
        jj = int(np.clip(j if j is not None else Y // 2, 0, Y - 1))
        kk = int(np.clip(k if k is not None else Z // 2, 0, Z - 1))

        def _extract_plane(volume: np.ndarray, plane: str, idx: int) -> np.ndarray:
            if plane == "sagittal":
                plane_data = volume[idx, :, :]
            elif plane == "coronal":
                plane_data = volume[:, idx, :]
            else:
                plane_data = volume[:, :, idx]
            return np.ascontiguousarray(plane_data)

        def _prepare_gray(plane: str, idx: int) -> np.ndarray:
            raw_slice = _extract_plane(data, plane, idx)
            norm_slice = _normalize_to_uint8(raw_slice, wl, ww)
            return _make_square_slice(norm_slice)

        sag_u8 = _prepare_gray("sagittal", ii)
        cor_u8 = _prepare_gray("coronal", jj)
        axi_u8 = _prepare_gray("axial", kk)

        sag_rgb = np.stack([sag_u8] * 3, axis=-1)
        cor_rgb = np.stack([cor_u8] * 3, axis=-1)
        axi_rgb = np.stack([axi_u8] * 3, axis=-1)

        if overlay == "mask":
            try:
                _, mask = _load_volume(results_path, "mask")
                mask = np.asarray(mask)

                if mask.ndim > 3:
                    if mask.shape[0] <= 4:
                        mask = mask[0]
                    else:
                        mask = mask[..., 0]

                mask = np.ascontiguousarray(mask)

                sag_mask = _make_square_slice(_extract_plane(mask, "sagittal", ii).astype(np.uint8))
                cor_mask = _make_square_slice(_extract_plane(mask, "coronal", jj).astype(np.uint8))
                axi_mask = _make_square_slice(_extract_plane(mask, "axial", kk).astype(np.uint8))

                sag_rgb = _overlay_mask(sag_rgb, sag_mask, alpha)
                cor_rgb = _overlay_mask(cor_rgb, cor_mask, alpha)
                axi_rgb = _overlay_mask(axi_rgb, axi_mask, alpha)
            except Exception as e:
                print(f"Mask overlay failed: {e}")

        def _scale_img(rgb: np.ndarray) -> np.ndarray:
            if abs(scale - 1.0) < 1e-6:
                return rgb
            new_h = max(1, int(rgb.shape[0] * scale))
            new_w = max(1, int(rgb.shape[1] * scale))
            return np.asarray(Image.fromarray(rgb).resize((new_w, new_h), resample=Image.BILINEAR))

        sag_rgb = _scale_img(sag_rgb)
        cor_rgb = _scale_img(cor_rgb)
        axi_rgb = _scale_img(axi_rgb)


        return {
            "indices": {"i": ii, "j": jj, "k": kk},
            "sagittal": _encode_png(sag_rgb),
            "coronal": _encode_png(cor_rgb),
            "axial": _encode_png(axi_rgb),
            "shape": [int(X), int(Y), int(Z)]
        }

    except Exception as e:
        print(f"Error get_orthoslices: {e}")
        return {"error": str(e)}
