#!/usr/bin/env python3
"""
Создание валидного DICOM файла для тестирования ML сервиса
"""

import pydicom
from pydicom.dataset import Dataset, FileDataset
from pydicom.uid import generate_uid
import numpy as np
import tempfile
import zipfile
import os
from datetime import datetime

def create_basic_dicom(filename, modality='MR', series_description='T1'):
    """Создает базовый валидный DICOM файл"""
    
    # Создаем фиктивные медицинские данные (256x256 пикселей)
    image_data = np.random.randint(0, 4096, (256, 256), dtype=np.uint16)
    
    # Создаем Dataset
    ds = Dataset()
    
    # Основные DICOM теги
    ds.PatientName = "Test^Patient"
    ds.PatientID = "TEST001"
    ds.StudyInstanceUID = generate_uid()
    ds.SeriesInstanceUID = generate_uid()
    ds.SOPInstanceUID = generate_uid()
    ds.SOPClassUID = '1.2.840.10008.5.1.4.1.1.4'  # MR Image Storage
    
    # Модальность и описание
    ds.Modality = modality
    ds.SeriesDescription = series_description
    
    # Параметры изображения
    ds.Rows = 256
    ds.Columns = 256
    ds.BitsAllocated = 16
    ds.BitsStored = 16
    ds.HighBit = 15
    ds.PixelRepresentation = 0
    ds.SamplesPerPixel = 1
    ds.PhotometricInterpretation = 'MONOCHROME2'
    
    # Данные изображения
    ds.PixelData = image_data.tobytes()
    
    # Метаинформация
    file_meta = Dataset()
    file_meta.MediaStorageSOPClassUID = ds.SOPClassUID
    file_meta.MediaStorageSOPInstanceUID = ds.SOPInstanceUID
    file_meta.TransferSyntaxUID = '1.2.840.10008.1.2.1'  # Explicit VR Little Endian
    file_meta.ImplementationClassUID = generate_uid()
    
    # Создаем FileDataset
    file_ds = FileDataset(filename, ds, file_meta=file_meta, preamble=b"\0" * 128)
    
    return file_ds

def create_test_dicom_zip():
    """Создает ZIP архив с валидными DICOM файлами"""
    
    os.makedirs('test_data', exist_ok=True)
    zip_path = 'test_data/real_dicom_test.zip'
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # Создаем несколько DICOM файлов разных модальностей
        modalities = [
            ('T1', 'T1-weighted'),
            ('T2', 'T2-weighted'),
            ('T1C', 'T1-weighted with contrast'),
            ('FLAIR', 'FLAIR')
        ]
        
        for i, (mod, desc) in enumerate(modalities):
            # Создаем временный DICOM файл
            with tempfile.NamedTemporaryFile(suffix='.dcm', delete=False) as tmp:
                ds = create_basic_dicom(tmp.name, 'MR', desc)
                ds.save()
                
                # Добавляем в ZIP архив
                dicom_name = f"series_{mod.lower()}_{i:03d}.dcm"
                zipf.write(tmp.name, dicom_name)
                
                # Удаляем временный файл
                os.unlink(tmp.name)
    
    print(f"✅ Создан валидный DICOM ZIP: {zip_path}")
    print(f"📁 Размер файла: {os.path.getsize(zip_path)} байт")
    print(f"📊 Содержит: {len(modalities)} DICOM файлов разных модальностей")
    
    return zip_path

if __name__ == "__main__":
    try:
        create_test_dicom_zip()
    except ImportError:
        print("❌ Ошибка: Необходимо установить pydicom")
        print("💡 Установите: pip install pydicom")
    except Exception as e:
        print(f"❌ Ошибка: {e}")
