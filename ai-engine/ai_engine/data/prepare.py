"""Load, profile and clean interaction data, then split it by learner.

The final split is performed on ``user_id`` rather than on individual rows.
Splitting row-by-row would allow the model to see the same learner in both
training and testing (indirect leakage), which overstates performance.
"""

import json
import logging

import numpy as np
import pandas as pd

from ai_engine import config

logger = logging.getLogger(__name__)

DATA_COLUMNS = [
    'user_id', 'timestamp', 'topic', 'exercise_id', 'exercise_type',
    'difficulty', 'user_answer', 'correct_answer', 'is_correct',
    'time_spent_ms', 'hearts_before', 'session_index',
]


def load_raw_data() -> pd.DataFrame:
    """Load the raw synthetic data plus any live logs that exist."""
    frames = []
    if config.RAW_INTERACTIONS.exists():
        frames.append(pd.read_csv(config.RAW_INTERACTIONS, dtype={'user_id': str}))

    if config.LIVE_INTERACTIONS.exists():
        live = pd.read_csv(config.LIVE_INTERACTIONS, dtype={'user_id': str})
        live['source'] = 'live'
        frames.append(live)

    if not frames:
        raise FileNotFoundError(f'No interaction data found in {config.DATA_RAW_DIR}')

    df = pd.concat(frames, ignore_index=True)
    if 'source' not in df.columns:
        df['source'] = 'synthetic'
    return df


def profile_data(df: pd.DataFrame) -> dict:
    """Write a data profile report to reports/metrics/data_profile.json."""
    profile = {
        'rows': int(len(df)),
        'columns': int(df.shape[1]),
        'unique_users': int(df['user_id'].nunique()),
        'missing_values': {col: int(df[col].isna().sum()) for col in df.columns},
        'dtypes': {col: str(df[col].dtype) for col in df.columns},
        'duplicate_count': int(df.duplicated().sum()),
        'class_balance': {
            'correct': int((df['is_correct'] == 1).sum()),
            'incorrect': int((df['is_correct'] == 0).sum()),
        },
        'invalid_difficulty_rows': int((~df['difficulty'].isin(config.DIFFICULTIES)).sum()),
    }
    config.DATA_PROFILE_FILE.write_text(json.dumps(profile, indent=2))
    return profile
def clean_data(df: pd.DataFrame) -> tuple:
    """Remove and repair the intentional data-quality problems."""
    dropped = {
        'duplicate': 0, 'invalid_exercise_type': 0, 'invalid_difficulty': 0,
        'bad_timestamp': 0, 'invalid_target': 0, 'missing_essential': 0,
        'missing_time_imputed': 0,
    }
    total_before = len(df)

    df = df.drop_duplicates().copy()
    dropped['duplicate'] = total_before - len(df)

    # Normalize topic strings to the canonical set.
    canon = {topic.lower(): topic for topic in config.TOPICS}
    df['topic'] = df['topic'].astype(str).str.strip().str.replace(r'\s+', ' ', regex=True)
    df['topic'] = df['topic'].map(lambda t: canon.get(t.lower(), t.title()))

    df = _filter_invalid(df, 'exercise_type', config.EXERCISE_TYPES, dropped, 'invalid_exercise_type')
    df = _filter_invalid(df, 'difficulty', config.DIFFICULTIES, dropped, 'invalid_difficulty')

    before = len(df)
    df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
    year = df['timestamp'].dt.year.fillna(0)
    df = df[df['timestamp'].notna() & year.ge(2000) & year.le(2027)]
    dropped['bad_timestamp'] += before - len(df)

    # Impute missing time with the median for the matching exercise type.
    df['time_spent_ms'] = pd.to_numeric(df['time_spent_ms'], errors='coerce')
    imputed = int(df['time_spent_ms'].isna().sum())
    df['time_spent_ms'] = df.groupby('exercise_type')['time_spent_ms'].transform(
        lambda s: s.fillna(s.median())
    )
    dropped['missing_time_imputed'] = imputed

    # Clip extreme time values to reduce the effect of a few long outliers.
    lower = df.groupby('exercise_type')['time_spent_ms'].transform(lambda s: s.quantile(0.02))
    upper = df.groupby('exercise_type')['time_spent_ms'].transform(lambda s: s.quantile(0.98))
    df['time_spent_ms'] = df['time_spent_ms'].clip(lower=lower, upper=upper)

    before = len(df)
    df['is_correct'] = pd.to_numeric(df['is_correct'], errors='coerce')
    df = df[df['is_correct'].isin([0.0, 1.0])]
    df['is_correct'] = df['is_correct'].astype(int)
    dropped['invalid_target'] += before - len(df)

    before = len(df)
    essential = ['user_id', 'timestamp', 'topic', 'exercise_type', 'difficulty',
                 'is_correct', 'time_spent_ms']
    df = df.dropna(subset=essential)
    dropped['missing_essential'] += before - len(df)

    # Cleaning and imputation can make two rows identical, so dedupe again.
    before = len(df)
    df = df.drop_duplicates()
    dropped['duplicate'] += before - len(df)

    df = df.sort_values(['user_id', 'timestamp']).reset_index(drop=True)
    dropped['total_dropped'] = total_before - len(df)
    return df, dropped


def _filter_invalid(df, column, allowed, dropped, key):
    """Keep only rows whose column value is allowed, tallying what we remove."""
    before = len(df)
    df = df[df[column].isin(allowed)].copy()
    dropped[key] += before - len(df)
    return df
def split_by_user(df: pd.DataFrame) -> tuple:
    """Split into train/validation/test by user_id (no user-level leakage)."""
    user_ids = df['user_id'].unique()
    rng = np.random.default_rng(config.RANDOM_SEED)
    rng.shuffle(user_ids)

    n = len(user_ids)
    n_train = int(n * config.TRAIN_RATIO)
    n_val = int(n * config.VALIDATION_RATIO)

    train_ids = set(user_ids[:n_train])
    val_ids = set(user_ids[n_train:n_train + n_val])
    test_ids = set(user_ids[n_train + n_val:])

    train = df[df['user_id'].isin(train_ids)].reset_index(drop=True)
    validation = df[df['user_id'].isin(val_ids)].reset_index(drop=True)
    test = df[df['user_id'].isin(test_ids)].reset_index(drop=True)
    return train, validation, test


def prepare_all() -> dict:
    """Run the whole preparation step and write the processed files."""
    raw = load_raw_data()
    profile = profile_data(raw)
    cleaned, dropped = clean_data(raw)
    train, validation, test = split_by_user(cleaned)

    train.to_csv(config.TRAIN_FILE, index=False)
    validation.to_csv(config.VALIDATION_FILE, index=False)
    test.to_csv(config.TEST_FILE, index=False)

    logger.info('Raw rows: %d', len(raw))
    logger.info('Cleaned rows: %d (dropped %d)', len(cleaned), dropped['total_dropped'])
    logger.info('Split sizes -> train: %d, validation: %d, test: %d',
                len(train), len(validation), len(test))
    logger.info('Data profile written to %s', config.DATA_PROFILE_FILE)

    return {'raw': raw, 'cleaned': cleaned, 'train': train,
            'validation': validation, 'test': test, 'profile': profile}


if __name__ == '__main__':
    result = prepare_all()