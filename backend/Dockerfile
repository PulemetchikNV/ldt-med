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

# Удаление dev-зависимостей
RUN npm prune --production
# Установка netcat для проверки доступности PostgreSQL
RUN apk add --no-cache netcat-openbsd

EXPOSE 3000

CMD ["npm", "start"] 
