# 🚀 LabMate AI - Complete Setup & Run Guide

## 📋 Prerequisites

Before running LabMate AI, ensure you have the following installed:

- **Docker** (v20.10+) and **Docker Compose** (v2.0+)
- **Git** (for cloning the repository)
- **OpenAI API Key** (for AI features)

## 🛠️ Quick Start

### 1. Clone the Repository
```bash
git clone <repository-url>
cd Labmate
```

### 2. Configure Environment
```bash
# Copy the example environment file
cp env.example .env

# Edit the .env file with your OpenAI API key
# Add your OpenAI API key:
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Run the Application
```bash
# Build and start all services
docker compose up --build

# Or run in background
docker compose up --build -d
```

### 4. Access the Application
- **Frontend**: http://localhost:3000/dashboard
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## 🏗️ Architecture Overview

LabMate AI consists of three main services:

### 🗄️ PostgreSQL Database
- **Port**: 5432
- **Database**: labmate_db
- **User**: labmate / labmate_password

### 🐍 FastAPI Backend
- **Port**: 8000
- **Features**:
  - File upload and parsing
  - Code execution in Docker containers
  - Screenshot generation
  - AI-powered document analysis
  - Report composition

### ⚛️ Next.js Frontend
- **Port**: 3000
- **Features**:
  - Modern React UI with TailwindCSS
  - File upload interface
  - Task management
  - Real-time progress tracking

## 📁 Project Structure

```
Labmate/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── routers/        # API endpoints
│   │   ├── services/       # Business logic
│   │   ├── models.py       # Database models
│   │   ├── schemas.py      # Pydantic schemas
│   │   └── main.py         # FastAPI app
│   ├── templates/          # HTML templates for screenshots
│   ├── requirements.txt    # Python dependencies
│   └── Dockerfile
├── frontend/               # Next.js frontend
│   ├── app/               # App router pages
│   ├── components/        # React components
│   ├── lib/              # API client and utilities
│   ├── package.json      # Node.js dependencies
│   └── Dockerfile
├── docker-compose.yml     # Service orchestration
├── .env                   # Environment variables
└── README.md             # Project documentation
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file with the following variables:

```env
# Database
DATABASE_URL=postgresql://labmate:labmate_password@postgres:5432/labmate_db

# Security
BETA_KEY=your_beta_key_here

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=4000

# File Storage Paths
UPLOAD_DIR=/app/uploads
SCREENSHOT_DIR=/app/screenshots
REPORT_DIR=/app/reports

# Docker Settings
DOCKER_IMAGE=python:3.10-slim
CONTAINER_TIMEOUT=30
MEMORY_LIMIT=512m
```

## 🚀 Usage Guide

### 1. Upload Assignment
1. Go to http://localhost:3000/dashboard
2. Click "Upload File" and select a DOCX or PDF file
3. Wait for the file to be processed

### 2. AI Analysis (Optional)
1. The AI will analyze your document and suggest tasks
2. Review and customize the suggestions
3. Select which tasks to execute

### 3. Code Execution
1. Choose a theme (IDLE or VS Code)
2. Select tasks to execute
3. Watch as code runs in sandboxed containers
4. Screenshots are automatically generated

### 4. Generate Report
1. Preview generated screenshots and results
2. Reorder or remove items as needed
3. Click "Generate Report" to create final DOCX
4. Download the completed assignment

## 🧪 Testing the API

### Health Check
```bash
curl http://localhost:8000/health
```

### Upload File
```bash
curl -X POST "http://localhost:8000/api/upload" \
  -H "X-Beta-Key: your_beta_key_here" \
  -F "file=@assignment.docx"
```

### Parse Document
```bash
curl -X GET "http://localhost:8000/api/parse/1" \
  -H "X-Beta-Key: your_beta_key_here"
```

### AI Analysis
```bash
curl -X POST "http://localhost:8000/api/analyze" \
  -H "Content-Type: application/json" \
  -H "X-Beta-Key: your_beta_key_here" \
  -d '{"file_id": 1}'
```

### Run Code Execution
```bash
curl -X POST "http://localhost:8000/api/run" \
  -H "Content-Type: application/json" \
  -H "X-Beta-Key: your_beta_key_here" \
  -d '{"upload_id": 1, "task_ids": [1], "theme": "idle"}'
```

## 🔍 Troubleshooting

### Common Issues

#### 1. OpenAI API Errors
- Ensure your API key is valid and has sufficient credits
- Check the model name (gpt-4, gpt-3.5-turbo, etc.)
- Verify the API key is set in the `.env` file

#### 2. Docker Issues
- Ensure Docker is running
- Check if ports 3000, 8000, and 5432 are available
- Try rebuilding containers: `docker compose up --build`

#### 3. Database Connection Issues
- Wait for PostgreSQL to fully start (check logs)
- Verify database credentials in `.env`
- Check if database container is healthy

#### 4. File Upload Issues
- Ensure file is DOCX or PDF format
- Check file size (max 50MB)
- Verify beta key is correct

### Logs and Debugging

#### View Service Logs
```bash
# All services
docker compose logs

# Specific service
docker compose logs backend
docker compose logs frontend
docker compose logs postgres
```

#### Check Service Status
```bash
docker compose ps
```

#### Restart Services
```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart backend
```

## 🛡️ Security Features

- **Beta Key Authentication**: All API endpoints require a beta key
- **Sandboxed Code Execution**: Python code runs in isolated Docker containers
- **File Type Validation**: Only DOCX and PDF files are accepted
- **Resource Limits**: Memory and CPU limits prevent abuse

## 🔄 Development Mode

### Backend Development
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

### Database Access
```bash
# Connect to PostgreSQL
docker exec -it labmate-postgres-1 psql -U labmate -d labmate_db
```

## 📊 Monitoring

### Health Endpoints
- **Backend**: http://localhost:8000/health
- **Frontend**: http://localhost:3000

### API Documentation
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 🚀 Production Deployment

### Environment Setup
1. Set up a production PostgreSQL database
2. Configure proper file storage (AWS S3, etc.)
3. Set up reverse proxy (Nginx)
4. Configure SSL certificates
5. Set up monitoring and logging

### Docker Production Build
```bash
# Build production images
docker compose -f docker-compose.prod.yml build

# Deploy to production
docker compose -f docker-compose.prod.yml up -d
```

## 📞 Support

If you encounter issues:

1. Check the logs: `docker compose logs`
2. Verify all services are running: `docker compose ps`
3. Test individual endpoints with curl
4. Check the API documentation at http://localhost:8000/docs

## 🎯 Features Overview

### ✅ Working Features
- File upload (DOCX/PDF)
- Document parsing and task extraction
- Code execution in Docker containers
- Screenshot generation with themes
- Report composition and download
- AI-powered document analysis
- Modern web interface

### 🔧 Configuration Options
- Multiple screenshot themes (IDLE, VS Code)
- Customizable code execution limits
- Flexible task selection
- Reorderable results

### 🛡️ Security
- Sandboxed code execution
- File type validation
- Resource limits
- API authentication

---

**🎉 You're all set! LabMate AI is ready to automate your lab assignments!**
