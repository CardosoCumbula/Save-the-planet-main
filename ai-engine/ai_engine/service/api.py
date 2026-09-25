"""FastAPI service that exposes the trained scikit-learn models.

Models are loaded once at startup and reused for every request. If an artifact
is missing the API stays up and returns a clear fallback response instead of
crashing. This lets the React frontend keep working even when the Python
service (or a model) is unavailable.
"""

import csv
import datetime
import logging
import threading

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from ai_engine import config
from ai_engine.data import features
from ai_engine.models import grader as grader_module
from ai_engine.models import mastery as mastery_module
from ai_engine.models import recommender as recommender_module
from ai_engine.service.schemas import (
    DifficultyRequest, DifficultyResponse, GradeRequest, GradeResponse,
    HealthResponse, InsightsResponse, RecommendRequest, RecommendResponse,
    RecommendItem, InteractionLog,
)

logger = logging.getLogger(__name__)

app = FastAPI(title='EcoQuest AI Engine', version=config.MODEL_VERSION)

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://192.168.56.1:3001",
        "https://save-the-planet-main.vercel.app",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
_live_lock = threading.Lock()

def _load_models():
    """Load all available artifacts once. Missing ones stay None."""
    models = {'mastery': None, 'grader': None, 'recommender': None}
    try:
        models['mastery'] = mastery_module.MasteryModel.load()
    except Exception as exc:  # artifact missing or corrupt, keep going
        logger.warning('Mastery model not loaded: %s', exc)
    try:
        models['grader'] = grader_module.GraderModel.load()
    except Exception as exc:
        logger.warning('Grader model not loaded: %s', exc)
    try:
        models['recommender'] = recommender_module.RecommenderModel.load()
    except Exception as exc:
        logger.warning('Recommender not loaded: %s', exc)
    return models


_models = _load_models()
_started_at = datetime.datetime.now(datetime.timezone.utc)


def _model_names():
    def name(model, default):
        return model.metadata.get('algorithm', default) if model else default
    return {
        'mastery': name(_models['mastery'], 'LogisticRegression'),
        'grader': name(_models['grader'], 'LogisticRegression + TF-IDF'),
        'recommender': name(_models['recommender'], 'TFIDFContentBased'),
    }


@app.get('/health', response_model=HealthResponse)
def health():
    """Simple heartbeat used by the frontend to detect availability."""
    return HealthResponse(
        status='ok',
        models_loaded=all(_models.values()),
        models=_model_names(),
    )


def _feature_row_from_history(history_data):
    """Build a mastery feature DataFrame from a learner's interaction history.

    Timestamps that cannot be parsed are dropped here, matching the cleaning
    used during training (prepare.py). This keeps NaN out of the feature matrix
    so LogisticRegression never sees missing values.
    """
    df = pd.DataFrame(history_data)
    df = df.dropna(subset=['user_id']).copy()
    df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
    # Same rule as training: only keep rows with a real timestamp.
    df = df[df['timestamp'].notna()]

    if len(df) == 0:
        return pd.DataFrame()

    df['topic'] = df['topic'].astype(str)
    df['difficulty'] = df['difficulty'].astype(str)
    df['exercise_type'] = df['exercise_type'].astype(str)
    df['session_index'] = df.get('session_index', 0).fillna(0)
    df['is_correct'] = df['is_correct'].astype(int)
    X, _ = features.build_mastery_features(df)
    return X


@app.post('/predict/difficulty-for-user', response_model=DifficultyResponse)
def predict_difficulty(request: DifficultyRequest):
    """Recommend a difficulty using the trained mastery model."""
    if _models['mastery'] is None or not request.history:
        return DifficultyResponse(
            probability_correct=0.5,
            recommended_difficulty=request.current_difficulty,
            reason='AI service unavailable; using the default difficulty.',
            model_used='fallback-heuristic',
        )
    X = _feature_row_from_history([item.model_dump() for item in request.history])
    if len(X) == 0:
        # Brand-new learner, or a history with no usable timestamps: fall back to
        # the requested difficulty instead of failing. No performance is invented.
        return DifficultyResponse(
            probability_correct=0.5,
            recommended_difficulty=request.current_difficulty,
            reason='Not enough usable interaction history; using the requested difficulty.',
            model_used='fallback-heuristic',
        )
    prob = float(_models['mastery'].predict_proba(X.iloc[[-1]])[0])
    difficulty = _models['mastery'].predict_difficulty(prob)
    reason = _models['mastery'].explain(prob, X.iloc[-1])
    return DifficultyResponse(
        probability_correct=round(prob, 3),
        recommended_difficulty=difficulty,
        reason=reason,
        model_used='LogisticRegression (ML)',
    )


