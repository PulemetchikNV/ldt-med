# 🏥 LDT Medical - Система анализа медицинских изображений

Полнофункциональная система для анализа медицинских изображений с использованием машинного обучения.

## 🏗️ Архитектура

```
ldt-med/
├── 📁 backend/          # Fastify API сервер (TypeScript)
├── 📁 frontend/         # Vue.js веб-интерфейс
├── 📁 ml/              # Python ML сервис (FastAPI)
├── 📁 scripts/         # Утилиты и скрипты
├── 📁 docs/            # Документация
├── 📁 test_data/       # Тестовые данные
└── 📄 docker-compose.yml
```

## 🚀 Быстрый старт

### Разработка
```bash
# Запуск всех сервисов
./scripts/dev.sh

# Или через Docker Compose
docker compose -f docker-compose.dev.yml up --build
```

### Продакшн
```bash
# Запуск продакшн версии
./scripts/prod.sh

# Или через Docker Compose
docker compose up --build
```

## 🔧 Сервисы

| Сервис | Порт | Описание |
|--------|------|----------|
| Frontend | 8080 | Vue.js интерфейс |
| Backend | 3000 | Fastify API |
| ML Service | 5001 | Python ML анализ |
| PostgreSQL | 5432 | База данных |
| pgAdmin | 5050 | Админка БД |

## 📊 ML Анализ

Система поддерживает:
- **NIfTI файлы** (.nii, .nii.gz) - МРТ снимки
- **ZIP архивы** с DICOM файлами
- **Сегментация опухолей** мозга
- **Интерактивный просмотр** срезов

## 🧪 Тестирование

```bash
# Скачать тестовые данные
./scripts/download_test_data.sh

# Создать тестовые файлы
python scripts/create_test_zip.py
python scripts/create_test_nifti.py
```

## 📚 Документация

- [API Documentation](docs/api.md)
- [ML Service Guide](docs/ml-service.md)
- [Deployment Guide](docs/deployment.md)

## 🛠️ Разработка

### Backend (Fastify + TypeScript)
```bash
cd backend
npm install
npm run dev
```

### Frontend (Vue.js)
```bash
cd frontend
npm install
npm run dev
```

### ML Service (Python)
```bash
cd ml
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

## 🔐 Аутентификация

- JWT токены
- Keycloak интеграция
- Роли пользователей

## 📦 Docker

Все сервисы контейнеризованы и готовы к развертыванию.

## 🤝 Вклад в проект

1. Fork репозитория
2. Создайте feature branch
3. Commit изменения
4. Push в branch
5. Создайте Pull Request

## 📄 Лицензия

MIT License
