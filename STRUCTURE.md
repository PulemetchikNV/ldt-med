# 📁 Структура проекта LDT Medical

## 🏗️ Общая архитектура

```
ldt-med/
├── 📁 backend/          # Fastify API сервер (TypeScript)
├── 📁 frontend/         # Vue.js веб-интерфейс  
├── 📁 ml/              # Python ML сервис (FastAPI)
├── 📁 scripts/         # Утилиты и скрипты
├── 📁 docs/            # Документация
├── 📁 test_data/       # Тестовые данные
├── 📄 docker-compose.yml
├── 📄 docker-compose.dev.yml
└── 📄 README.md
```

## 📂 Детальная структура

### Backend (`/backend/`)
```
backend/
├── 📁 src/                    # Исходный код TypeScript
│   ├── 📁 routes/            # API маршруты
│   │   ├── auth.ts          # Аутентификация
│   │   ├── healthcheck.ts   # Health check
│   │   └── ml.ts            # ML API
│   ├── 📁 services/         # Бизнес-логика
│   │   └── mlService.ts     # ML сервис
│   ├── 📁 types/            # TypeScript типы
│   │   └── ml.ts            # ML типы
│   └── server.ts            # Главный файл сервера
├── 📁 dist/                 # Скомпилированный JavaScript
├── 📄 package.json          # Зависимости Node.js
├── 📄 tsconfig.json         # Конфигурация TypeScript
├── 📄 Dockerfile            # Production Docker
└── 📄 Dockerfile.dev        # Development Docker
```

### Frontend (`/frontend/`)
```
frontend/
├── 📁 src/                   # Исходный код Vue.js
│   ├── 📁 components/       # Vue компоненты
│   │   ├── FileUploader.vue # Загрузка файлов
│   │   ├── MLResults.vue    # Результаты ML
│   │   └── HelloWorld.vue   # Тестовый компонент
│   ├── 📁 views/            # Страницы приложения
│   │   ├── Dashboard.vue    # Главная страница
│   │   ├── Login.vue        # Вход
│   │   ├── Register.vue     # Регистрация
│   │   └── MLAnalysis.vue   # ML анализ
│   ├── 📁 services/         # API сервисы
│   │   └── mlApi.ts         # ML API клиент
│   ├── 📁 stores/           # Pinia stores
│   │   └── auth.ts          # Аутентификация
│   ├── 📁 router/           # Vue Router
│   │   └── index.ts         # Маршруты
│   ├── App.vue              # Главный компонент
│   ├── main.ts              # Точка входа
│   └── style.css            # Глобальные стили
├── 📁 docker/               # Docker конфигурация
│   └── nginx.conf           # Nginx конфиг
├── 📄 package.json          # Зависимости
├── 📄 vite.config.ts        # Vite конфигурация
├── 📄 Dockerfile            # Production Docker
└── 📄 Dockerfile.dev        # Development Docker
```

### ML Service (`/ml/`)
```
ml/
├── 📄 main.py               # FastAPI приложение
├── 📄 dicom_zip_processor.py # Обработка DICOM
├── 📄 requirements.txt      # Python зависимости
├── 📄 Dockerfile            # Docker конфигурация
├── 📄 best_model.pth        # Обученная модель
└── 📄 modality_map.json     # Карта модальностей
```

### Scripts (`/scripts/`)
```
scripts/
├── 📄 dev.sh                # Запуск разработки
├── 📄 prod.sh               # Запуск продакшн
├── 📄 cleanup.sh            # Очистка контейнеров
├── 📄 create_test_nifti.py  # Создание тестовых NIfTI
├── 📄 create_test_zip.py    # Создание тестовых ZIP
├── 📄 download_test_data.sh # Скачивание тестовых данных
└── 📄 download_test_data.bat # Скачивание (Windows)
```

### Documentation (`/docs/`)
```
docs/
├── 📄 api.md                # API документация
├── 📄 ml-service.md         # ML сервис документация
└── 📄 deployment.md         # Руководство по развертыванию
```

### Test Data (`/test_data/`)
```
test_data/
├── 📄 example_brain.nii.gz  # Тестовый NIfTI файл
├── 📄 test_dicom.zip        # Тестовый ZIP с DICOM
└── 📄 .gitkeep              # Сохранение папки в git
```

## 🔧 Конфигурационные файлы

### Docker
- `docker-compose.yml` - Production конфигурация
- `docker-compose.dev.yml` - Development конфигурация
- `env.example` - Пример переменных окружения

### TypeScript
- `backend/tsconfig.json` - Backend TypeScript конфиг
- `frontend/tsconfig.json` - Frontend TypeScript конфиг
- `frontend/tsconfig.app.json` - App TypeScript конфиг
- `frontend/tsconfig.node.json` - Node TypeScript конфиг

### Vue.js
- `frontend/vite.config.ts` - Vite конфигурация

## 🚀 Запуск проекта

### Разработка
```bash
./scripts/dev.sh
```

### Продакшн
```bash
./scripts/prod.sh
```

### Очистка
```bash
./scripts/cleanup.sh
```

## 📊 Порты сервисов

| Сервис | Порт | Описание |
|--------|------|----------|
| Frontend | 8080 | Vue.js интерфейс |
| Backend | 3000 | Fastify API |
| ML Service | 5001 | Python ML анализ |
| PostgreSQL | 5432 | База данных |
| pgAdmin | 5050 | Админка БД |

## 🔗 Связи между сервисами

```
Frontend (8080) ──► Backend (3000) ──► ML Service (8000)
     │                    │
     └────────────────────┼──► PostgreSQL (5432)
                          │
                          └──► pgAdmin (5050)
```

## 📝 Примечания

- Все сервисы контейнеризованы с Docker
- Используется Docker Compose для оркестрации
- TypeScript для type safety
- Vue.js 3 с Composition API
- FastAPI для ML сервиса
- PostgreSQL для хранения данных
