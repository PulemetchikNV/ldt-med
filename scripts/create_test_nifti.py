#!/usr/bin/env python3
"""
Создание тестового NIfTI файла для тестирования ML сервиса
"""

import numpy as np
import nibabel as nib
import os

def create_test_nifti():
    """Создает тестовый NIfTI файл с простой 3D структурой"""
    
    # Создаем папку если не существует
    os.makedirs('test_data', exist_ok=True)
    
    # Создаем 3D массив (64x64x32)
    data = np.zeros((64, 64, 32), dtype=np.float32)
    
    # Добавляем простую структуру - "мозг"
    for z in range(32):
        for y in range(64):
            for x in range(64):
                # Создаем эллипсоид (форма мозга)
                center_x, center_y = 32, 32
                radius_x, radius_y = 25, 25
                
                if ((x - center_x) / radius_x) ** 2 + ((y - center_y) / radius_y) ** 2 <= 1:
                    # Добавляем шум и градиент
                    noise = np.random.normal(0, 0.1)
                    gradient = z / 32.0
                    data[x, y, z] = 0.5 + gradient * 0.3 + noise
                    
                    # Добавляем "опухоль" в центре
                    if 20 <= x <= 44 and 20 <= y <= 44 and 10 <= z <= 22:
                        tumor_intensity = 0.8 + np.random.normal(0, 0.05)
                        data[x, y, z] = max(data[x, y, z], tumor_intensity)
    
    # Создаем NIfTI изображение
    affine = np.eye(4)
    nii_img = nib.Nifti1Image(data, affine)
    
    # Сохраняем файл
    output_path = 'test_data/test_brain.nii.gz'
    nib.save(nii_img, output_path)
    
    print(f"✅ Тестовый NIfTI файл создан: {output_path}")
    print(f"📊 Размер: {data.shape}")
    print(f"📁 Размер файла: {os.path.getsize(output_path)} байт")
    
    return output_path

if __name__ == "__main__":
    create_test_nifti()
