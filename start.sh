#!/bin/bash
# Startup script for Railway deployment

# Debug: Print environment variables
echo "Environment variables:"
echo "PORT: $PORT"
echo "DATABASE_URL: ${DATABASE_URL:0:20}..."

# Set default port if PORT is not set
if [ -z "$PORT" ]; then
    PORT=8000
    echo "PORT not set, using default: $PORT"
else
    echo "Using PORT from environment: $PORT"
fi

echo "Starting LabMate API on port $PORT"

# Start the application
exec uvicorn app.main:app --host 0.0.0.0 --port $PORT
