FROM mirror.gcr.io/library/python:3.10-slim

# Install system dependencies including Playwright dependencies, Java, Docker CLI, and libmagic
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    # Java JDK for Java code execution
    default-jdk \
    # Docker CLI for Docker-in-Docker (web framework execution)
    docker.io \
    # libmagic for file type detection (python-magic dependency)
    libmagic1 \
    file \
    # Playwright dependencies
    wget \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    libu2f-udev \
    libvulkan1 \
    && rm -rf /var/lib/apt/lists/*

# Install Playwright and browsers
RUN pip install playwright==1.40.0
RUN playwright install chromium

# Set working directory
WORKDIR /app

# NOTE (Railway build context):
# This service is intended to be deployed on Railway with:
# - Root Directory: backend
# - Dockerfile Path: Dockerfile  (or backend/Dockerfile with backend as context)
# In that setup, the Docker build context is the backend folder, so paths must be relative to it.

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code into /app
COPY . .

# Create necessary directories
RUN mkdir -p /app/uploads /app/screenshots /app/reports

# Expose port
EXPOSE 8000

# Run the application and respect the $PORT env var (Railway sets this)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
