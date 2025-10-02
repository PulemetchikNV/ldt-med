FROM node:20-alpine

WORKDIR /app

# Установка зависимостей
COPY package*.json ./
RUN npm ci

# Копирование исходного кода
COPY . .

# Генерация Prisma клиента
RUN npx prisma generate

# Сборка проекта без проверки типов
RUN npm run build

# Копирование Prisma клиента в итоговую сборку
RUN mkdir -p dist/generated && cp -r src/generated/prisma dist/generated/prisma

# Удаление dev-зависимостей
RUN npm prune --production
# Установка netcat для проверки доступности PostgreSQL
RUN apk add --no-cache netcat-openbsd

EXPOSE 3000

CMD ["npm", "start"] 
