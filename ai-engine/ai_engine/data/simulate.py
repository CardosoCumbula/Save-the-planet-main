"""Generate a synthetic bootstrap learner-interaction dataset.

The application does not yet have a large collection of real learner
sessions, so we produce a believable synthetic dataset that mimics how
learners improve over time.

The correctness model is deliberately lightweight. It borrows ideas from
Item Response Theory (IRT) and Bayesian Knowledge Tracing (BKT): a learner
has an underlying ability and a topic-specific skill, each exercise has a
difficulty, and the probability of a correct answer grows with practice.

This is clearly synthetic data. It is only meant to bootstrap the ML
pipeline until real interaction logs are available.
"""

import logging

import numpy as np
import pandas as pd

from ai_engine import config

logger = logging.getLogger(__name__)

# Base time spent (ms) for each exercise type, used to scale the simulation.
BASE_TIME_MS = {
    'MULTIPLE_CHOICE': 8000,
    'TRUE_FALSE': 4500,
    'FILL_BLANK': 12000,
    'SPEAKING': 15000,
    'SCENARIO': 20000,
    'SORTING': 10000,
}

# Calendar reference point for the simulated timestamps.
BASE_DATE = np.datetime64('2025-01-01')

# Shared answer material so the text fields look reasonable.
_TOPIC_WORDS = {
    'Recycling': ['plastic', 'paper', 'bin', 'glass'],
    'Composting': ['food waste', 'soil', 'worms', 'nutrients'],
    'Water Conservation': ['tap', 'drops', 'leak', 'shower'],
    'Renewable Energy': ['solar', 'wind', 'turbine', 'sun'],
    'Biodiversity': ['species', 'habitat', 'wildlife', 'forest'],
    'Climate Change': ['carbon', 'warming', 'emissions', 'planet'],
    'Waste Management': ['landfill', 'waste', 'reduce', 'reuse'],
    'Sustainable Agriculture': ['crops', 'soil', 'farm', 'rotation'],
    'Forests': ['trees', 'canopy', 'oxygen', 'plant'],
    'Ocean Conservation': ['ocean', 'plastic', 'reef', 'fish'],
}

CORRECT_MULTIPLE_CHOICE = ['Recycle it', 'Compost it', 'Save water', 'Use solar power']
WRONG_MULTIPLE_CHOICE = ['Throw it away', 'Ignore it', 'Leave the tap running', 'Burn it']


def _sigmoid(x: np.ndarray) -> np.ndarray:
    """Squash a real value into the (0, 1) probability range."""
    return 1.0 / (1.0 + np.exp(-np.clip(x, -20.0, 20.0)))


def _answer_for(etype: str, topic: str, is_correct: bool, rng) -> str:
    """Return a believable answer string for the given exercise type."""
    words = _TOPIC_WORDS.get(topic, ['recycle'])
    if etype in ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'SCENARIO'):
        pool = CORRECT_MULTIPLE_CHOICE if is_correct else WRONG_MULTIPLE_CHOICE
        return str(rng.choice(pool))
    if etype == 'SPEAKING':
        return f"We should {words[0]} to help the environment."
    if etype == 'SORTING':
        join = '|'.join(f"{w}:{'Recycle' if rng.random() < 0.7 else 'Compost'}" for w in words)
        return join
    if is_correct:
        return words[0]
    # FILL_BLANK with a typo when the learner is wrong
    return str(words[0])[:-1] if len(words[0]) > 3 else 'wrongword'


def _difficulty_label(param: float) -> str:
    if param < -0.3:
        return 'Beginner'
    if param > 0.3:
        return 'Advanced'
    return 'Intermediate'
