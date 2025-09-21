# 🚀 Deployment Guide

## Обзор

Руководство по развертыванию LDT Medical системы в различных средах.

## 🐳 Docker Deployment

### Разработка
```bash
# Запуск всех сервисов
./scripts/dev.sh

# Или вручную
docker compose -f docker-compose.dev.yml up --build
```

### Продакшн
```bash
# Запуск продакшн версии
./scripts/prod.sh

# Или вручную
docker compose up --build
```

## 🔧 Конфигурация

### Переменные окружения

Создайте файл `.env` на основе `env.example`:

```bash
cp env.example .env
```

#### Основные настройки
```env
# Проект
PROJECT_NAME=ldt-med
POSTGRES_DB=ldt_med_db
POSTGRES_USER=ldt_med_user
POSTGRES_PASSWORD=secure_password

# Порты
BACKEND_PORT=3000
FRONTEND_PORT=8080
ML_PORT=5001
POSTGRES_PORT=5432
PGADMIN_PORT=5050

# ML Service
ML_SERVICE_URL=http://ml-service:8000
```

### Сети

Система использует Docker сеть `ldt-med_app-network` для связи между сервисами.

## 🏗️ Архитектура развертывания

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   ML Service    │
│   (Vue.js)      │◄──►│   (Fastify)     │◄──►│   (Python)      │
│   Port: 8080    │    │   Port: 3000    │    │   Port: 8000    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │   Port: 5432    │
                    └─────────────────┘
```

## 🌐 Production Deployment

### 1. Подготовка сервера

```bash
# Установка Docker и Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 2. Клонирование репозитория

```bash
git clone <repository-url>
cd ldt-med
```

### 3. Настройка окружения

```bash
# Создание .env файла
cp env.example .env

# Редактирование настроек
nano .env
```

### 4. Запуск системы

```bash
# Запуск в продакшн режиме
docker compose up -d --build

# Проверка статуса
docker compose ps
```

### 5. Проверка работоспособности

```bash
# Проверка API
curl http://localhost:3000/api/health

# Проверка фронтенда
curl http://localhost:8080

# Проверка ML сервиса
curl http://localhost:5001
```

## 🔒 Безопасность

### SSL/TLS
Для продакшн развертывания рекомендуется использовать reverse proxy с SSL:

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:8080;
    }
    
    location /api {
        proxy_pass http://localhost:3000;
    }
}
```

### Firewall
```bash
# Открытие только необходимых портов
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw enable
```

### База данных
```bash
# Создание резервных копий
docker exec ldt-med-postgres pg_dump -U ldt_med_user ldt_med_db > backup.sql

# Восстановление из резервной копии
docker exec -i ldt-med-postgres psql -U ldt_med_user ldt_med_db < backup.sql
```

## 📊 Мониторинг

### Логи
```bash
# Просмотр логов всех сервисов
docker compose logs -f

# Логи конкретного сервиса
docker compose logs -f backend
docker compose logs -f ml-service
```

### Ресурсы
```bash
# Использование ресурсов
docker stats

# Использование диска
docker system df
```

### Health Checks
```bash
# Проверка здоровья API
curl http://localhost:3000/api/health

# Проверка ML сервиса
curl http://localhost:5001/
```

## 🔄 Обновление

### Обновление кода
```bash
# Остановка сервисов
docker compose down

# Обновление кода
git pull origin main

# Пересборка и запуск
docker compose up -d --build
```

### Обновление ML модели
```bash
# Замена модели
cp new_model.pth ml/best_model.pth

# Перезапуск ML сервиса
docker compose restart ml-service
```

## 🚨 Troubleshooting

### Частые проблемы

#### 1. Порт уже используется
```bash
# Проверка занятых портов
netstat -tulpn | grep :3000

# Остановка конфликтующих процессов
sudo kill -9 <PID>
```

#### 2. Недостаточно памяти
```bash
# Очистка Docker
docker system prune -a

# Увеличение лимитов памяти
docker compose up --build --memory=4g
```

#### 3. Проблемы с базой данных
```bash
# Проверка подключения
docker exec ldt-med-postgres psql -U ldt_med_user -d ldt_med_db -c "SELECT 1;"

# Перезапуск базы данных
docker compose restart postgres
```

### Логи для диагностики
```bash
# Детальные логи
docker compose logs --tail=100 -f

# Логи с временными метками
docker compose logs -t -f
```

## 📋 Checklist для развертывания

- [ ] Docker и Docker Compose установлены
- [ ] Файл `.env` настроен
- [ ] Порты не заняты
- [ ] Достаточно места на диске
- [ ] SSL сертификаты (для продакшн)
- [ ] Firewall настроен
- [ ] Мониторинг настроен
- [ ] Резервное копирование настроено
- [ ] Health checks работают
- [ ] Все сервисы запущены
