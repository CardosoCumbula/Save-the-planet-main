"""Tests for the data preparation and cleaning step."""

import numpy as np
import pandas as pd
import pytest

from ai_engine import config
from ai_engine.data import prepare, simulate

ESSENTIAL_COLUMNS = ['user_id', 'timestamp', 'topic', 'exercise_type',
                     'difficulty', 'is_correct', 'time_spent_ms']


@pytest.fixture(scope='module')
def cleaned_data(tmp_path_factory):
    """Generate a small synthetic dataset and clean it once for all tests."""
    tmp_dir = tmp_path_factory.mktemp('raw')
    rng = np.random.default_rng(7)
    raw = simulate.generate_interactions(out_path=tmp_dir / 'interactions.csv',
                                         n_learners=40, rng=rng)
    cleaned, dropped = prepare.clean_data(raw)
    return {'raw': raw, 'cleaned': cleaned, 'dropped': dropped}


def test_duplicates_removed(cleaned_data):
    assert cleaned_data['dropped']['duplicate'] > 0
    assert cleaned_data['cleaned'].duplicated().sum() == 0


def test_missing_time_imputed(cleaned_data):
    assert cleaned_data['dropped']['missing_time_imputed'] > 0
    assert cleaned_data['cleaned']['time_spent_ms'].notna().all()


def test_no_nulls_after_cleaning(cleaned_data):
    missing = cleaned_data['cleaned'][ESSENTIAL_COLUMNS].isna().sum().sum()
    assert missing == 0


def test_only_valid_difficulties(cleaned_data):
    remaining = set(cleaned_data['cleaned']['difficulty'].unique())
    assert remaining.issubset(set(config.DIFFICULTIES))


def test_only_valid_exercise_types(cleaned_data):
    remaining = set(cleaned_data['cleaned']['exercise_type'].unique())
    assert remaining.issubset(set(config.EXERCISE_TYPES))


def test_valid_timestamps(cleaned_data):
    years = pd.to_datetime(cleaned_data['cleaned']['timestamp']).dt.year
    assert years.between(2000, 2027).all()


def test_valid_split(cleaned_data):
    cleaned = cleaned_data['cleaned']
    train, validation, test = prepare.split_by_user(cleaned)
    assert len(train) + len(validation) + len(test) == len(cleaned)
    assert (len(train) / len(cleaned)) > 0.6
    assert len(train) > 0 and len(validation) > 0 and len(test) > 0


def test_no_user_leakage(cleaned_data):
    """A user must never appear in more than one split."""
    cleaned = cleaned_data['cleaned']
    train, validation, test = prepare.split_by_user(cleaned)
    train_users = set(train['user_id'])
    val_users = set(validation['user_id'])
    test_users = set(test['user_id'])
    assert train_users.isdisjoint(val_users)
    assert train_users.isdisjoint(test_users)
    assert val_users.isdisjoint(test_users)