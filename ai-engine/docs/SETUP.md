# Setup

These are the exact commands to run the whole project. This workspace contains
two folders:

- `Save-the-planet-main/` — the React application.
- `ai-engine/` — the Python ML layer.

## Frontend

```bash
# in the Save-the-planet-main folder
npm install
npm run dev
```

The dev server runs on `http://localhost:3000` (see `vite.config.ts`). Create a
`.env` file there if you want to override the AI engine URL:

```bash
echo VITE_AI_ENGINE_URL=http://localhost:8000
```

> Do not commit secrets. The Gemma API key is loaded via `VITE_GEMINI_API_KEY`
> (using `import.meta.env`) from a local `.env.local` file in the frontend folder.

## Backend (Python)

```bash
cd ai-engine
python -m venv .venv
```

### Windows

```bash
.venv\Scripts\activate
pip install -r requirements.txt
python -m ai_engine.pipeline.run_all
uvicorn ai_engine.service.api:app --reload --port 8000
```

### Linux / macOS

```bash
source .venv/bin/activate
pip install -r requirements.txt
python -m ai_engine.pipeline.run_all
uvicorn ai_engine.service.api:app --reload --port 8000
```

`run_all` generates data, cleans it, trains and evaluates all three models, and
writes reports. `uvicorn` starts the FastAPI service on port 8000.

## Testing

```bash
# from ai-engine
pytest
```

With coverage:

```bash
pytest --cov=ai_engine
```

## Endpoints

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET    | `/health`                          | availability + model versions |
| POST   | `/predict/difficulty-for-user`     | adaptive difficulty |
| POST   | `/grade/answer`                    | free-text grading |
| POST   | `/recommend/topics`                | topic recommendation |
| POST   | `/log/interaction`                 | interaction logging |
| GET    | `/insights/{user_id}`              | per-user ML insights |

## Optional helper scripts

- `ai-engine/run_dev.bat` / `run_dev.sh` — shortcut to start the API.
- `python -m ai_engine.tools.export_code` — export source into
  `submission/CODE_SUBMISSION.txt` / `.docx`.

## Requirements

Only mainstream, lightweight libraries are used (see `ai-engine/requirements.txt`):
fastapi, uvicorn, pydantic, pandas, numpy, scikit-learn, joblib, matplotlib,
python-docx, pytest. No deep-learning or GPU libraries.