# AI Methodology

**EcoQuest: Learn & Save the Planet** — a machine-learning layer for a gamified
ecology learning app. This document describes how the ML layer was designed,
built and evaluated, in the style of a Computer Science undergraduate report.

---

## 1. Problem statement

EcoQuest already generates lessons, checks answers and supports learners
through a gamified interface. The ML layer answers three questions that a rule
based system answers only crudely:

1. Will this learner answer the next exercise correctly, and which difficulty
   is appropriate?
2. Is a learner's free-text answer acceptable, even when it is not an exact
   match to the expected one?
3. Which ecology topics should this learner study next?

Gemini remains responsible for generating content and conversational help.
Python/scikit-learn is a separate, additional intelligence layer.

## 2. Why AI/ML is useful for EcoQuest

- **Adaptive difficulty:** a fixed "level > 5 → Intermediate" rule ignores how
  well the learner is doing on a specific topic. A model that estimates the
  probability of a correct answer lets the app adapt.
- **Forgiving but honest grading:** exact match marks a paraphrase or a typo as
  wrong. A similarity-based grader can give partial credit and helpful hints.
- **Personalised learning path:** recommending related topics keeps a learner
  engaged, instead of presenting topics in a fixed order.

## 3. Dataset

The core table is `data/raw/interactions.csv` with one row per answered
exercise:

`user_id, timestamp, topic, exercise_id, exercise_type, difficulty,
user_answer, correct_answer, is_correct, time_spent_ms, hearts_before,
session_index`

There are ~300-500 simulated learners and ~30-80 interactions each, produced
by `ai_engine/data/simulate.py`. Live interactions logged through the FastAPI
`/log/interaction` endpoint are appended to `data/raw/live_interactions.csv`
and used for future retraining.

## 4. Synthetic-data justification

The app has no large real learner dataset yet, so we bootstrap the pipeline
with simulated learners. Each simulated learner has an underlying ability, a
topic-specific skill, a learning rate, a fatigue factor, a slip probability and
a guess probability. The correctness probability is light and is inspired by
Item Response Theory (IRT) and Bayesian Knowledge Tracing (BKT): it grows with
practice and depends on the gap between ability and difficulty. This produces
realistic correlations (improvement over time, per-topic skill) instead of
random labels. The data is clearly labelled as synthetic and the models must be
retrained once real logs accumulate.

We also intentionally inject realistic data problems (duplicates, missing time,
impossible timestamps, invalid difficulty values, inconsistent casing) so the
preparation pipeline is exercised.

## 5. Data preparation

`ai_engine/data/prepare.py`:

1. Loads the raw interactions, plus live logs if present (with a `source` column).
2. Writes a data profile to `reports/metrics/data_profile.json`.
3. Removes exact duplicates.
4. Normalises topic strings to a canonical set.
5. Validates exercise types and difficulty values.
6. Converts timestamps and removes impossible ones.
7. Imputes missing `time_spent_ms` with the median for that exercise type, then
   clips extreme values.
8. Validates `is_correct`.
9. Logs how many rows were dropped and why.

**Leakage prevention:** the data is split by `user_id` (70/15/15), not by
individual rows. This is essential: a random row split would let the model see
the same learner in both training and testing, which overstates performance.
A learner never appears in more than one split.
## 6. Feature engineering

`ai_engine/data/features.py` builds mastery features that describe the state
*before* each exercise is answered, using only prior attempts:

`overall_accuracy, topic_accuracy, topic_attempts, correct_streak,
session_position, time_since_bucket, hour_bucket`, plus one-hot encodings of
difficulty and exercise type.

The target `is_correct` is **excluded** from the feature matrix to avoid target
leakage. Feature order is fixed so the trained model always sees consistent
input.

## 7. Model selection

- **Mastery: Logistic Regression.** Interpretable, fast on CPU, appropriate for
  a small dataset, and its coefficients can be inspected. Compared against a
  Random Forest and two baselines (majority class and global accuracy).
- **Answer grader: Logistic Regression on similarity features.** Three features
  (character TF-IDF cosine, token Jaccard, Levenshtein ratio) combine into a
  three-class classifier (CORRECT / ALMOST / WRONG).
- **Recommender: TF-IDF + cosine similarity (content-based).** A transparent
  algorithm that can be explained and debugged easily.

No deep learning is used.

## 8. Training

`python -m ai_engine.pipeline.run_all` runs the whole lifecycle. A fixed random
seed (`42`) makes training reproducible. Training completes in well under two
minutes on a normal laptop CPU.

## 9. Testing

`pytest` runs unit tests for data preparation, feature engineering, the master
model (using the real saved artifacts) and the FastAPI endpoints via
`TestClient`.

## 10. Evaluation

Reported numbers come only from actual evaluation:

| Model | Headline | Baseline | Model | Delta |
| --- | --- | --- | --- | --- |
| Mastery | accuracy | 0.535 | 0.570 | +0.035 |
| Grader | accuracy | 0.556 | 0.819 | +0.264 |
| Recommender | Precision@3 | 0.901 (random) | 0.858 | -0.043 |

The recommender does not beat the random baseline on precision in this small
synthetic setting; this is reported honestly rather than hidden. The mastery
model is only slightly above the majority baseline, which shows the difficulty
of the prediction task on simulated data. Figures are written to
`reports/figures/` and metrics to `reports/metrics/`.

## 11. Deployment

The trained `.joblib` artifacts are loaded once at FastAPI startup and reused.
If an artifact is missing the service stays up and returns fallback responses,
so the React app continues to work with Python offline.

## 12. Frontend integration

`services/aiEngineService.ts` talks to FastAPI with a 2.5-second timeout and a
cached health check. When the service is unavailable the app falls back to the
original heuristics (existing difficulty rule, exact-match grading, original
topic order). The ML layer enhances the product; it never breaks it.

## 13. Human-in-the-loop

The AI is assistive: a learner can skip, and wrong answers keep the original
explanation. The "ALMOST" verdict gives partial credit and a hint instead of a
heart penalty. Nothing is deleted or modified without the learner acting.

## 14. Limitations

- Models are trained on synthetic data and may not transfer perfectly to real
  learners.
- Text similarity can misjudge unusual or non-native phrasing.
- A recommender can narrow exposure if it only ever recommends similar topics.
- The mastery model's gain over the majority baseline is small in the worst
  case, so difficulty thresholds need revisiting with real data.

## 15. Ethics

- Difficulty adaptation should support, not discourage, learners. Outputs are
  probabilities, not judgements of worth.
- Recommendations should broaden exposure, not trap a learner in a filter
  bubble.
- The answer grader should be forgiving but honest; it never marks everything
  correct.
- We do not claim commercial equivalence, and no learner data leaves the
  application.

## 16. Future work

- Retrain on real interaction logs as they accumulate.
- Tune recommender weights and grader thresholds using real feedback.
- Add more learner-derived features (time-of-day effects, spaced repetition).
- Track the effect of adaptation on learner outcomes (A/B-style analysis).