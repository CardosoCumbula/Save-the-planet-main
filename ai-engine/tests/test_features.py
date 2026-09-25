"""Tests for the mastery feature engineering step."""

import numpy as np
import pandas as pd
import pytest

from ai_engine.data import features, prepare, simulate


@pytest.fixture(scope='module')
def train_test(tmp_path_factory):
    """Small synthetic data split into a train and test generator pair."""
    tmp_dir = tmp_path_factory.mktemp('raw_features')
    rng = np.random.default_rng(11)
    raw = simulate.generate_interactions(out_path=tmp_dir / 'interactions.csv',
                                         n_learners=50, rng=rng)
    cleaned, _ = prepare.clean_data(raw)
    train, _, test = prepare.split_by_user(cleaned)
    X_train, _ = features.build_mastery_features(train)
    X_test, _ = features.build_mastery_features(test)
    return {'X_train': X_train, 'X_test': X_test,
            'train': train, 'test': test}


def test_stable_shape(train_test):
    assert train_test['X_train'].shape[0] == len(train_test['train'])
    assert train_test['X_train'].shape[1] == len(features.NUMERIC_FEATURES) + 3 + 6


def test_stable_column_order(train_test):
    # Building the features twice must produce the same column order.
    X_a, cols_a = features.build_mastery_features(train_test['train'])
    X_b, cols_b = features.build_mastery_features(train_test['train'])
    assert list(X_a.columns) == list(X_b.columns)
    assert list(X_a.columns) == cols_a


def test_no_nan(train_test):
    assert train_test['X_train'].isna().sum().sum() == 0


def test_no_infinity(train_test):
    values = train_test['X_train'].to_numpy(dtype=float)
    assert not np.isinf(values).any()


def test_target_not_included(train_test):
    assert 'is_correct' not in train_test['X_train'].columns


def test_feature_name_list_stable():
    # The headline numeric features must exist and keep their order.
    expected = ['overall_accuracy', 'topic_accuracy', 'topic_attempts',
                'correct_streak', 'session_position', 'time_since_bucket',
                'hour_bucket']
    assert features.NUMERIC_FEATURES == expected