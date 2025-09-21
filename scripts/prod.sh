#!/bin/bash

# Остановить все запущенные контейнеры если они есть
docker compose -f docker-compose.yml down

# Запустить контейнеры в режиме разработки
docker compose -f docker-compose.yml up -d --build 