def _learner_interactions(learner_id: int, n_interactions: int, rng,
                          session_offsets) -> list:
    """Create one learner's full interaction history."""
    ability = rng.normal(0.0, 1.0)
    topic_skill = {t: rng.normal(0.0, 0.6) for t in config.TOPICS}
    learning_rate = rng.uniform(0.05, 0.35)
    fatigue = rng.uniform(0.0, 1.2)
    slip = rng.uniform(0.02, 0.12)
    guess = rng.uniform(0.05, 0.25)
    n_sessions = min(int(rng.integers(3, 10)), len(session_offsets))
    session_of = rng.integers(0, n_sessions, size=n_interactions)
    session_start_hour = rng.integers(7, 22, size=n_sessions)

    rows = []
    for idx in range(n_interactions):
        topic = str(rng.choice(config.TOPICS))
        etype = str(rng.choice(config.EXERCISE_TYPES))
        progress = idx / max(n_interactions - 1, 1)
        difficulty_param = float(
            np.clip((progress - 0.5) * 2 + ability * 0.5, -1.2, 1.2)
        )

        learner_theta = ability + topic_skill[topic]
        z = 1.2 * (learner_theta - difficulty_param) + learning_rate * progress
        p_raw = float(_sigmoid(z))
        p_correct = min(1.0, guess + (1.0 - slip - guess) * p_raw)
        is_correct = bool(rng.random() < p_correct)

        base_time = BASE_TIME_MS[etype] * (1.0 + fatigue * 0.1)
        time_spent = base_time * (1.0 + rng.uniform(-0.3, 0.5))
        if not is_correct:
            time_spent *= 1.3

        session = int(session_of[idx])
        timestamp = BASE_DATE + session_offsets[session] + np.timedelta64(
            int(session_start_hour[session]) * 3600 + idx * 5 + rng.integers(0, 240), 's'
        )

        correct_answer = _answer_for(etype, topic, True, rng)
        user_answer = correct_answer if is_correct else _answer_for(etype, topic, False, rng)

        rows.append({
            'user_id': f'user_{learner_id:04d}',
            'timestamp': pd.Timestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S'),
            'topic': topic,
            'exercise_id': f'exc_{learner_id:04d}_{idx}',
            'exercise_type': etype,
            'difficulty': _difficulty_label(difficulty_param),
            'user_answer': user_answer,
            'correct_answer': correct_answer,
            'is_correct': int(is_correct),
            'time_spent_ms': float(time_spent),
            'hearts_before': int(rng.integers(1, 6)),
            'session_index': session,
        })
    return rows


def _inject_problems(df: pd.DataFrame, rng) -> pd.DataFrame:
    """Add realistic data-quality problems intentionally."""
    n = len(df)

    # A few duplicates (~3% of rows)
    n_dups = int(n * 0.03)
    dup_idx = rng.choice(n, size=n_dups)
    df = pd.concat([df, df.iloc[dup_idx]], ignore_index=True)

    # Missing time values (~2%)
    n_missing = int(len(df) * 0.02)
    missing_idx = rng.choice(len(df), size=n_missing, replace=False)
    df.loc[missing_idx, 'time_spent_ms'] = np.nan

    # Impossible timestamps (far future / far past)
    bad_idx = rng.choice(len(df), size=max(3, int(len(df) * 0.005)), replace=False)
    df.loc[bad_idx, 'timestamp'] = '2099-01-01 00:00:00'
    other_bad = rng.choice(len(df), size=max(2, int(len(df) * 0.002)), replace=False)
    df.loc[other_bad, 'timestamp'] = '1800-06-15 10:30:00'

    # Invalid difficulty values
    invalid_idx = rng.choice(len(df), size=max(4, int(len(df) * 0.004)), replace=False)
    df.loc[invalid_idx, 'difficulty'] = 'Extreme'

    # Inconsistent topic casing / whitespace
    messy_idx = rng.choice(len(df), size=max(10, int(len(df) * 0.05)), replace=False)
    for i, idx in enumerate(messy_idx):
        topic = df.at[idx, 'topic']
        if i % 3 == 0:
            df.at[idx, 'topic'] = topic.lower()
        elif i % 3 == 1:
            df.at[idx, 'topic'] = topic.upper() + ' '
        else:
            df.at[idx, 'topic'] = ' ' + topic + '  '

    # Extra whitespace in answers
    ws_idx = rng.choice(len(df), size=max(5, int(len(df) * 0.02)), replace=False)
    df.loc[ws_idx, 'user_answer'] = '  ' + df.loc[ws_idx, 'user_answer'].astype(str) + '  '

    return df
