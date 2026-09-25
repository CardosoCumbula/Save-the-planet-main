"""Answer grading for free-text exercises (FILL_BLANK, SPEAKING).

We combine three similarity signals - character TF-IDF cosine similarity,
token Jaccard similarity and normalized Levenshtein similarity - and feed them
into a small logistic regression that decides between CORRECT, ALMOST and
WRONG. This is intentionally more forgiving than exact string matching but it
is not allowed to mark every similar sentence as correct.
"""

import datetime
import json
import re
import unicodedata

import joblib
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer

from ai_engine import config

STOPWORDS = {'a', 'an', 'the', 'and', 'or', 'of', 'to', 'for', 'in', 'on',
             'is', 'are', 'was', 'were', 'it', 'that', 'this', 'we', 'you'}


def normalize(text: str) -> str:
    """Lowercase, strip punctuation/accents and collapse whitespace."""
    text = unicodedata.normalize('NFKD', str(text))
    text = text.encode('ascii', 'ignore').decode('ascii')
    text = text.lower()
    text = re.sub(r'[^a-z0-9 ]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def _tokens(text: str) -> list:
    words = [w for w in normalize(text).split() if w not in STOPWORDS]
    return words or normalize(text).split()


def _stem(word: str) -> str:
    """Light suffix-based stemming; enough for ecology vocabulary."""
    for suffix in ('ing', 'tion', 'ed', 's', 'es', 'ly'):
        if len(word) > 4 and word.endswith(suffix):
            return word[:-len(suffix)]
    return word


def token_jaccard(a: str, b: str) -> float:
    """Jaccard similarity between the token sets of two answers."""
    set_a = {_stem(w) for w in _tokens(a)}
    set_b = {_stem(w) for w in _tokens(b)}
    if not set_a and not set_b:
        return 1.0
    return len(set_a & set_b) / len(set_a | set_b)


def levenshtein_ratio(a: str, b: str) -> float:
    """Normalized Levenshtein similarity in [0, 1]."""
    ca, cb = normalize(a), normalize(b)
    if ca == cb:
        return 1.0
    n, m = len(ca), len(cb)
    prev = list(range(m + 1))
    for i in range(1, n + 1):
        curr = [i] + [0] * m
        for j in range(1, m + 1):
            cost = 0 if ca[i - 1] == cb[j - 1] else 1
            curr[j] = min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
        prev = curr
    return 1.0 - (prev[m] / max(n, m))


def tfidf_cosine(vectorizer, a: str, b: str) -> float:
    """Character TF-IDF cosine similarity between two single answers."""
    vec_a = vectorizer.transform([a])
    vec_b = vectorizer.transform([b])
    dot = (vec_a.multiply(vec_b)).sum()
    norm_a = np.sqrt((vec_a.power(2)).sum())
    norm_b = np.sqrt((vec_b.power(2)).sum())
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot / (norm_a * norm_b))


def build_similarity_features(pairs: pd.DataFrame, vectorizer) -> np.ndarray:
    """Build the three similarity features for a set of answer pairs."""
    rows = []
    for _, row in pairs.iterrows():
        rows.append([
            tfidf_cosine(vectorizer, row['user_answer'], row['correct_answer']),
            token_jaccard(row['user_answer'], row['correct_answer']),
            levenshtein_ratio(row['user_answer'], row['correct_answer']),
        ])
    return np.array(rows)


class GraderModel:
    """TF-IDF vectorizer plus the similarity classifier used for grading."""

    def __init__(self, vectorizer, clf):
        self.vectorizer = vectorizer
        self.clf = clf
        self.metadata = {
            'algorithm': 'LogisticRegression + TF-IDF',
            'model_version': config.MODEL_VERSION,
            'training_date': datetime.date.today().isoformat(),
            'feature_names': ['tfidf_character_similarity', 'token_jaccard',
                              'levenshtein_ratio'],
        }

    def grade(self, user_answer: str, expected_answer: str) -> dict:
        """Grade one answer and return similarity, verdict, XP and hint."""
        features = np.array([[tfidf_cosine(self.vectorizer, user_answer, expected_answer),
                              token_jaccard(user_answer, expected_answer),
                              levenshtein_ratio(user_answer, expected_answer)]])
        prob = self.clf.predict_proba(features)[0]
        classes = list(self.clf.classes_)
        verdict = str(classes[int(np.argmax(prob))]).upper()
        similarity = round(
            tfidf_cosine(self.vectorizer, user_answer, expected_answer), 2
        )

        if verdict == 'CORRECT':
            partial_xp = config.POSITIVE_XP
            hint = ''
            reason = 'Your answer matches the expected answer.'
        elif verdict == 'ALMOST':
            partial_xp = config.ALMOST_XP
            hint = ('So close. Your answer has the main idea, but one important '
                    'detail is missing.')
            reason = ('The answer is highly similar to the expected answer but '
                      'does not contain all key information.')
        else:
            partial_xp = 0
            hint = 'Review the key concept and try again.'
            reason = 'The answer is not close enough to the expected answer.'

        return {
            'similarity': similarity,
            'verdict': verdict,
            'partial_credit_xp': partial_xp,
            'hint': hint,
            'reason': reason,
        }

    def save(self):
        joblib.dump(self.vectorizer, config.GRADER_VECTORIZER_FILE)
        joblib.dump(self.clf, config.GRADER_MODEL_FILE)
        config.GRADER_METADATA_FILE.write_text(json.dumps(self.metadata, indent=2))

    @classmethod
    def load(cls):
        vectorizer = joblib.load(config.GRADER_VECTORIZER_FILE)
        clf = joblib.load(config.GRADER_MODEL_FILE)
        return cls(vectorizer, clf)


def train_grader(pairs: pd.DataFrame) -> GraderModel:
    """Fit the TF-IDF vectorizer and similarity classifier on labelled pairs."""
    from sklearn.linear_model import LogisticRegression

    all_text = list(pairs['user_answer']) + list(pairs['correct_answer'])
    vectorizer = TfidfVectorizer(analyzer='char_wb', ngram_range=(2, 4),
                                 min_df=1)
    vectorizer.fit(all_text)

    X = build_similarity_features(pairs, vectorizer)
    y = pairs['label'].to_numpy()

    clf = LogisticRegression(**config.GRADER_MODEL_PARAMS)
    clf.fit(X, y)
    return GraderModel(vectorizer, clf)
    return np.array(rows)