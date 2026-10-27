FROM node:22-bookworm-slim AS node
FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    DATA_DIR=/data LAB_RESOURCES_DIR=/app/lab_resources
WORKDIR /app

# Match the Node and Python Debian releases. No Docker daemon/socket is needed.
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
    && apt-get update \
    && apt-get install -y --no-install-recommends gosu gcc g++ default-jdk xvfb xauth fonts-dejavu-core libmagic1 ca-certificates openssh-client poppler-utils tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
    && python -m playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*
COPY backend/app ./app
COPY backend/templates ./templates
COPY backend/migrations ./migrations
COPY backend/start.sh ./start.sh
COPY google_colab/index.html google_colab/app.js google_colab/style.css ./lab_resources/google_colab/
COPY google_colab/assets ./lab_resources/google_colab/assets
COPY sql_workbench/index.html sql_workbench/app.js sql_workbench/style.css ./lab_resources/sql_workbench/
COPY sql_workbench/assets ./lab_resources/sql_workbench/assets
RUN groupadd -g 10001 labmate && useradd -u 10001 -g 10001 --no-create-home --shell /usr/sbin/nologin labmate \
    && mkdir -p /data && chmod +x /app/start.sh

EXPOSE 8000
CMD ["/app/start.sh"]
