# ML API Documentation

Backend предоставляет API для работы с ML сервисом анализа опухолей.

## Эндпоинты

### 1. Анализ NIfTI файлов

**POST** `/api/ml/predict/nifti`

Анализ медицинских изображений в формате NIfTI (.nii, .nii.gz).

**Параметры:**
- `file` (multipart/form-data) - NIfTI файл

**Ответ:**
```json
{
  "success": true,
  "data": {
    "prediction": "Tumor|No Tumor",
    "has_tumor": true|false,
    "mask_image": "base64_encoded_image",
    "request_id": "uuid"
  },
  "filename": "example.nii.gz"
}
```

### 2. Анализ ZIP архивов с DICOM

**POST** `/api/ml/predict/zip`

Анализ ZIP архивов, содержащих DICOM файлы.

**Параметры:**
- `file` (multipart/form-data) - ZIP архив с DICOM файлами

**Ответ:**
```json
{
  "success": true,
  "data": {
    "message": "Prediction completed",
    "request_id": "uuid",
    "patient_id": "patient_uuid",
    "has_tumor": true|false,
    "prediction": "Tumor|No Tumor"
  },
  "filename": "dicom_archive.zip"
}
```

### 3. Получение срезов изображения

**GET** `/api/ml/slice/:patientId/:volumeType/:sliceIndex`

Получение конкретного среза обработанного изображения.

**Параметры:**
- `patientId` (string) - ID пациента из результата predict_zip
- `volumeType` (string) - 'original' или 'mask'
- `sliceIndex` (number) - Индекс среза (начиная с 0)

**Ответ:**
```json
{
  "success": true,
  "data": {
    "slice_data": "base64_encoded_png_image"
  }
}
```

### 4. Проверка состояния ML сервиса

**GET** `/api/ml/health`

Проверка доступности ML сервиса.

**Ответ:**
```json
{
  "success": true,
  "ml_service": {
    "message": "Backend is running and configured for 3D NIfTI files."
  },
  "timestamp": "2025-09-20T15:30:00Z"
}
```

## Ошибки

### Коды ошибок:
- `400` - Неверные параметры запроса
- `404` - Файл или срез не найден
- `500` - Внутренняя ошибка сервера
- `503` - ML сервис недоступен

### Формат ошибки:
```json
{
  "error": "Описание ошибки",
  "details": "Дополнительная информация",
  "timestamp": "2025-09-20T15:30:00Z"
}
```

## Ограничения

- Максимальный размер файла: 1GB
- Поддерживаемые форматы:
  - NIfTI: `.nii`, `.nii.gz`
  - ZIP архивы с DICOM файлами
- Timeout для обработки: 5 минут

## Пример использования

```bash
# Анализ NIfTI файла
curl -X POST \
  http://localhost:3000/api/ml/predict/nifti \
  -F "file=@brain_scan.nii.gz"

# Анализ ZIP архива
curl -X POST \
  http://localhost:3000/api/ml/predict/zip \
  -F "file=@dicom_series.zip"

# Получение среза
curl http://localhost:3000/api/ml/slice/patient123/original/50

# Проверка здоровья
curl http://localhost:3000/api/ml/health
```
