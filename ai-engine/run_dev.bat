@echo off
REM Run the full ML pipeline then start the FastAPI service on port 8000.
cd /d "%~dp0"

if exist ".venv\Scripts\activate.bat" (
    call ".venv\Scripts\activate.bat"
) else (
    echo No virtual environment found. Create one with: python -m venv .venv
    exit /b 1
)

python -m ai_engine.pipeline.run_all
if errorlevel 1 (
    echo Pipeline failed.
    exit /b 1
)

uvicorn ai_engine.service.api:app --reload --port 8000