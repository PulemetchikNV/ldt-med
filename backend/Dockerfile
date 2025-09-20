FROM node:20-alpine

WORKDIR /app

# Установка зависимостей
COPY package*.json ./
RUN npm ci --only=production

# Копирование исходного кода
COPY . .

# Установка netcat для проверки доступности PostgreSQL
RUN apk add --no-cache netcat-openbsd

EXPOSE 3000

CMD ["npm", "start"] 