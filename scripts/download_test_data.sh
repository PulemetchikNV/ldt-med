#!/bin/bash

echo "🧠 Скачивание тестовых медицинских данных..."

# Создаем папку для тестовых данных
mkdir -p test_data

# Скачиваем пример NIfTI файла
echo "📥 Скачиваем пример NIfTI файла..."
wget -O test_data/example_brain.nii.gz \
  "https://github.com/nipy/nibabel/raw/master/nibabel/tests/data/example4d.nii.gz"

# Скачиваем еще один пример
echo "📥 Скачиваем второй пример NIfTI файла..."
wget -O test_data/example_brain2.nii.gz \
  "https://github.com/nipy/nibabel/raw/master/nibabel/tests/data/example.nii.gz"

# Создаем тестовый ZIP архив (если есть DICOM файлы)
echo "📦 Создаем тестовый ZIP архив..."
if [ -d "dicom_samples" ]; then
    zip -r test_data/test_dicom.zip dicom_samples/
    echo "✅ ZIP архив создан: test_data/test_dicom.zip"
else
    echo "⚠️  Папка dicom_samples не найдена. Создайте папку с DICOM файлами для тестирования."
fi

echo "✅ Тестовые данные готовы в папке test_data/"
echo ""
echo "📋 Доступные файлы для тестирования:"
ls -la test_data/

echo ""
echo "🚀 Теперь вы можете загрузить эти файлы в веб-интерфейс:"
echo "   - Frontend: http://localhost:8080/ml-analysis"
echo "   - Backend API: http://localhost:3000/api/ml/health"
