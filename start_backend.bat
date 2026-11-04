@echo off
title Labmate - Backend (FastAPI)
cd /d "%~dp0backend"
set "PYTHONPATH=%~dp0backend\.venv\Lib\site-packages;%~dp0backend"
set "PATH=C:\Users\pilla\AppData\Local\Python\pythoncore-3.14-64;C:\Users\pilla\AppData\Local\Python\pythoncore-3.14-64\DLLs;%PATH%"
echo Starting FastAPI backend on port 8000...
python -m uvicorn app.main:app --reload --port 8000
pause
