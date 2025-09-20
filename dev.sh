#!/bin/bash

echo "🛑 Остановка всех запущенных контейнеров..."
docker compose -f docker-compose.dev.yml down

echo "🚀 Запуск контейнеров в режиме разработки..."
echo "📋 Доступные сервисы:"
echo "   - Backend (Fastify): http://localhost:3000"
echo "   - Frontend (Vue): http://localhost:8080"
echo "   - PostgreSQL: localhost:5432"
echo "   - pgAdmin: http://localhost:5050"
echo ""

docker compose -f docker-compose.dev.yml up --build