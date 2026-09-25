# Project Proposal

**Title:** Adding a lightweight, reproducible machine-learning layer to
EcoQuest: Learn & Save the Planet

## Problem

EcoQuest is a gamified ecology learning app that currently uses fixed rules for
difficulty ("level > 5 → Intermediate"), exact string matching for free-text
answers, and a fixed topic order. These rules cannot personalise the
experience, forgive small mistakes, or adapt to a learner's actual progress.

## Target users

- **Learners** who want a difficulty that matches their skill, forgiving
  feedback on free-text answers, and a relevant next topic.
- **Lecturers / evaluators** who want to see that the product uses real,
  measurable, explainable machine learning rather than fake "AI".

## Objectives

1. Predict the probability that a learner answers the next exercise correctly
   and use it to choose difficulty.
2. Grade free-text answers as CORRECT / ALMOST / WRONG with partial credit.
3. Recommend the next ecology topics based on learner profile and content
   similarity.
4. Keep Gemini as the generative layer and add Python/scikit-learn as a
   separate intelligence layer, without breaking the existing app.

## Scope

- A Python package (`ai-engine/`) containing a data simulation, preparation,
  feature engineering, three models, evaluation and reporting, a FastAPI
  service, and tests.
- Small, surgical React integration (`aiEngineService.ts`, `App.tsx`,
  `AiInsights.tsx`) with mandatory offline fallback.
- Documentation and a source-code export for submission.

Out of scope: replacing Gemini, replacing authentication, introducing a
database, tensorflow/torch, or large language models.

## AI approach

- **Mastery:** Logistic Regression (compared with Random Forest and baselines).
- **Grader:** TF-IDF character similarity + Jaccard + Levenshtein, combined by
  a Logistic Regression.
- **Recommender:** TF-IDF content vectors + cosine similarity with a weighted
  score.

## Dataset plan

Since real learner data is not available, we simulate ~300-500 learners with
~30-80 interactions each using an IRT/BKT-inspired model. Live interactions are
logged through `/log/interaction` for future retraining. All data is clearly
labelled synthetic.

## Evaluation plan

- Mastery: accuracy, precision, recall, F1, ROC-AUC, Brier, 5-fold CV.
- Grader: accuracy, macro-F1, compared with exact matching.
- Recommender: Precision@3, Recall@3, NDCG@5, compared with random and
  most-popular baselines.
- All figures and metrics are written to `reports/`.

## Expected outcomes

A working hybrid system where Gemini generates content and Python ML adapts
it. The app visibly demonstrates adaptive difficulty, AI answer grading, topic
recommendation, an AI Insights view and an "AI-adapted" badge — all flagged
honestly with real metrics.

## Risks

- Synthetic data may not transfer perfectly to real learners.
- Small mastery-model improvement over the baseline (reported honestly).
- Text similarity quirks for non-native phrasing.
- Filter-bubble risk in recommendations.

Mitigations: document all limitations, retrain on live logs, use forgiving but
honest feedback, and keep the recommender diverse.

## Future improvements

- Retrain on accumulated real interaction data.
- Tune thresholds and recommender weights with real feedback.
- Add spaced-repetition scheduling and per-topic proficiency tracking.
- A/B-test the effect of adaptation on learner outcomes.