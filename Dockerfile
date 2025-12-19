# ============================
# Stage 1: Frontend Build (Next.js)
# ============================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy package files and install dependencies
# Use the real package.json files from the frontend directory (there is no .bak file)
COPY frontend/package*.json ./
RUN npm install --no-audit --no-fund

# Copy all frontend source (exclude node_modules and .next)
COPY frontend/next.config.js ./
COPY frontend/tsconfig.json ./
COPY frontend/tailwind.config.ts ./
COPY frontend/postcss.config.js ./
COPY frontend/app/ ./app/
COPY frontend/components/ ./components/
COPY frontend/contexts/ ./contexts/
COPY frontend/lib/ ./lib/
COPY frontend/public/ ./public/
COPY frontend/styles/ ./styles/

# Build and export static files
RUN npm run build

# ============================
# Stage 2: Backend (Python + FastAPI)
# ============================
FROM python:3.10-slim AS backend
WORKDIR /app

# Install system dependencies including Playwright dependencies and Java
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    default-jdk \
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

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./

# Copy static exported frontend files from builder (only the out directory, no package.json)
COPY --from=frontend-builder /app/frontend/out /app/frontend

# Copy public images
COPY backend/app/public /app/public

# Create necessary directories
RUN mkdir -p /app/uploads /app/screenshots /app/reports

# Copy start script (use start.sh, not start-fullstack.sh)
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Expose backend port
EXPOSE 8000

# Start the backend server only — no npm needed
CMD ["./start.sh"]