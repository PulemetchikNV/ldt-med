#!/bin/bash

echo "🧹 Очистка конфликтующих контейнеров..."
# Остановка и удаление контейнеров с конфликтующими именами
docker stop ai-negotiation-postgres 2>/dev/null || true
docker stop ai-negotiation-backend-dev 2>/dev/null || true
docker stop the-one-market-postgres 2>/dev/null || true
docker stop the-one-market-backend 2>/dev/null || true
docker stop the-one-market-frontend 2>/dev/null || true
docker stop the-one-market-backend-dev 2>/dev/null || true
docker stop the-one-market-frontend-dev 2>/dev/null || true
docker stop pgadmin4_container 2>/dev/null || true

docker rm ai-negotiation-postgres 2>/dev/null || true
docker rm ai-negotiation-backend-dev 2>/dev/null || true
docker rm the-one-market-postgres 2>/dev/null || true
docker rm the-one-market-backend 2>/dev/null || true
docker rm the-one-market-frontend 2>/dev/null || true
docker rm the-one-market-backend-dev 2>/dev/null || true
docker rm the-one-market-frontend-dev 2>/dev/null || true
docker rm pgadmin4_container 2>/dev/null || true

echo "🛑 Остановка всех запущенных контейнеров проекта..."
docker compose -f docker-compose.dev.yml down

echo "🚀 Запуск контейнеров в режиме разработки..."
echo "📋 Доступные сервисы:"
echo "   - Backend (Fastify): http://localhost:3000"
echo "   - Frontend (Vue): http://localhost:8080"
echo "   - ML Service: http://localhost:5001"
echo "   - PostgreSQL: localhost:5432"
echo "   - pgAdmin: http://localhost:5050"
echo ""

# Переходим в корневую директорию проекта
cd "$(dirname "$0")/.."
docker compose -f docker-compose.dev.yml up --build