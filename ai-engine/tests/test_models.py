"""Tests for the mastery model using the real trained artifacts."""

import numpy as np
import pytest

from ai_engine import config
from ai_engine.models.mastery import MasteryModel, difficulty_from_probability


@pytest.fixture(scope='module')
def model():
    if not config.MASTERY_MODEL_FILE.exists():
        pytest.skip('Run the pipeline first to produce the mastery artifact.')
    return MasteryModel.load()


def test_artifact_exists():
    assert config.MASTERY_MODEL_FILE.exists()
    assert config.MASTERY_METADATA_FILE.exists()


def test_model_loads(model):
    assert model.model is not None
    assert model.algorithm == 'LogisticRegression'
    assert len(model.feature_names) > 0


def test_metadata_saved():
    import json
    metadata = json.loads(config.MASTERY_METADATA_FILE.read_text())
    assert metadata['algorithm'] == 'LogisticRegression'
    assert 'feature_names' in metadata
    assert 'thresholds' in metadata


def test_single_prediction_range(model):
    row = np.zeros((1, len(model.feature_names)))
    row[0, 0] = 0.5  # overall_accuracy feature
    prob = model.predict_proba(row)
    assert 0.0 <= prob[0] <= 1.0


def test_classifier_output_shape(model):
    rows = np.zeros((5, len(model.feature_names)))
    prob = model.predict_proba(rows)
    assert prob.shape == (5,)


def test_difficulty_thresholds():
    assert difficulty_from_probability(0.9) == 'Advanced'
    assert difficulty_from_probability(0.6) == 'Intermediate'
    assert difficulty_from_probability(0.3) == 'Beginner'
    # Boundary between intermediate and advanced.
    assert difficulty_from_probability(0.8) in ('Advanced', 'Intermediate')


def test_feature_count_stable(model):
    # 7 numeric + 3 difficulty + 6 exercise-type one-hot columns.
    assert len(model.feature_names) == 16