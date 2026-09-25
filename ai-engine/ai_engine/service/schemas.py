"""Pydantic request/response schemas for the AI engine service."""

from typing import List, Optional, Dict

from pydantic import BaseModel, ConfigDict


class InteractionLog(BaseModel):
    """A single learner interaction, mirroring the raw data columns."""
    user_id: str
    timestamp: str
    topic: str
    exercise_id: Optional[str] = None
    exercise_type: str
    difficulty: str
    user_answer: Optional[str] = ''
    correct_answer: Optional[str] = ''
    is_correct: int
    time_spent_ms: Optional[float] = None
    hearts_before: Optional[int] = 5
    session_index: Optional[int] = 0


class DifficultyRequest(BaseModel):
    history: List[InteractionLog]
    current_topic: str
    current_difficulty: str = 'Beginner'


class DifficultyResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    probability_correct: float
    recommended_difficulty: str
    reason: str
    model_used: str


class GradeRequest(BaseModel):
    user_answer: str
    expected_answer: str


class GradeResponse(BaseModel):
    similarity: float
    verdict: str
    partial_credit_xp: int
    hint: str
    reason: str


class RecommendRequest(BaseModel):
    learner_profile: Dict[str, float]
    candidate_topics: List[str]
    k: int = 3


class RecommendItem(BaseModel):
    topic: str
    score: float
    reason: str


class RecommendResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    recommendations: List[RecommendItem]
    model_used: str


class HealthResponse(BaseModel):
    status: str
    models_loaded: bool
    models: Dict[str, str]


class InsightsResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    user_id: str
    per_topic_mastery: Dict[str, float]
    weak_topics: List[str]
    predicted_next_difficulty: str
    reason: str
    recommended_topics: List[RecommendItem]
    model_information: Dict[str, str]