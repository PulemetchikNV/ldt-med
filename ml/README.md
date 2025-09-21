## ML Service (FastAPI + PyTorch + MONAI)

Этот сервис выполняет анализ МРТ головного мозга: принимает NIfTI либо ZIP с DICOM-снимками, подготавливает объёмы, запускает модель сегментации и отдаёт результаты (класс, маски, срезы). Ниже кратко о том, как всё устроено.

### Архитектура и ключевые файлы

- `main.py` — FastAPI-приложение, HTTP-эндпоинты и базовый пайплайн NIfTI; кэш путей `RESULTS_CACHE` и выдача срезов.
- `dicom_zip_processor.py` — пайплайн обработки ZIP/DICOM: распаковка, выбор эталонной модальности, нормализация, инференс MONAI, сохранение артефактов.
- `best_model.pth` — веса модели (`SegResNet` из MONAI), по умолчанию грузится на CPU.
- `static_results/` — папка с результатами инференса (персистентно внутри контейнера).
- `requirements.txt`, `Dockerfile` — зависимости и образ.

### Эндпоинты

- GET `/` — health (простой JSON с сообщением).
- POST `/predict` — анализ NIfTI (`multipart/form-data`, поле `file`).
- POST `/predict_zip` — анализ ZIP с DICOM (`multipart/form-data`, поле `file`).
- GET `/slice/{patient_id}/{volume_type}/{slice_index}` — получить PNG конкретного среза:
  - `volume_type`: `original` | `mask`.
  - Возвращает Base64 PNG в поле `slice_data`.

Примеры запросов (из хоста):

```bash
# Health
curl http://localhost:5001/

# NIfTI
curl -X POST http://localhost:5001/predict \
  -F "file=@test_data/example_brain.nii.gz"

# ZIP с DICOM
curl -X POST http://localhost:5001/predict_zip \
  -F "file=@test_data/real_dicom_test.zip"

# Срез (после успешного predict_zip)
curl http://localhost:5001/slice/<patient_id>/mask/72
```

### Потоки данных и сохранение результатов

1) `POST /predict` (NIfTI)
- Файл сохраняется во временный `.nii.gz`, далее трансформации MONAI (`LoadImaged`, `EnsureChannelFirstd`, `Resized`, `NormalizeIntensityd`).
- Модель (`SegResNet`) предсказывает объём маски; для ответа подготавливается центральный срез (PNG, Base64), вместе с классом (`Tumor`/`No Tumor`).

2) `POST /predict_zip` (ZIP/DICOM)
- Архив распаковывается во временную папку.
- В `dicom_zip_processor.py` собираются серии DICOM, выбирается эталонная модальность (обычно `t1c`), выравниваются размеры, подготавливаются входы.
- Выполняется sliding-window инференс MONAI, итоговые артефакты сохраняются в:
  - `static_results/<request_id>/<zip_stem>/source_reference.nii.gz`
  - `static_results/<request_id>/<zip_stem>/segmentation.nii.gz`
- В `RESULTS_CACHE` кэшируется соответствие `<request_id> -> путь к папке результатов`.
- Ответ содержит `patient_id` (`request_id`) и метаданные (например, число срезов), после чего фронт/бекенд могут запрашивать `/slice/...` для визуализации.

3) `GET /slice/{patient_id}/{volume_type}/{slice_index}`
- При первом обращении путь берётся из `RESULTS_CACHE`, либо ищется на диске: `static_results/<patient_id>/*`.
- Для `original` срез нормализуется в [0,1] и рендерится в PNG (градации серого). Для `mask` применяется псевдоцвет (RGBA: значения классов 1,2,3 → R/G/B).
- Ответ — `{ slice_data: <base64 PNG> }`.

### Ошибки и коды

- Ошибки парсинга/валидации (неверный формат, ZIP без DICOM-серий) — возвращаются с сообщением. Бекенд (Fastify) маппит такие ответы на 400/500 в зависимости от ситуации.
- Типичные:
  - `File is not a zip file` — загрузили невалидный ZIP.
  - "Не найдено ни одной распознанной DICOM-серии" — архив не содержит корректных DICOM.

### Производительность: CPU/GPU и таймауты

- По умолчанию запуск на CPU (лог: `устройство: cpu, AMP: False`). На больших объёмах инференс может занимать минуты.
- Таймаут на стороне API-шлюза (Fastify) задаётся через переменную окружения `ML_TIMEOUT_MS` и прокидывается в `backend/src/services/mlService.ts`.
  - По умолчанию выставлено 20 минут (1 200 000 мс).

GPU (рекомендуется, если есть NVIDIA, напр. 3070 Ti):

- В `docker-compose.dev.yml`:
  - `ml-service` запущен с GPU (см. секцию `gpus`), при включённой поддержке GPU в Docker Desktop/WSL2.
- Для максимальной скорости также можно:
  - перейти на CUDA-образ в Dockerfile (например, `nvidia/cuda:12.1.1-cudnn-runtime-ubuntu22.04`),
  - установить PyTorch с соответствующим CUDA: `pip install --index-url https://download.pytorch.org/whl/cu121 torch torchvision torchaudio`,
  - в коде выбрать `device=cuda` и включить AMP.

Параметры sliding-window инференса (настраиваются в `main.py` → `zip_inference_config`):

- `roi_size`, `sw_batch_size`, `overlap` — влияют на скорость и память. Для CPU можно уменьшить `roi_size`, `sw_batch_size`.

### Переменные окружения

- `MODEL_PATH` — путь к весам модели (по умолчанию `/app/best_model.pth`).
- `LOG_LEVEL` (при необходимости) — уровень логов.
- (через docker-compose для бэкенда) `ML_TIMEOUT_MS` — таймаут запросов к ML-сервису.

### Сборка и запуск

Локально (без Docker):

```bash
pip install -r ml/requirements.txt
uvicorn ml.main:app --host 0.0.0.0 --port 8000
```

Docker Compose (dev):

```bash
docker compose -f docker-compose.dev.yml up --build
```

### Где искать результаты

- Внутри контейнера ML: `/app/static_results/<request_id>/<zip_stem>/`
  - `source_reference.nii.gz` — нормализованный опорный том.
  - `segmentation.nii.gz` — предсказанная маска сегментации.
- Для визуализации срезы берутся по `/slice/...` и приходят как Base64 PNG.

### Взаимодействие с бекендом (Fastify)

- Бекенд обращается по внутреннему адресу `http://ml-service:8000`.
- Файлы от фронтенда принимаются бекендом и в виде `multipart/form-data` отправляются в ML.
- При ошибках ML бекенд возвращает 400/500 и сообщение из ML.

### Отладка

- Логи ML: `docker compose -f docker-compose.dev.yml logs -f ml-service`
- Проверка модели в контейнере:
```bash
docker exec -it ldt-med-ml python -c "import torch; print(torch.__version__); torch.load('/app/best_model.pth', map_location='cpu'); print('ok')"
```
- Проверка health: `curl http://localhost:5001/`


