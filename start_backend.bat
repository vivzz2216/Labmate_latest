@echo off
title Labmate - Backend (FastAPI)
cd /d "%~dp0backend"
if exist .venv\Scripts\uvicorn.exe (
    echo Starting FastAPI backend on port 8000 using .venv...
    .venv\Scripts\uvicorn.exe app.main:app --reload --port 8000
) else (
    echo Starting FastAPI backend on port 8000...
    uvicorn app.main:app --reload --port 8000
)
pause
