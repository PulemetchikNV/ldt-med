FROM node:20-alpine

WORKDIR /app

# Установка зависимостей
COPY package*.json ./
RUN npm ci

# Копирование исходного кода
COPY . .

# Сборка проекта без проверки типов
RUN npm run build && npm prune --production

# Установка netcat для проверки доступности PostgreSQL
RUN apk add --no-cache netcat-openbsd

RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "start"] 
