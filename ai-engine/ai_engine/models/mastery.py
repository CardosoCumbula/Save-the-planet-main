"""Learner mastery prediction (binary classification).

Our primary model is a logistic regression. It is interpretable, fast on CPU,
and well suited to the small synthetic dataset we train on, which makes it
easy to explain in a report. We compare it against a random forest and two
simple baselines (majority class and global accuracy heuristic).
"""

import datetime
import json

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier

from ai_engine import config

logger = config.logging.getLogger(__name__)


def difficulty_from_probability(prob: float) -> str:
    """Turn a predicted correct probability into a difficulty label."""
    if prob > config.THRESHOLD_ADVANCED:
        return 'Advanced'
    if prob >= config.THRESHOLD_INTERMEDIATE:
        return 'Intermediate'
    return 'Beginner'


def train_logistic_regression(X: np.ndarray, y: np.ndarray) -> LogisticRegression:
    """Train the primary mastery classifier."""
    model = LogisticRegression(**config.MASTERY_MODEL_PARAMS)
    model.fit(X, y)
    return model


def train_random_forest(X: np.ndarray, y: np.ndarray) -> RandomForestClassifier:
    """Train the comparison random forest guarantee."""
    model = RandomForestClassifier(**config.MASTERY_FOREST_PARAMS)
    model.fit(X, y)
    return model


class MasteryModel:
    """Trained mastery model plus the metadata needed to use and explain it."""

    def __init__(self, model, feature_names, algorithm='LogisticRegression'):
        self.model = model
        self.feature_names = list(feature_names)
        self.algorithm = algorithm
        self.metadata = {
            'algorithm': algorithm,
            'model_version': config.MODEL_VERSION,
            'training_date': datetime.date.today().isoformat(),
            'feature_names': self.feature_names,
            'thresholds': {
                'advanced': config.THRESHOLD_ADVANCED,
                'intermediate': config.THRESHOLD_INTERMEDIATE,
            },
        }

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """Return the probability of a correct answer for each row."""
        return self.model.predict_proba(X)[:, 1]

    def predict_difficulty(self, prob: float) -> str:
        """Map a single correct-probability to a recommended difficulty."""
        return difficulty_from_probability(prob)

    def explain(self, prob: float, row: pd.Series) -> str:
        """Return a short, human-readable reason for the recommendation."""
        difficulty = self.predict_difficulty(prob)
        topic_acc = float(row.get('topic_accuracy', 0.5)) * 100
        streak = int(row.get('correct_streak', 0))
        return (
            f"Serving {difficulty}: {prob * 100:.0f}% predicted success "
            f"based on your recent topic accuracy ({topic_acc:.0f}%) "
            f"and current streak ({streak})."
        )

    def save(self, model_path=None, metadata_path=None):
        """Persist the model and its metadata to disk."""
        model_path = model_path or config.MASTERY_MODEL_FILE
        metadata_path = metadata_path or config.MASTERY_METADATA_FILE
        joblib.dump({'model': self.model, 'metadata': self.metadata}, model_path)
        metadata_path.write_text(json.dumps(self.metadata, indent=2))
        logger.info('Saved mastery model to %s', model_path)

    @classmethod
    def load(cls, path=None):
        """Load a previously trained MasteryModel from disk."""
        path = path or config.MASTERY_MODEL_FILE
        payload = joblib.load(path)
        return cls(payload['model'], payload['metadata']['feature_names'],
                   payload['metadata']['algorithm'])


def train_mastery(X_train, y_train, feature_names=None):
    """Train and wrap the logistic regression mastery model."""
    model = train_logistic_regression(X_train, y_train)
    if feature_names is None:
        feature_names = [f'f{i}' for i in range(X_train.shape[1])]
    return MasteryModel(model, feature_names, algorithm='LogisticRegression')