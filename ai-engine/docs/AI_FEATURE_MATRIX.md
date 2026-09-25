# AI Feature Matrix

How the machine-learning features map to the existing EcoQuest product, and
how each is evaluated.

| User Feature          | AI Technique                              | Python Component | App Usage         | Evaluation         |
| --------------------- | ----------------------------------------- | ---------------- | ----------------- | ------------------ |
| Adaptive difficulty   | Logistic Regression                       | Mastery model    | Lesson generation | Accuracy / F1 / AUC |
| Smart answer feedback | TF-IDF + similarity + Logistic Regression | Grader           | Answer checking   | Accuracy / Macro-F1 |
| Topic recommendation  | TF-IDF + cosine similarity                | Recommender      | Learning path     | Precision@3 / NDCG@5 |

## How these relate to modern gamified learning systems

Modern gamified learning systems (Duolingo being the most well known) rely on
three ideas that we reproduce here in a simpler form:

1. **Spaced, adaptive practice.** A learner sees content that is neither too
   easy nor too hard. Our mastery model predicts the probability of a correct
   answer and maps it to a difficulty, which is how such systems personalise
   practice.
2. **Forgiving answer checking.** Free-text and spoken answers are checked for
   meaning rather than exact spelling. Our grader uses text-similarity features
   to give partial credit and hints instead of a binary right/wrong.
3. **A personalised learning path.** Topics are ordered so that related and
   weaker areas are surfaced. Our content-based recommender ranks candidate
   topics from a learner profile.

We **do not** claim that EcoQuest is equivalent to Duolingo. Duolingo uses large
proprietary models and massive datasets; EcoQuest is a student project with a
transparent, lightweight and explainable ML layer built for academic
evaluation. The similarity is conceptual, not technical.

## Where each feature lives

- `ai_engine/models/mastery.py` — adaptive difficulty (Model 1).
  Called from `App.tsx` `startLesson` and exposed via `POST /predict/difficulty-for-user`.
- `ai_engine/models/grader.py` — smart answer feedback (Model 2).
  Called from `App.tsx` `checkAnswer` for `FILL_BLANK` and `SPEAKING`, exposed
  via `POST /grade/answer`.
- `ai_engine/models/recommender.py` — topic recommendation (Model 3).
  Called from `App.tsx` `applyLessonRewards` after `generateTopicBatch`, exposed
  via `POST /recommend/topics`.

## Metrics definition

- Accuracy: correctly predicted interactions / total interactions.
- F1 / Macro-F1: harmonic mean of precision and recall (macro averages classes).
- ROC-AUC: area under the ROC curve for the positive (correct) class.
- Precision@3: how many of the top-3 recommended topics were actually worth
  recommending.
- NDCG@5: normalised discounted cumulative gain for the top-5 recommendations.