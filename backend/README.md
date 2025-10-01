# LDT Medical Backend

Backend сервер на Fastify для медицинского приложения LDT.

## Установка и запуск

1. Установите зависимости:
```bash
npm install
```

2. Запустите сервер:
```bash
# Обычный запуск
npm start

# Запуск в режиме разработки (с автоперезагрузкой)
npm run dev
```

## API Endpoints

### Health Check

- `GET /api/health` - Базовая проверка состояния сервера
- `GET /api/health/detailed` - Детальная информация о состоянии сервера

## Примеры запросов

```bash
# Базовая проверка
curl http://localhost:3000/api/health

# Детальная проверка
curl http://localhost:3000/api/health/detailed
```

## Структура проекта

```
backend/
├── routes/
│   └── healthcheck.js    # Роуты для проверки состояния
├── server.js             # Основной файл сервера
├── package.json          # Зависимости и скрипты
└── README.md            # Документация
```

Сервер будет доступен по адресу: http://localhost:3000

## Формирование отчёта по классификации DICOM ZIP

Скрипт `classify-to-xlsx` позволяет запустить удалённую модель (метод `classify-study`) для одного ZIP-архива
или директории с ZIP-архивами и сформировать отчёт в формате `.xlsx`, соответствующий требованиям хакатона.

### Подготовка

1. Убедитесь, что установлены зависимости backend-проекта: `npm install`
2. Настройте переменную окружения `ML_DICOM_CLASSIFY_URL`, указывающую на endpoint модели классификации.

### Запуск

```bash
# Обработка одного архива
npm run classify-to-xlsx -- ./datasets/example.zip

# Обработка всех архивов в директории с указанием пути для отчёта
npm run classify-to-xlsx -- ./datasets --out ./reports/result.xlsx
```

Скрипт формирует таблицу с колонками `path_to_study`, `study_uid`, `series_uid`, `probability_of_pathology`,
`pathology`, `processing_status`, `time_of_processing`. Дополнительно выводится колонка `error_message` с деталями
ошибок и вспомогательные поля для будущих доработок (`most_dangerous_pathology_type`, `pathology_localization`).

Для извлечения `study_uid` и `series_uid` скрипт анализирует первый доступный DICOM-файл внутри ZIP.
