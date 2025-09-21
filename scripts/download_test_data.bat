@echo off

echo 🧠 Скачивание тестовых медицинских данных...

REM Создаем папку для тестовых данных
if not exist test_data mkdir test_data

REM Скачиваем пример NIfTI файла
echo 📥 Скачиваем пример NIfTI файла...
powershell -Command "Invoke-WebRequest -Uri 'https://github.com/nipy/nibabel/raw/master/nibabel/tests/data/example4d.nii.gz' -OutFile 'test_data\example_brain.nii.gz'"

REM Скачиваем еще один пример
echo 📥 Скачиваем второй пример NIfTI файла...
powershell -Command "Invoke-WebRequest -Uri 'https://github.com/nipy/nibabel/raw/master/nibabel/tests/data/example.nii.gz' -OutFile 'test_data\example_brain2.nii.gz'"

REM Создаем тестовый ZIP архив (если есть DICOM файлы)
echo 📦 Проверяем наличие DICOM файлов...
if exist dicom_samples (
    echo Создаем ZIP архив с DICOM файлами...
    powershell -Command "Compress-Archive -Path 'dicom_samples\*' -DestinationPath 'test_data\test_dicom.zip'"
    echo ✅ ZIP архив создан: test_data\test_dicom.zip
) else (
    echo ⚠️  Папка dicom_samples не найдена. Создайте папку с DICOM файлами для тестирования.
)

echo ✅ Тестовые данные готовы в папке test_data\
echo.
echo 📋 Доступные файлы для тестирования:
dir test_data\

echo.
echo 🚀 Теперь вы можете загрузить эти файлы в веб-интерфейс:
echo    - Frontend: http://localhost:8080/ml-analysis
echo    - Backend API: http://localhost:3000/api/ml/health
