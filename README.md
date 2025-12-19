# LabMate AI - Automated Lab Assignment Platform

LabMate AI automates college lab assignments by parsing DOCX/PDF files, executing Python code in sandboxed Docker containers, generating themed screenshots, and producing polished reports with embedded screenshots.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   PostgreSQL    │
│   (Next.js)     │◄──►│   (FastAPI)     │◄──►│   Database      │
│   Port: 3000    │    │   Port: 8000    │    │   Port: 5432    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Docker        │
                       │   Sandbox       │
                       │   (Python 3.10) │
                       └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- Python 3.10+ (for local development)

### Setup

1. **Clone and configure**:
   ```bash
   git clone <repository>
   cd labmate-ai
   cp .env.example .env
   ```

2. **Start all services**:
   ```bash
   docker-compose up --build
   ```

3. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

## 📋 Features

- **File Upload**: Support for DOCX and PDF assignments
- **Code Detection**: Automatically detects Python code blocks and screenshot instructions
- **Safe Execution**: Runs code in isolated Docker containers with resource limits
- **Screenshot Generation**: Creates editor-style screenshots (IDLE/VS Code themes)
- **Report Building**: Generates polished DOCX reports with embedded screenshots
- **Preview & Edit**: Review, reorder, and remove screenshots before final report

## 🔧 Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TailwindCSS** - Utility-first CSS framework
- **Framer Motion** - Animation library
- **shadcn/ui** - Component library
- **Axios** - HTTP client

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - ORM for database operations
- **PostgreSQL** - Primary database
- **Docker SDK** - Container management
- **Playwright** - Screenshot generation
- **Pygments** - Syntax highlighting
- **python-docx** - DOCX manipulation
- **pdfplumber** - PDF parsing

### Infrastructure
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration

## 🛡️ Security

- **Code Validation**: Blocklist approach for dangerous imports/operations
- **Docker Isolation**: No network access, memory/CPU limits, 30s timeout
- **File Validation**: Size limits and type checking
- **Beta Key Protection**: Simple shared secret authentication

## 📚 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload DOCX/PDF file |
| GET | `/api/parse/{file_id}` | Get detected tasks |
| POST | `/api/run` | Execute code blocks |
| POST | `/api/compose` | Generate final report |
| GET | `/api/download/{doc_id}` | Download report |

## 🔮 Future Enhancements

- JWT-based authentication
- Celery + Redis for background job processing
- PDF export support
- Cloud storage integration (S3/MinIO)
- Advanced code analysis and suggestions
- Multi-language support (Java, C++, etc.)

## 📖 Development

### Local Development

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

### Project Structure

```
labmate-ai/
├── frontend/          # Next.js application
├── backend/           # FastAPI application
├── docker-compose.yml # Service orchestration
├── .env.example       # Environment template
└── README.md          # This file
```

## 🚀 Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- Python 3.10+ (for local development)

### Quick Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd labmate-ai
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your preferred settings
   ```

3. **Start the application**:
   ```bash
   docker-compose up --build
   ```

4. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

### Local Development

For development without Docker:

```bash
# Backend (Terminal 1)
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend (Terminal 2)
cd frontend
npm install
npm run dev
```

## 📖 Usage Guide

### Step 1: Upload Assignment
1. Navigate to the Dashboard
2. Upload your DOCX or PDF lab assignment
3. The system will automatically parse and detect code blocks

### Step 2: Execute Code
1. Review the detected tasks and code blocks
2. Select which tasks to execute
3. Choose your preferred theme (IDLE or VS Code)
4. Click "Run Code" to execute in sandboxed containers

### Step 3: Preview & Download
1. Review generated screenshots
2. Drag and drop to reorder if needed
3. Remove any unwanted screenshots
4. Generate and download your final report

## 🔧 Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://labmate:labmate_password@postgres:5432/labmate_db

# Security
BETA_KEY=your_beta_key_here

# File Storage
UPLOAD_DIR=/app/uploads
SCREENSHOT_DIR=/app/screenshots
REPORT_DIR=/app/reports

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Docker Settings

The system uses Docker for safe code execution with these limits:
- Memory: 512MB per container
- CPU: 0.5 cores per container
- Timeout: 30 seconds
- Network: Disabled

## 🛡️ Security Features

1. **Code Validation**: Blocklist approach prevents dangerous operations
2. **Container Isolation**: Each execution runs in an isolated Docker container
3. **Resource Limits**: Memory and CPU limits prevent resource exhaustion
4. **Network Isolation**: No external network access during execution
5. **File Restrictions**: Prevents file system access and modifications

## 🔮 Future Enhancements

### Planned Features
- [ ] JWT-based user authentication
- [ ] Celery + Redis for background job processing
- [ ] PDF export support
- [ ] Cloud storage integration (S3/MinIO)
- [ ] Advanced code analysis and suggestions
- [ ] Multi-language support (Java, C++, etc.)
- [ ] Real-time collaboration features
- [ ] Assignment templates and libraries

### Technical Improvements
- [ ] Horizontal scaling with Kubernetes
- [ ] Redis caching for better performance
- [ ] WebSocket support for real-time updates
- [ ] Advanced screenshot customization
- [ ] Code plagiarism detection
- [ ] Automated testing integration

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

## 📊 Monitoring

The application includes health check endpoints:
- Backend: `GET /health`
- Frontend: Built-in Next.js health monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow PEP 8 for Python code
- Use TypeScript for frontend development
- Write tests for new features
- Update documentation as needed
- Follow conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

If you encounter any issues:

1. Check the [Issues](https://github.com/your-repo/issues) page
2. Review the [Documentation](http://localhost:8000/docs)
3. Contact support at support@labmate-ai.com

## 🙏 Acknowledgments

- Built with [FastAPI](https://fastapi.tiangolo.com/)
- Frontend powered by [Next.js](https://nextjs.org/)
- Styling with [TailwindCSS](https://tailwindcss.com/)
- Icons from [Lucide](https://lucide.dev/)
- Code execution via [Docker](https://www.docker.com/)
