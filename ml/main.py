import torch
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import tempfile
import nibabel as nib
import numpy as np
from PIL import Image
import base64
from io import BytesIO
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
        mask_nii = nib.load(mask_path)
        total_slices = mask_nii.shape[2]
        has_tumor = np.sum(mask_nii.get_fdata()) > 0
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
    results_path = RESULTS_CACHE.get(patient_id)
    if not results_path:
        # If not in cache, try to find it on the filesystem.
        # This makes the history feature robust to server restarts.
        patient_dir = STATIC_RESULTS_DIR / patient_id
        if patient_dir.is_dir():
            try:
                # The actual results are in a subdirectory named after the zip file.
                # We assume there is only one such subdirectory.
                sub_dir = next(d for d in patient_dir.iterdir() if d.is_dir())
                results_path = sub_dir
                RESULTS_CACHE[patient_id] = results_path  # Add to cache for future requests
            except StopIteration:
                # No subdirectory found, results_path remains None
                pass

    if not results_path or not results_path.is_dir():
        return {"error": "Invalid patient ID or results have expired."}
    file_map = {
        "original": "source_reference.nii.gz",
        "mask": "segmentation.nii.gz"
    }
    if volume_type not in file_map:
        return {"error": "Invalid volume type requested."}
    file_path = results_path / file_map[volume_type]
    if not file_path.exists():
        return {"error": f"{volume_type} data not found."}
    try:
        nii_img = nib.load(file_path)
        data = nii_img.get_fdata()
        
        if not (0 <= slice_index < data.shape[2]):
            return {"error": "Slice index out of bounds."}
        slice_data = data[:, :, slice_index]
        if volume_type == "original":
            if slice_data.max() > slice_data.min():
                slice_data = (slice_data - slice_data.min()) / (slice_data.max() - slice_data.min())
            img = Image.fromarray((slice_data * 255).astype(np.uint8), 'L')
        elif volume_type == "mask":
            # Initialize an RGBA image (height, width, 4 channels) with all zeros (fully transparent)
            rgba_data = np.zeros((slice_data.shape[0], slice_data.shape[1], 4), dtype=np.uint8)
            
            # Assign colors based on mask values.
            # Values in the mask correspond to different parts of the tumor.
            # We will use distinct colors for better visualization.
            rgba_data[slice_data == 1] = [255, 0, 0, 255]  # Red for value 1
            rgba_data[slice_data == 2] = [0, 255, 0, 255]  # Green for value 2
            rgba_data[slice_data == 3] = [0, 0, 255, 255]  # Blue for value 3

            # Create a PIL image from the numpy array in RGBA mode
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
