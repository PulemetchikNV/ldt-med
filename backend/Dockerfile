FROM node:20-alpine

WORKDIR /app

# Установка зависимостей
COPY package*.json ./
RUN npm i --only=production

# Копирование исходного кода
COPY . .

# Сборка TypeScript
RUN npm run build

# Установка netcat для проверки доступности PostgreSQL
RUN apk add --no-cache netcat-openbsd

EXPOSE 3000

CMD ["npm", "start"] 