def generate_interactions(out_path=None, n_learners=None, rng=None) -> pd.DataFrame:
    """Generate the synthetic interactions table and write it to CSV."""
    rng = rng or np.random.default_rng(config.RANDOM_SEED)
    if n_learners is None:
        n_learners = int(rng.integers(300, 501))

    # Calendar offsets per session keep timestamps plausible and ordered.
    session_offsets = np.cumsum(
        np.hstack([[np.timedelta64(0, 'D')], rng.integers(1, 5, size=12).astype('timedelta64[D]')])
    )[:10]

    rows = []
    for learner_id in range(n_learners):
        n_interactions = int(rng.integers(30, 81))
        rows.extend(_learner_interactions(learner_id, n_interactions, rng, session_offsets))

    df = pd.DataFrame(rows, columns=[
        'user_id', 'timestamp', 'topic', 'exercise_id', 'exercise_type',
        'difficulty', 'user_answer', 'correct_answer', 'is_correct',
        'time_spent_ms', 'hearts_before', 'session_index',
    ])
    df = _inject_problems(df, rng)

    if out_path is None:
        out_path = config.RAW_INTERACTIONS
    out_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_path, index=False)
    logger.info('Wrote %d rows to %s', len(df), out_path)
    return df


# ---------------------------------------------------------------------------
# Answer-grader training data
# ---------------------------------------------------------------------------
GRADER_BASE = [
    'Plastic bottles belong in the recycling bin',
    'Composting turns food waste into soil',
    'Turn off the tap to save water',
    'Solar panels convert sunlight into electricity',
    'Trees absorb carbon dioxide from the air',
    'Reusing bags reduces plastic waste',
]

_PARAPHRASES = {
    'Plastic bottles belong in the recycling bin':
        'You should put plastic bottles in the recycling bin',
    'Composting turns food waste into soil':
        'Compost changes food scraps into rich soil',
    'Turn off the tap to save water':
        'Close the tap so we save water',
    'Solar panels convert sunlight into electricity':
        'Solar panels make electricity from sunlight',
    'Trees absorb carbon dioxide from the air':
        'Trees take in carbon dioxide',
    'Reusing bags reduces plastic waste':
        'Using bags again lowers plastic waste',
}


def _typo_word(text: str) -> str:
    """Introduce a single small typo into one word of a sentence."""
    words = text.split()
    i = min(1, len(words) - 1)
    word = words[i]
    if len(word) > 3 and word[-1].isalpha():
        words[i] = word[:-1] + ('x' if word[-1] != 'x' else word[-2:])
    return ' '.join(words)


def _grader_variant(correct: str, label: str, rng) -> str:
    """Produce a labelled variant of a correct answer."""
    if label == 'correct':
        choice = rng.integers(0, 4)
        if choice == 0:
            return correct
        if choice == 1:
            return correct.upper()
        if choice == 2:
            return correct + '.'
        return _PARAPHRASES[correct]
    if label == 'almost':
        choice = rng.integers(0, 4)
        if choice == 0:
            return _typo_word(correct)
        if choice == 1:
            return ' '.join(correct.split()[:-1])
        if choice == 2:
            return ' '.join(reversed(correct.split()))
        return correct.split()[0:3] and ' '.join(correct.split()[:3]) + '.'
    # wrong: unrelated, contradictory or clearly incorrect
    choice = rng.integers(0, 3)
    if choice == 0:
        return 'The sky is blue today.'
    if choice == 1:
        return 'I like to play video games instead.'
    return 'Burning plastic is the best way to remove waste'


def generate_grader_pairs(out_path=None, rng=None, n_per_class=120) -> pd.DataFrame:
    """Generate a small labelled answer-pair dataset and write it to CSV."""
    rng = rng or np.random.default_rng(config.RANDOM_SEED)
    rows = []
    for label in ['correct', 'almost', 'wrong']:
        for _ in range(n_per_class):
            correct = str(rng.choice(GRADER_BASE))
            rows.append({
                'user_answer': _grader_variant(correct, label, rng),
                'correct_answer': correct,
                'label': label,
            })
    df = pd.DataFrame(rows, columns=['user_answer', 'correct_answer', 'label'])
    if out_path is None:
        out_path = config.GRADER_PAIRS_RAW
    out_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_path, index=False)
    logger.info('Wrote %d grader pairs to %s', len(df), out_path)
    return df


if __name__ == '__main__':
    generate_interactions()