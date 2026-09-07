FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Install system dependencies for Postgres and native extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    socat \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend application
COPY . .

EXPOSE 8000 8080

CMD ["sh", "-c", "TARGET_PORT=${PORT:-8080}; if [ \"$TARGET_PORT\" != \"8000\" ]; then socat TCP-LISTEN:8000,fork TCP:127.0.0.1:$TARGET_PORT & else socat TCP-LISTEN:8080,fork TCP:127.0.0.1:8000 & fi; exec uvicorn app.main:app --host 0.0.0.0 --port $TARGET_PORT"]
