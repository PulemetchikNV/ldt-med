# 🧠 ML Service Документация

## Обзор

ML Service - это Python сервис на FastAPI для анализа медицинских изображений с использованием PyTorch и MONAI.

## 🏗️ Архитектура

```
ml/
├── main.py                 # FastAPI приложение
├── dicom_zip_processor.py  # Обработка DICOM файлов
├── requirements.txt        # Python зависимости
├── Dockerfile             # Docker конфигурация
└── best_model.pth         # Обученная модель
```

## 🚀 Запуск

### Локально
```bash
cd ml
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Docker
```bash
docker build -t ldt-med-ml .
docker run -p 8000:8000 ldt-med-ml
```

## 📡 API Endpoints

### GET /
Проверка состояния сервиса

**Ответ:**
```json
{
  "status": "healthy",
  "model_loaded": true,
  "version": "1.0.0"
}
```

### POST /predict/nifti
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
    "tumor_type": "glioma"
  },
  "segmentation_mask": "base64_encoded_image"
}
```

### POST /predict/dicom
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
    "confidence": 0.92
  },
  "slices": [
    {
      "slice_number": 10,
      "image": "base64_encoded_slice"
    }
  ]
}
```

## 🔧 Конфигурация

### Переменные окружения

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `MODEL_PATH` | Путь к модели | `/app/best_model.pth` |
| `MAX_FILE_SIZE` | Максимальный размер файла | `100MB` |
| `LOG_LEVEL` | Уровень логирования | `INFO` |

### Docker Compose
```yaml
ml-service:
  build: ./ml
  ports:
    - "5001:8000"
  environment:
    - MODEL_PATH=/app/best_model.pth
  volumes:
    - ./ml:/app
```

## 📊 Поддерживаемые форматы

### NIfTI
- `.nii` - несжатый NIfTI
- `.nii.gz` - сжатый NIfTI

### DICOM
- ZIP архивы с DICOM файлами
- Автоматическое определение модальности
- Поддержка различных серий

## 🧪 Тестирование

### Создание тестовых данных
```bash
# Создать тестовый NIfTI
python scripts/create_test_nifti.py

# Создать тестовый ZIP с DICOM
python scripts/create_test_zip.py
```

### Тестирование API
```bash
# Проверка здоровья
curl http://localhost:8000/

# Анализ NIfTI
curl -X POST http://localhost:8000/predict/nifti \
  -F "file=@test_data/example_brain.nii.gz"

# Анализ ZIP
curl -X POST http://localhost:8000/predict/dicom \
  -F "file=@test_data/test_dicom.zip"
```

## 🔍 Логирование

Сервис использует стандартное логирование Python:

```python
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
```

### Уровни логирования
- `DEBUG` - детальная отладочная информация
- `INFO` - общая информация о работе
- `WARNING` - предупреждения
- `ERROR` - ошибки
- `CRITICAL` - критические ошибки

## 🚨 Обработка ошибок

### Типичные ошибки

| Код | Описание | Решение |
|-----|----------|---------|
| 400 | Неверный формат файла | Проверьте формат файла |
| 413 | Файл слишком большой | Уменьшите размер файла |
| 500 | Ошибка модели | Проверьте загрузку модели |
| 503 | Сервис недоступен | Проверьте состояние сервиса |

### Примеры ответов об ошибках

```json
{
  "error": "Invalid file format",
  "message": "File must be NIfTI (.nii, .nii.gz) or ZIP with DICOM files",
  "status_code": 400
}
```

## 📈 Производительность

### Рекомендации
- Используйте GPU для ускорения
- Ограничьте размер файлов
- Кэшируйте результаты
- Мониторьте использование памяти

### Мониторинг
```bash
# Проверка использования ресурсов
docker stats ldt-med-ml

# Логи сервиса
docker logs ldt-med-ml -f
```

## 🔄 Обновление модели

1. Замените файл `best_model.pth`
2. Перезапустите сервис
3. Проверьте загрузку модели в логах

```bash
# Перезапуск с новой моделью
docker compose restart ml-service
```
