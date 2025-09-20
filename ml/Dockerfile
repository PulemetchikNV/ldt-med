FROM python:3.11-slim

# Устанавливаем системные зависимости для PyTorch, MONAI и медицинской обработки
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    cmake \
    pkg-config \
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
    libffi-dev \
    libssl-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Копируем файлы требований и устанавливаем зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем все файлы приложения
COPY . .

# Создаем директории для результатов
RUN mkdir -p /app/static_results

# Экспонируем порт
EXPOSE 8000

# Запускаем приложение
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
