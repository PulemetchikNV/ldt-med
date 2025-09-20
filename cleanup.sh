#!/bin/bash

echo "🧹 Очистка старых контейнеров и образов..."

# Остановка и удаление контейнеров с конфликтующими именами
echo "🛑 Остановка конфликтующих контейнеров..."
docker stop ai-negotiation-postgres 2>/dev/null || true
docker stop the-one-market-postgres 2>/dev/null || true
docker stop the-one-market-backend 2>/dev/null || true
docker stop the-one-market-frontend 2>/dev/null || true
docker stop the-one-market-backend-dev 2>/dev/null || true
docker stop the-one-market-frontend-dev 2>/dev/null || true

# Удаление контейнеров
echo "🗑️ Удаление конфликтующих контейнеров..."
docker rm ai-negotiation-postgres 2>/dev/null || true
docker rm the-one-market-postgres 2>/dev/null || true
docker rm the-one-market-backend 2>/dev/null || true
docker rm the-one-market-frontend 2>/dev/null || true
docker rm the-one-market-backend-dev 2>/dev/null || true
docker rm the-one-market-frontend-dev 2>/dev/null || true

# Очистка неиспользуемых образов
echo "🧽 Очистка неиспользуемых образов..."
docker image prune -f

# Очистка неиспользуемых volumes
echo "📦 Очистка неиспользуемых volumes..."
docker volume prune -f

echo "✅ Очистка завершена!"
echo "🚀 Теперь можно запускать проект: ./dev.sh"
