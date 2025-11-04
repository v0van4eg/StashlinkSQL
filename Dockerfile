FROM python:slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --upgrade pip && pip install -r requirements.txt

COPY static templates app.py /app/

RUN mkdir /app/thumbnails /app/images

# Создаем базу данных при сборке
RUN python -c "from app import init_db; init_db()"

RUN chmod 666 files.db

EXPOSE 5000

#CMD ["python", "app.py"]

CMD ["gunicorn", "--config", "gunicorn_config.py", "app:app"]
