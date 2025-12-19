from pydantic_settings import BaseSettings
from pydantic import ConfigDict, field_validator
from typing import Optional
import os


class Settings(BaseSettings):
    # Ignore extra fields from .env to prevent validation crashes in pytest
    model_config = ConfigDict(extra="ignore", env_file=".env")


    # Database - Railway will provide DATABASE_URL environment variable
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    
    if not DATABASE_URL:
        print("⚠ WARNING: DATABASE_URL is not set! Database features will not work.")
        print("Please set DATABASE_URL in Railway environment variables.")
    
    # Security
    BETA_KEY: str = os.getenv("BETA_KEY", "")
    _default_secret = os.urandom(32).hex() if not os.getenv("SECRET_KEY") else None
    SECRET_KEY: str = os.getenv("SECRET_KEY", _default_secret or "")
    
    if not BETA_KEY:
        print("⚠ WARNING: BETA_KEY is not set! API access will be restricted.")
    if not SECRET_KEY:
        print("⚠ WARNING: SECRET_KEY is not set! Session security will be compromised.")
    elif _default_secret:
        print("⚠ WARNING: Using auto-generated SECRET_KEY for development. Set SECRET_KEY env var!")
    
    # CORS settings
    ALLOWED_ORIGINS: list = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_MAX_AGE: int = 600
    
    # File paths
    UPLOAD_DIR: str = "/app/uploads"
    SCREENSHOT_DIR: str = "/app/screenshots"
    REPORT_DIR: str = "/app/reports"
    REACT_TEMP_DIR: str = "/app/react_temp"
    HOST_PROJECT_ROOT: str = os.getenv("HOST_PROJECT_ROOT", os.getcwd())
    
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

    # Claude settings
    CLAUDE_API_KEY: str = os.getenv("CLAUDE_API_KEY", "")
    CLAUDE_MODEL: str = os.getenv("CLAUDE_MODEL", "claude-3-5-sonnet-20241022")
    CLAUDE_MAX_TOKENS: int = int(os.getenv("CLAUDE_MAX_TOKENS", "2000"))
    CLAUDE_REQUEST_TIMEOUT: int = int(os.getenv("CLAUDE_REQUEST_TIMEOUT", "45"))

    if not CLAUDE_API_KEY:
        print("⚠ WARNING: CLAUDE_API_KEY is not set! AI code review will run in fallback mode.")
    
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
    ADMIN_USERID: str = os.getenv("ADMIN_USERID", "2216")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "percolate")
    
    @field_validator('RATE_LIMIT_ENABLED', mode='before')
    @classmethod
    def parse_rate_limit_enabled(cls, v):
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.lower().strip() == "true"
        return False
    



settings = Settings()
