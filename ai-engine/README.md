# EcoQuest AI Engine

This repository contains a lightweight, reproducible machine-learning pipeline
that powers the **EcoQuest: Learn & Save the Planet** web application.

The Python package `ai_engine` implements the full ML lifecycle:

- Data simulation and preparation (`ai_engine.data`) — synthetic learner
  interactions with realistic data-quality problems, cleaned and split by user
  to avoid leakage.
- Feature engineering (`ai_engine.data.features`) — mastery features built from
  prior attempts only.
- Three models (`ai_engine.models`):
  - **Mastery** (logistic regression) — predicts next-answer correctness.
  - **Answer grader** (TF-IDF + similarity + logistic regression) — CORRECT /
    ALMOST / WRONG free-text grading.
  - **Topic recommender** (TF-IDF + cosine content-based) — ranks next topics.
- Evaluation and reporting (`ai_engine.evaluation`) — metrics, figures and
  model cards written to `reports/`.
- End-to-end orchestration (`ai_engine.pipeline.run_all`).
- FastAPI service exposing the models (`ai_engine.service`) on `localhost:8000`.

The accompanying React frontend integrates through
`services/aiEngineService.ts`, with a cached health check and offline fallback.

## Quick start

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate    Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
python -m ai_engine.pipeline.run_all
uvicorn ai_engine.service.api:app --reload --port 8000
```

## Testing

```bash
pytest
pytest --cov=ai_engine
```

See `docs/` for the methodology, feature matrix, architecture, setup guide and
project proposal.
