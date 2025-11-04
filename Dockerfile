FROM python:slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --upgrade pip && pip install -r requirements.txt

COPY static templates app.py /app/

RUN mkdir /app/thumbnails /app/images

EXPOSE 5000

CMD ["python", "app.py"]

