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
