"""Content-based topic recommender for the learning path.

Each topic is represented by a TF-IDF vector built from its exercise text. A
learner profile is the average of the vectors for the topics they have
studied. For every candidate topic we combine three terms:

    score = similarity_weight  * topic_similarity
          + mastery_weight     * difficulty_suitability
          + weakness_weight    * weakness

The weights live in config.py and are deliberately simple starting values.
"""

import datetime
import json

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

from ai_engine import config

logger = config.logging.getLogger(__name__)


class RecommenderModel:
    """TF-IDF content-based recommender."""

    def __init__(self, vectorizer, topic_vectors, topic_index, topic_difficulty):
        self.vectorizer = vectorizer
        self.topic_vectors = topic_vectors
        self.topic_index = topic_index
        self.topic_difficulty = topic_difficulty
        self.metadata = {
            'algorithm': 'TFIDFContentBased',
            'model_version': config.MODEL_VERSION,
            'training_date': datetime.date.today().isoformat(),
            'weights': {
                'similarity': config.SIMILARITY_WEIGHT,
                'mastery': config.MASTERY_WEIGHT,
                'weakness': config.WEAKNESS_WEIGHT,
            },
        }

    def _profile_vector(self, studied_topics):
        """Average of the TF-IDF vectors for the topics a learner has studied."""
        vectors = [self.topic_vectors[self.topic_index[t]]
                   for t in studied_topics if t in self.topic_index]
        if not vectors:
            return np.zeros(self.topic_vectors.shape[1])
        return np.mean(vectors, axis=0)

    def recommend(self, topic_accuracies, candidate_topics, k=3):
        """Rank candidate topics using similarity, weakness and difficulty fit."""
        studied = list(topic_accuracies.keys())
        profile_vec = self._profile_vector(studied)
        # Learner proficiency inferred from their per-topic accuracy.
        accs = [v for v in topic_accuracies.values() if v is not None]
        proficiency = float(np.mean(accs)) if accs else 0.5

        scored = []
        for topic in candidate_topics:
            if topic not in self.topic_index:
                continue
            similarity = float(self._cosine(profile_vec, self.topic_vectors[self.topic_index[topic]]))
            accuracy = topic_accuracies.get(topic)
            weakness = 1.0 - accuracy if accuracy is not None else 0.5
            topic_difficulty = 1.0 - abs(self.topic_difficulty.get(topic, 0.5) - proficiency)
            score = (config.SIMILARITY_WEIGHT * similarity
                     + config.MASTERY_WEIGHT * topic_difficulty
                     + config.WEAKNESS_WEIGHT * weakness)
            scored.append((topic, float(np.clip(score, 0.0, 1.0))))

        scored.sort(key=lambda x: x[1], reverse=True)
        results = []
        for topic, score in scored[:k]:
            results.append({
                'topic': topic,
                'score': round(float(score), 3),
                'reason': self._reason(topic, topic_accuracies),
            })
        return results

    @staticmethod
    def _cosine(a, b):
        norm = (np.linalg.norm(a) * np.linalg.norm(b))
        if norm == 0:
            return 0.0
        return float(np.dot(a, b) / norm)

    def _reason(self, topic, topic_accuracies):
        """Return a plain reason without claiming the topic is objectively best."""
        accuracy = topic_accuracies.get(topic)
        if accuracy is not None and accuracy < 0.6:
            return ('Recommended because strengthening this topic could help '
                    'your overall ecology knowledge.')
        return ('Recommended because it builds on topics you have already '
                'studied and matches your current level.')

    def save(self):
        joblib.dump({
            'vectorizer': self.vectorizer,
            'topic_vectors': self.topic_vectors,
            'topic_index': self.topic_index,
            'topic_difficulty': self.topic_difficulty,
        }, config.RECOMMENDER_ARTIFACT)

    @classmethod
    def load(cls):
        payload = joblib.load(config.RECOMMENDER_ARTIFACT)
        return cls(payload['vectorizer'], payload['topic_vectors'],
                   payload['topic_index'], payload['topic_difficulty'])


def train_recommender(topic_texts: dict, topic_difficulty: dict) -> RecommenderModel:
    """Build TF-IDF vectors for each ecology topic and wrap them."""
    topics = list(topic_texts.keys())
    texts = [topic_texts[t] for t in topics]
    vectorizer = TfidfVectorizer(analyzer='word', stop_words='english')
    matrix = vectorizer.fit_transform(texts)
    topic_index = {topic: i for i, topic in enumerate(topics)}
    return RecommenderModel(vectorizer, matrix.toarray(), topic_index,
                            topic_difficulty)