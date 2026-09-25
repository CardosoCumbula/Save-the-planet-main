import logging
from pathlib import Path

# Base directory of the repo (ai-engine folder)
BASE_DIR = Path(__file__).resolve().parent.parent

# Data directories
DATA_RAW_DIR = BASE_DIR / 'data' / 'raw'
DATA_PROCESSED_DIR = BASE_DIR / 'data' / 'processed'

# Reports and artifacts directories
REPORTS_DIR = BASE_DIR / 'reports'
METRICS_DIR = REPORTS_DIR / 'metrics'
FIGURES_DIR = REPORTS_DIR / 'figures'
MODEL_CARDS_DIR = REPORTS_DIR / 'model_cards'
ARTIFACTS_DIR = BASE_DIR / 'artifacts'

# Ensure directories exist
for _dir in [
    DATA_RAW_DIR, DATA_PROCESSED_DIR,
    METRICS_DIR, FIGURES_DIR, MODEL_CARDS_DIR,
    ARTIFACTS_DIR,
]:
    _dir.mkdir(parents=True, exist_ok=True)

# Random seed for reproducible results
RANDOM_SEED = 42

# ---------------------------------------------------------------------------
# File paths
# ---------------------------------------------------------------------------
RAW_INTERACTIONS = DATA_RAW_DIR / 'interactions.csv'
LIVE_INTERACTIONS = DATA_RAW_DIR / 'live_interactions.csv'
TRAIN_FILE = DATA_PROCESSED_DIR / 'train.csv'
VALIDATION_FILE = DATA_PROCESSED_DIR / 'validation.csv'
TEST_FILE = DATA_PROCESSED_DIR / 'test.csv'

MASTERY_MODEL_FILE = ARTIFACTS_DIR / 'mastery_model.joblib'
MASTERY_METADATA_FILE = ARTIFACTS_DIR / 'mastery_metadata.json'

DATA_PROFILE_FILE = METRICS_DIR / 'data_profile.json'
MASTERY_METRICS_JSON = METRICS_DIR / 'mastery_metrics.json'
SUMMARY_CSV = METRICS_DIR / 'summary.csv'

MASTERY_MODEL_CARD = MODEL_CARDS_DIR / 'mastery.md'

# ---------------------------------------------------------------------------
# Domain vocabulary (kept in sync with the React application)
# ---------------------------------------------------------------------------
# Exercise types used by the app, see src/types.ts
EXERCISE_TYPES = [
    'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK',
    'SPEAKING', 'SCENARIO', 'SORTING',
]

# Ecology topics used by the simulation and the recommender
TOPICS = [
    'Recycling', 'Composting', 'Water Conservation', 'Renewable Energy',
    'Biodiversity', 'Climate Change', 'Waste Management',
    'Sustainable Agriculture', 'Forests', 'Ocean Conservation',
]

DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced']

# ---------------------------------------------------------------------------
# Dataset split (by user_id to prevent leakage)
# ---------------------------------------------------------------------------
TRAIN_RATIO = 0.70
VALIDATION_RATIO = 0.15
TEST_RATIO = 0.15

# ---------------------------------------------------------------------------
# Mastery model configuration
# ---------------------------------------------------------------------------
# Difficulty thresholds for the adaptive logic (probability of a correct answer)
THRESHOLD_ADVANCED = 0.80
THRESHOLD_INTERMEDIATE = 0.45
# TODO: revisit this threshold once we have real user data.

MASTERY_MODEL_PARAMS = {
    'C': 1.0,
    'solver': 'lbfgs',
    'max_iter': 500,
    'random_state': RANDOM_SEED,
}

MASTERY_FOREST_PARAMS = {
    'n_estimators': 150,
    'max_depth': 6,
    'random_state': RANDOM_SEED,
    'n_jobs': -1,
}

MODEL_VERSION = '0.1.0'

# ---------------------------------------------------------------------------
# Answer grader configuration
# ---------------------------------------------------------------------------
GRADER_MODEL_FILE = ARTIFACTS_DIR / 'grader_model.joblib'
GRADER_VECTORIZER_FILE = ARTIFACTS_DIR / 'grader_vectorizer.joblib'
GRADER_METADATA_FILE = ARTIFACTS_DIR / 'grader_metadata.json'
GRADER_PAIRS_RAW = DATA_RAW_DIR / 'grader_pairs.csv'

GRADER_METRICS_JSON = METRICS_DIR / 'grader_metrics.json'
GRADER_MODEL_CARD = MODEL_CARDS_DIR / 'grader.md'

GRADER_MODEL_PARAMS = {
    'C': 1.2,
    'solver': 'lbfgs',
    'max_iter': 500,
    'random_state': RANDOM_SEED,
}

# Partial credit for ALMOST verdicts (a fraction of a full lesson's XP).
POSITIVE_XP = 20
ALMOST_XP = 5
# TODO: revisit this threshold once we have real user data.
GRADE_CORRECT_THRESHOLD = 0.65
GRADE_ALMOST_THRESHOLD = 0.40

# ---------------------------------------------------------------------------
# Topic recommender configuration
# ---------------------------------------------------------------------------
RECOMMENDER_ARTIFACT = ARTIFACTS_DIR / 'recommender.joblib'
RECOMMENDER_METRICS_JSON = METRICS_DIR / 'recommender_metrics.json'
RECOMMENDER_MODEL_CARD = MODEL_CARDS_DIR / 'recommender.md'

# Weights for the candidate score: topic similarity + weakness + difficulty fit.
# These are initial values, not scientific truths; they should be tuned using
# real learner data later.
SIMILARITY_WEIGHT = 0.5
MASTERY_WEIGHT = 0.3
WEAKNESS_WEIGHT = 0.2

# ---------------------------------------------------------------------------
# Logging configuration
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
