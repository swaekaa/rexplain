FROM python:3.11-slim

RUN apt-get update && apt-get install -y graphviz && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 10000

# Single worker + 2 async threads keeps RAM under 512 MB on Render's free tier.
# Increase --workers to 2 only if you upgrade to a paid plan.
CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "10000", \
     "--workers", "1", \
     "--timeout-keep-alive", "75"]
