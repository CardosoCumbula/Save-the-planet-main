"""End-to-end tests for the FastAPI service using TestClient."""

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from ai_engine import config
from ai_engine.service.api import app

client = TestClient(app)


def _sample_history(user_id='user_test', n=12):
    return [
        {
            'user_id': user_id,
            'timestamp': f'2025-01-0{(i % 9) + 1} 10:00:00',
            'topic': 'Recycling',
            'exercise_id': f'exc_{i}',
            'exercise_type': 'MULTIPLE_CHOICE',
            'difficulty': 'Beginner',
            'user_answer': 'yes',
            'correct_answer': 'yes',
            'is_correct': 1 if i % 3 else 0,
            'time_spent_ms': 8000.0,
            'hearts_before': 5,
            'session_index': i // 4,
        }
        for i in range(n)
    ]


def test_health():
    response = client.get('/health')
    assert response.status_code == 200
    body = response.json()
    assert body['status'] == 'ok'
    assert 'models' in body
    assert body['models']['mastery']


def test_predict_difficulty_valid():
    response = client.post('/predict/difficulty-for-user', json={
        'history': _sample_history(),
        'current_topic': 'Recycling',
        'current_difficulty': 'Beginner',
    })
    assert response.status_code == 200
    body = response.json()
    assert 'probability_correct' in body
    assert body['recommended_difficulty'] in ('Beginner', 'Intermediate', 'Advanced')
    assert isinstance(body['reason'], str)
    assert 'model_used' in body


def test_predict_difficulty_empty_history_falls_back():
    response = client.post('/predict/difficulty-for-user', json={
        'history': [], 'current_topic': 'Recycling', 'current_difficulty': 'Intermediate',
    })
    assert response.status_code == 200
    assert response.json()['model_used'] == 'fallback-heuristic'


def test_predict_difficulty_handles_invalid_timestamps():
    """Invalid timestamps must be dropped, not sent as NaN to the model."""
    history = _sample_history()
    history[3]['timestamp'] = 'not-a-real-timestamp'
    history[4]['timestamp'] = '12/34/9999'
    history[5]['timestamp'] = '2025-99-99 25:99:99'
    response = client.post('/predict/difficulty-for-user', json={
        'history': history,
        'current_topic': 'Recycling',
        'current_difficulty': 'Beginner',
    })
    assert response.status_code == 200
    body = response.json()
    assert body['recommended_difficulty'] in ('Beginner', 'Intermediate', 'Advanced')
    assert 0.0 <= body['probability_correct'] <= 1.0


def test_predict_difficulty_only_invalid_history_falls_back():
    """A brand-new user with no usable timestamps must not crash."""
    history = [
        dict(_sample_history()[0], timestamp='garbage'),
        dict(_sample_history()[1], timestamp='nope-not-a-date'),
    ]
    response = client.post('/predict/difficulty-for-user', json={
        'history': history,
        'current_topic': 'Recycling',
        'current_difficulty': 'Intermediate',
    })
    assert response.status_code == 200
    body = response.json()
    assert body['model_used'] == 'fallback-heuristic'
    assert body['recommended_difficulty'] == 'Intermediate'


def test_predict_difficulty_malformed():
    response = client.post('/predict/difficulty-for-user', json={'history': 'nope'})
    assert response.status_code == 422


def test_grade_correct():
    response = client.post('/grade/answer', json={
        'user_answer': 'Plastic bottles belong in the recycling bin',
        'expected_answer': 'Plastic bottles belong in the recycling bin',
    })
    assert response.status_code == 200
    body = response.json()
    assert body['verdict'] in ('CORRECT', 'ALMOST', 'WRONG')
    assert 0.0 <= body['similarity'] <= 1.0
    assert isinstance(body['partial_credit_xp'], int)


def test_grade_wrong():
    response = client.post('/grade/answer', json={
        'user_answer': 'The sky is blue today',
        'expected_answer': 'Composting turns food waste into soil',
    })
    assert response.status_code == 200
    assert response.json()['verdict'] == 'WRONG'


def test_recommend_topics():
    response = client.post('/recommend/topics', json={
        'learner_profile': {'Recycling': 0.8, 'Composting': 0.4},
        'candidate_topics': list(config.TOPICS),
        'k': 3,
    })
    assert response.status_code == 200
    body = response.json()
    assert len(body['recommendations']) == 3
    assert all('topic' in item and 'score' in item for item in body['recommendations'])


def test_log_interaction_and_presence(tmp_path, monkeypatch):
    live = tmp_path / 'live_interactions.csv'
    monkeypatch.setattr(config, 'LIVE_INTERACTIONS', live)
    response = client.post('/log/interaction', json=_sample_history()[0])
    assert response.status_code == 200
    assert response.json()['status'] == 'logged'
    assert live.exists()


def test_insights_existing_user():
    path = config.TRAIN_FILE
    if not path.exists():
        pytest.skip('Run the pipeline first to produce processed data.')
    frame = pd.read_csv(path, dtype={'user_id': str})
    user_id = frame['user_id'].iloc[0]
    response = client.get(f'/insights/{user_id}')
    if response.status_code == 404:
        pytest.skip('Chosen user not present in processed data.')
    assert response.status_code == 200
    body = response.json()
    assert body['user_id'] == user_id
    assert 'per_topic_mastery' in body
    assert isinstance(body['predicted_next_difficulty'], str)


def test_insights_missing_user():
    assert client.get('/insights/user_does_not_exist_zzz').status_code == 404