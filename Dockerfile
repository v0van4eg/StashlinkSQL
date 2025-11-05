FROM python:slim

WORKDIR /app

# Установка зависимостей для PostgreSQL
RUN apt-get update && apt-get install -y \
    libpq-dev gcc && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --upgrade pip && pip install -r requirements.txt

COPY static templates app.py gunicorn_config.py /app/

RUN mkdir /app/thumbnails /app/images

# PostgreSQL будет инициализироваться через init.sql

EXPOSE 5000

CMD ["gunicorn", "--config", "gunicorn_config.py", "app:app"]