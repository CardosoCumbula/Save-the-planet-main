#!/usr/bin/env bash
# Run the full ML pipeline then start the FastAPI service on port 8000.
set -e
cd "$(dirname "$0")"

if [ ! -d ".venv" ]; then
  echo "No virtual environment found. Create one with: python -m venv .venv"
  exit 1
fi

source .venv/bin/activate
python -m ai_engine.pipeline.run_all
uvicorn ai_engine.service.api:app --reload --port 8000