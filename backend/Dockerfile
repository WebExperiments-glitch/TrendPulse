FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV USE_DATABASE=true
ENV DATABASE_URL=sqlite:///data/trendpulse.db

RUN mkdir -p /app/data

EXPOSE 5000

CMD ["python", "app.py"]