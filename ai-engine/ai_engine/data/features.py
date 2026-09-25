"""Feature engineering for the learner mastery model.

Features describe the state right *before* each exercise is answered, so they
only use information available up to and including the previous attempt.

The target (``is_correct``) is deliberately excluded from the feature matrix:
including it would let the model "cheat" by reading the answer it is trying to
predict (target leakage).
"""

import numpy as np
import pandas as pd

from ai_engine import config

# Stable, human-readable order for the continuous features.
NUMERIC_FEATURES = [
    'overall_accuracy', 'topic_accuracy', 'topic_attempts', 'correct_streak',
    'session_position', 'time_since_bucket', 'hour_bucket',
]

DIFFICULTY_LEVELS = ['Beginner', 'Intermediate', 'Advanced']


def _features_for_user(group: pd.DataFrame) -> pd.DataFrame:
    """Build the mastery feature rows for a single learner's history."""
    group = group.sort_values('timestamp').reset_index(drop=True)
    n = len(group)
    correct = group['is_correct'].to_numpy()

    # Counts computed over prior attempts only (shifted by one row).
    overall_prior = group['is_correct'].shift().fillna(0).cumsum().to_numpy()
    total_prior = np.arange(n)
    overall_acc = np.where(total_prior == 0, 0.5,
                           overall_prior / np.maximum(total_prior, 1))

    topic_prior = group.groupby('topic')['is_correct'].transform(
        lambda x: x.shift().fillna(0).cumsum()
    ).to_numpy()
    topic_attempts = group.groupby('topic').cumcount().to_numpy()
    topic_acc = np.where(topic_attempts == 0, 0.5, topic_prior / np.maximum(topic_attempts, 1))

    # Length of the run of correct answers immediately before this exercise.
    streak = []
    run = 0
    for value in correct:
        streak.append(run)
        run = run + 1 if value == 1 else 0

    delta_s = group['timestamp'].diff().dt.total_seconds().fillna(0).to_numpy()
    time_since_bucket = np.digitize(delta_s, [60, 600, 3600])
    hour_bucket = group['timestamp'].dt.hour.floordiv(6).to_numpy()
    session_position = group.groupby('session_index').cumcount().to_numpy() + 1

    difficulty_code = group['difficulty'].map(
        {level: i for i, level in enumerate(DIFFICULTY_LEVELS)}
    ).fillna(1).astype(int).to_numpy()

    out = pd.DataFrame({
        'overall_accuracy': overall_acc,
        'topic_accuracy': topic_acc,
        'topic_attempts': topic_attempts,
        'correct_streak': np.array(streak),
        'session_position': session_position,
        'time_since_bucket': time_since_bucket,
        'hour_bucket': hour_bucket,
    })

    for i, level in enumerate(DIFFICULTY_LEVELS):
        out[f'd_{level}'] = (difficulty_code == i).astype(int)
    for etype in config.EXERCISE_TYPES:
        out[f'type_{etype}'] = (group['exercise_type'] == etype).astype(int)

    return out


def build_mastery_features(df: pd.DataFrame):
    """Build the mastery feature matrix and its stable column order."""
    df = df.copy()
    df['timestamp'] = pd.to_datetime(df['timestamp'])

    frames = []
    for _, group in df.groupby('user_id', sort=False):
        frames.append(_features_for_user(group))
    X = pd.concat(frames, ignore_index=True)

    feature_columns = (
        NUMERIC_FEATURES
        + [f'd_{level}' for level in DIFFICULTY_LEVELS]
        + [f'type_{etype}' for etype in config.EXERCISE_TYPES]
    )
    # Keep a fixed column order so the trained model always sees consistent input.
    X = X[feature_columns]
    return X, feature_columns