@app.post('/grade/answer', response_model=GradeResponse)
def grade_answer(request: GradeRequest):
    """Grade a free-text answer using the trained similarity classifier."""
    exact = request.user_answer.strip().lower() == request.expected_answer.strip().lower()
    if _models['grader'] is None:
        return GradeResponse(
            similarity=1.0 if exact else 0.0,
            verdict='CORRECT' if exact else 'WRONG',
            partial_credit_xp=config.POSITIVE_XP if exact else 0,
            hint='',
            reason='AI service unavailable; using exact-match grading.',
        )
    result = _models['grader'].grade(request.user_answer, request.expected_answer)
    return GradeResponse(**result)


@app.post('/recommend/topics', response_model=RecommendResponse)
def recommend_topics(request: RecommendRequest):
    """Rank candidate topics for a learner with the content recommender."""
    if _models['recommender'] is None:
        return RecommendResponse(
            recommendations=[
                RecommendItem(topic=topic, score=0.0,
                              reason='AI service unavailable; original order kept.')
                for topic in request.candidate_topics[:request.k]
            ],
            model_used='fallback-original-order',
        )
    items = _models['recommender'].recommend(
        request.learner_profile, request.candidate_topics, k=request.k)
    return RecommendResponse(recommendations=items, model_used='TFIDFContentBased')


@app.post('/log/interaction')
def log_interaction(request: InteractionLog):
    """Append one interaction to the live log for future retraining."""
    record = request.model_dump()
    with _live_lock:
        path = config.LIVE_INTERACTIONS
        path.parent.mkdir(parents=True, exist_ok=True)
        write_header = not path.exists()
        with open(path, 'a', newline='', encoding='utf-8') as handle:
            writer = csv.DictWriter(handle, fieldnames=list(record.keys()))
            if write_header:
                writer.writeheader()
            writer.writerow(record)
    return {'status': 'logged'}
@app.get('/insights/{user_id}', response_model=InsightsResponse)
def insights(user_id: str):
    """Per-topic mastery, weak topics and recommendations for a learner."""
    topics_df = _load_user_interactions(user_id)
    if topics_df is None:
        raise HTTPException(status_code=404, detail='No interactions found for this user')

    mastery = topics_df.groupby('topic')['is_correct'].mean().to_dict()
    weak = [topic for topic, acc in mastery.items() if acc < 0.6][:5]

    if _models['mastery'] is not None:
        X = _feature_row_from_history(topics_df.to_dict('records'))
        prob = float(_models['mastery'].predict_proba(X.iloc[[-1]])[0])
        next_difficulty = _models['mastery'].predict_difficulty(prob)
        reason = _models['mastery'].explain(prob, X.iloc[-1])
    else:
        prob, next_difficulty = 0.5, 'Beginner'
        reason = 'AI service unavailable; defaulting to Beginner.'

    if _models['recommender'] is not None:
        recommended = _models['recommender'].recommend(mastery, list(config.TOPICS), k=3)
    else:
        recommended = [RecommendItem(topic=t, score=0.0,
                                     reason='AI service unavailable')
                       for t in config.TOPICS[:3]]
    recommended = [r if isinstance(r, RecommendItem) else RecommendItem(**r)
                   for r in recommended]

    return InsightsResponse(
        user_id=user_id,
        per_topic_mastery={k: round(v, 3) for k, v in mastery.items()},
        weak_topics=weak,
        predicted_next_difficulty=next_difficulty,
        reason=reason,
        recommended_topics=recommended,
        model_information=_model_names(),
    )


def _load_user_interactions(user_id):
    """Gather a user's cleaned interactions from the processed splits."""
    frames = []
    for path in [config.TRAIN_FILE, config.VALIDATION_FILE, config.TEST_FILE]:
        if path.exists():
            frame = pd.read_csv(path, dtype={'user_id': str})
            frames.append(frame[frame['user_id'] == user_id])
    if not frames or all(f.empty for f in frames):
        return None
    return pd.concat(frames, ignore_index=True)
    return X