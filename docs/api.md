# 📚 API Документация

## Backend API (Fastify)

### Базовый URL
```
http://localhost:3000/api
```

## 🔐 Аутентификация

### POST /api/auth/login
Вход в систему

**Тело запроса:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Ответ:**
```json
{
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "role": "user"
  }
}
```

### POST /api/auth/register
Регистрация нового пользователя

**Тело запроса:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

### GET /api/auth/verify
Проверка токена

**Заголовки:**
```
Authorization: Bearer jwt_token_here
```

## 🧠 ML Анализ

### GET /api/ml/health
Проверка состояния ML сервиса

**Ответ:**
```json
{
  "status": "healthy",
  "ml_service": "connected",
  "timestamp": "2025-09-21T12:00:00Z"
}
```

### POST /api/ml/predict/nifti
Анализ NIfTI файла

**Тело запроса:**
```
Content-Type: multipart/form-data
file: nifti_file.nii.gz
```

**Ответ:**
```json
{
  "prediction": {
    "tumor_detected": true,
    "confidence": 0.85,
    "tumor_type": "glioma",
    "location": "left_frontal"
  },
  "segmentation_mask": "base64_encoded_image",
  "slices": [
    {
      "slice_number": 15,
      "image": "base64_encoded_slice"
    }
  ]
}
```

### POST /api/ml/predict/zip
Анализ ZIP архива с DICOM файлами

**Тело запроса:**
```
Content-Type: multipart/form-data
file: dicom_archive.zip
```

**Ответ:**
```json
{
  "prediction": {
    "tumor_detected": false,
    "confidence": 0.92,
    "tumor_type": null,
    "location": null
  },
  "segmentation_mask": null,
  "slices": [
    {
      "slice_number": 10,
      "image": "base64_encoded_slice"
    }
  ]
}
```

### GET /api/ml/slices/:analysisId/:sliceNumber
Получение конкретного среза

**Параметры:**
- `analysisId`: ID анализа
- `sliceNumber`: Номер среза

**Ответ:**
```json
{
  "slice_number": 10,
  "image": "base64_encoded_slice",
  "metadata": {
    "width": 256,
    "height": 256,
    "thickness": 1.0
  }
}
```

## 🏥 Health Check

### GET /api/health
Проверка состояния API

**Ответ:**
```json
{
  "status": "healthy",
  "timestamp": "2025-09-21T12:00:00Z",
  "services": {
    "database": "connected",
    "ml_service": "connected"
  }
}
```

## 📊 Коды ответов

| Код | Описание |
|-----|----------|
| 200 | Успешно |
| 201 | Создано |
| 400 | Неверный запрос |
| 401 | Не авторизован |
| 403 | Доступ запрещен |
| 404 | Не найдено |
| 500 | Внутренняя ошибка сервера |

## 🔧 Примеры использования

### cURL
```bash
# Проверка здоровья
curl http://localhost:3000/api/health

# Анализ NIfTI файла
curl -X POST http://localhost:3000/api/ml/predict/nifti \
  -F "file=@brain_scan.nii.gz"

# Анализ ZIP архива
curl -X POST http://localhost:3000/api/ml/predict/zip \
  -F "file=@dicom_archive.zip"
```

### JavaScript (Fetch)
```javascript
// Анализ файла
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('/api/ml/predict/nifti', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(result);
```
