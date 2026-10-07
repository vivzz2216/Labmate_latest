from pydantic_settings import BaseSettings
from pydantic import ConfigDict, field_validator
from typing import Optional
import os


class Settings(BaseSettings):
    # Ignore extra fields from .env to prevent validation crashes in pytest
    model_config = ConfigDict(extra="ignore", env_file=".env")


    # Database - Railway will provide DATABASE_URL environment variable
    # Railway Postgres plugin typically provides DATABASE_URL to the *service you attach it to*.
    # Some setups expose DATABASE_PUBLIC_URL instead; accept it as a fallback for robustness.
    DATABASE_URL: str = os.getenv("DATABASE_URL") or os.getenv("DATABASE_PUBLIC_URL", "")
    
    if not DATABASE_URL:
        print("[WARNING] DATABASE_URL is not set! Database features will not work.")
        print("Please set DATABASE_URL in Railway environment variables.")
    
    # Security
    BETA_KEY: str = os.getenv("BETA_KEY", "")
    _default_secret = os.urandom(32).hex() if not os.getenv("SECRET_KEY") else None
    SECRET_KEY: str = os.getenv("SECRET_KEY", _default_secret or "")
    
    if not BETA_KEY:
        print("[WARNING] BETA_KEY is not set! API access will be restricted.")
    if not SECRET_KEY:
        print("[WARNING] SECRET_KEY is not set! Session security will be compromised.")
    elif _default_secret:
        print("[WARNING] Using auto-generated SECRET_KEY for development. Set SECRET_KEY env var!")
    
    # CORS settings
    # IMPORTANT (Railway-friendly):
    # Pydantic treats list fields as "complex" env vars and expects JSON (e.g. ["https://a.com"]).
    # In Railway you typically paste a plain string. We store it as a string and split it ourselves.
    ALLOWED_ORIGINS: str = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_MAX_AGE: int = 600
    
    # File paths
    UPLOAD_DIR: str = "/app/uploads"
    SCREENSHOT_DIR: str = "/app/screenshots"
    REPORT_DIR: str = "/app/reports"
    REACT_TEMP_DIR: str = "/app/react_temp"
    HOST_PROJECT_ROOT: str = os.getenv("HOST_PROJECT_ROOT", os.getcwd())
    
    # Durable Object Storage (Cloudflare R2 / AWS S3)
    STORAGE_BACKEND: str = os.getenv("STORAGE_BACKEND", "local")  # "local" or "s3"
    S3_ENDPOINT_URL: str = os.getenv("S3_ENDPOINT_URL", "")
    S3_ACCESS_KEY_ID: str = os.getenv("S3_ACCESS_KEY_ID", "")
    S3_SECRET_ACCESS_KEY: str = os.getenv("S3_SECRET_ACCESS_KEY", "")
    S3_BUCKET_NAME: str = os.getenv("S3_BUCKET_NAME", "labmate-storage")
    S3_REGION_NAME: str = os.getenv("S3_REGION_NAME", "auto")
    S3_PUBLIC_URL_PREFIX: str = os.getenv("S3_PUBLIC_URL_PREFIX", "")
    
    # Docker settings
    DOCKER_IMAGE: str = "python:3.10-slim"
    CONTAINER_TIMEOUT: int = 30
    MEMORY_LIMIT: str = "512m"
    CPU_PERIOD: int = 100000
    CPU_QUOTA: int = 50000
    
    # File limits
    MAX_FILE_SIZE: int = 50 * 1024 * 1024
    MAX_CODE_LENGTH: int = 5000
    
    # OpenAI settings
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_MAX_TOKENS: int = 4000

    # Server-only Gemini credentials. Never expose these as NEXT_PUBLIC variables.
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.8-flash"
    GEMINI_REQUEST_TIMEOUT: int = 90
    GEMINI_RETRY_ATTEMPTS: int = 8
    GEMINI_RETRY_BASE_DELAY: float = 1.0
    GEMINI_RETRY_MAX_DELAY: float = 30.0
    # Explicit provider selection; all credentials stay on the backend.
    LLM_PROVIDER: str = "gemini"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    GROQ_REQUEST_TIMEOUT: int = 90
    GROQ_RETRY_ATTEMPTS: int = 8
    GROQ_RETRY_BASE_DELAY: float = 1.0
    GROQ_RETRY_MAX_DELAY: float = 30.0
    DB_POOL_SIZE: int = 5
    DB_POOL_MAX_OVERFLOW: int = 5
    WORKFLOW_WORKERS: int = 2
    WORKFLOW_QUEUE_LIMIT: int = 1000
    WORKFLOW_USER_QUEUE_LIMIT: int = 25
    WORKFLOW_STALE_SECONDS: int = 1800
    EXECUTION_TIMEOUT: float = 30.0
    COMPILATION_TIMEOUT: float = 30.0
    EXECUTION_MAX_OUTPUT_BYTES: int = 1048576
    JAVA_COMMAND: str = "java"
    JAVAC_COMMAND: str = "javac"
    C_COMPILER: str = "gcc"
    CPP_COMPILER: str = "g++"
    NODE_COMMAND: str = "node"

    # Claude settings
    CLAUDE_API_KEY: str = os.getenv("CLAUDE_API_KEY", "")
    CLAUDE_MODEL: str = os.getenv("CLAUDE_MODEL", "claude-3-5-sonnet-20241022")
    CLAUDE_MAX_TOKENS: int = int(os.getenv("CLAUDE_MAX_TOKENS", "2000"))
    CLAUDE_REQUEST_TIMEOUT: int = int(os.getenv("CLAUDE_REQUEST_TIMEOUT", "45"))

    if not CLAUDE_API_KEY:
        print("[WARNING] CLAUDE_API_KEY is not set! AI code review will run in fallback mode.")
    
    # Web settings
    WEB_EXECUTION_TIMEOUT_HTML: int = 10
    WEB_EXECUTION_TIMEOUT_REACT: int = 60
    WEB_EXECUTION_TIMEOUT_NODE: int = 30
    WHITELISTED_NPM_PACKAGES: list = ["express", "react", "react-dom", "vite"]
    
    # React
    REACT_EXECUTION_TIMEOUT: int = 120
    REACT_MULTI_ROUTE_CAPTURE: bool = True
    REACT_DEFAULT_ROUTES: list = ["/", "/about", "/contact"]
    
    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    REDIS_CACHE_TTL: int = 3600
    
    # Rate limiting
    RATE_LIMIT_ENABLED: bool = False
    RATE_LIMIT_PER_MINUTE: int = 1000

    # Admin dashboard (Basic Auth)
    # NOTE: Set these in production via env vars.
    # No default admin account: explicitly provision both credentials.
    ADMIN_USERID: str = ""
    ADMIN_PASSWORD: str = ""

    # Frontend URL (used for redirects when frontend is deployed separately)
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "")
    
    @field_validator('RATE_LIMIT_ENABLED', mode='before')
    @classmethod
    def parse_rate_limit_enabled(cls, v):
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.lower().strip() == "true"
        return False
    



settings = Settings()
