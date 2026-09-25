"""Evaluation and reporting helpers for the mastery model.

All reported numbers come from the held-out test split or from
cross-validation performed on the training data only. We never adjust
results to look better; if a model performs poorly we report the truth.
"""

import datetime
import json
import logging

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, brier_score_loss, roc_curve, confusion_matrix,
)
from sklearn.calibration import calibration_curve
from sklearn.model_selection import StratifiedKFold

from ai_engine import config
from ai_engine.models.mastery import train_logistic_regression, train_random_forest

logger = logging.getLogger(__name__)


def majority_class_baseline(y_train, y_test):
    """Baseline that always predicts the majority class seen in training."""
    majority = int(y_train.mean() >= 0.5)
    preds = np.full(len(y_test), majority)
    return {'accuracy': accuracy_score(y_test, preds), 'label': 'Majority class'}


def accuracy_heuristic_baseline(y_train, y_test):
    """Baseline that predicts with fixed probability equal to train accuracy."""
    prob = float(y_train.mean())
    preds = (np.full(len(y_test), prob) >= 0.5).astype(int)
    return {
        'accuracy': accuracy_score(y_test, preds),
        'label': 'Global accuracy heuristic',
    }


def evaluate_classifier(model, X, y):
    """Compute the standard classification metrics for the test split."""
    y_prob = model.predict_proba(X)[:, 1]
    y_pred = (y_prob >= 0.5).astype(int)
    metrics = {
        'accuracy': float(accuracy_score(y, y_pred)),
        'precision': float(precision_score(y, y_pred, zero_division=0)),
        'recall': float(recall_score(y, y_pred)),
        'f1': float(f1_score(y, y_pred)),
        'roc_auc': float(roc_auc_score(y, y_prob)),
        'brier': float(brier_score_loss(y, y_prob)),
        'n_test': int(len(y)),
    }
    return metrics, y_pred, y_prob


def cross_validate_models(X, y, n_folds=5):
    """Stratified k-fold CV over the training data for the two classifiers."""
    skf = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=config.RANDOM_SEED)
    lr_auc, lr_f1 = [], []
    rf_auc, rf_f1 = [], []
    for train_idx, val_idx in skf.split(X, y):
        X_tr, X_val = X.iloc[train_idx], X.iloc[val_idx]
        y_tr, y_val = y[train_idx], y[val_idx]

        lr = train_logistic_regression(X_tr, y_tr)
        lr_auc.append(roc_auc_score(y_val, lr.predict_proba(X_val)[:, 1]))
        lr_f1.append(f1_score(y_val, (lr.predict_proba(X_val)[:, 1] >= 0.5).astype(int)))

        rf = train_random_forest(X_tr, y_tr)
        rf_auc.append(roc_auc_score(y_val, rf.predict_proba(X_val)[:, 1]))
        rf_f1.append(f1_score(y_val, (rf.predict_proba(X_val)[:, 1] >= 0.5).astype(int)))

    def summarize(scores):
        return {'mean': float(np.mean(scores)), 'std': float(np.std(scores))}

    return {
        'n_folds': n_folds,
        'logistic_regression': {'roc_auc': summarize(lr_auc), 'f1': summarize(lr_f1)},
        'random_forest': {'roc_auc': summarize(rf_auc), 'f1': summarize(rf_f1)},
    }


def plot_metrics(model, X_test, y_test, y_pred, y_prob, feature_names):
    """Generate the four main mastery figures."""
    cm = confusion_matrix(y_test, y_pred)

    fig, ax = plt.subplots(figsize=(4.5, 4))
    ax.imshow(cm, cmap='Blues')
    ax.set_xticks([0, 1]); ax.set_yticks([0, 1])
    ax.set_xticklabels(['Pred 0', 'Pred 1'])
    ax.set_yticklabels(['True 0', 'True 1'])
    for i in range(2):
        for j in range(2):
            ax.text(j, i, cm[i, j], ha='center', va='center')
    ax.set_title('Confusion matrix (test)')
    plt.tight_layout()
    fig.savefig(config.FIGURES_DIR / 'mastery_confusion_matrix.png', dpi=120)
    plt.close(fig)

    fpr, tpr, _ = roc_curve(y_test, y_prob)
    fig, ax = plt.subplots(figsize=(5, 4))
    ax.plot(fpr, tpr, label='Logistic Regression')
    ax.plot([0, 1], [0, 1], '--', color='grey', label='Chance')
    ax.set_xlabel('False positive rate'); ax.set_ylabel('True positive rate')
    ax.set_title('ROC curve (test)'); ax.legend()
    plt.tight_layout()
    fig.savefig(config.FIGURES_DIR / 'mastery_roc_curve.png', dpi=120)
    plt.close(fig)

    frac_pos, mean_pred = calibration_curve(y_test, y_prob, n_bins=10)
    fig, ax = plt.subplots(figsize=(5, 4))
    ax.plot(mean_pred, frac_pos, marker='o', label='Model')
    ax.plot([0, 1], [0, 1], '--', color='grey', label='Perfectly calibrated')
    ax.set_xlabel('Mean predicted probability')
    ax.set_ylabel('Fraction of positives')
    ax.set_title('Calibration curve (test)'); ax.legend()
    plt.tight_layout()
    fig.savefig(config.FIGURES_DIR / 'mastery_calibration.png', dpi=120)
    plt.close(fig)

    coefficients = np.asarray(model.coef_).ravel()
    order = np.argsort(np.abs(coefficients))[::-1][:15]
    fig, ax = plt.subplots(figsize=(7, 5))
    ax.barh([feature_names[i] for i in order][::-1],
            coefficients[order][::-1], color='steelblue')
    ax.set_title('Top logistic regression coefficients')
    ax.set_xlabel('Coefficient value')
    plt.tight_layout()
    fig.savefig(config.FIGURES_DIR / 'mastery_feature_importance.png', dpi=120)
    plt.close(fig)


def write_mastery_report(metrics, baselines, cv, model_algorithm):
    """Record metrics, the summary row and a model card."""
    config.MASTERY_METRICS_JSON.write_text(
        json.dumps({
            'model_algorithm': model_algorithm,
            'test_metrics': metrics,
            'baselines': baselines,
            'cross_validation': cv,
            'trained_with': config.MASTERY_MODEL_PARAMS,
        }, indent=2)
    )

    summary = pd.DataFrame([{
        'model': 'mastery',
        'task': 'predict next-answer correctness',
        'algorithm': model_algorithm,
        'baseline_score': baselines['majority_class']['accuracy'],
        'model_score': metrics['accuracy'],
        'headline_metric': 'accuracy',
        'delta': metrics['accuracy'] - baselines['majority_class']['accuracy'],
    }])
    config.SUMMARY_CSV.write_text(summary.to_csv(index=False))

    _write_mastery_model_card(metrics, baselines, cv)
    logger.info('Mastery metrics written to %s', config.MASTERY_METRICS_JSON)


def _write_mastery_model_card(metrics, baselines, cv):
    """Write a plain-language model card for the mastery model."""
    lines = [
        '# Mastery model card', '',
        '## Purpose',
        'Predict the probability that a learner answers the next exercise correctly.',
        '',
        '## Problem formulation',
        'Binary classification, where the positive class means a correct answer.',
        '',
        '## Training data',
        f'Synthetic simulated interactions (test set n={metrics["n_test"]}). '
        'Real user logs are not yet available, so the model is a bootstrap.',
        '',
        '## Features',
        'Overall and topic accuracy, correct streak, session position, time since the '
        'last attempt, hour bucket, exercise type and difficulty.',
        '',
        '## Algorithm',
        'Logistic Regression with L2 regularisation.',
        '',
        '## Hyperparameters',
        str(config.MASTERY_MODEL_PARAMS),
        '',
        '## Baseline',
        f'Majority class accuracy: {baselines["majority_class"]["accuracy"]:.3f}',
        '',
        '## Test metrics',
        f'- Accuracy: {metrics["accuracy"]:.3f}',
        f'- Precision: {metrics["precision"]:.3f}',
        f'- Recall: {metrics["recall"]:.3f}',
        f'- F1: {metrics["f1"]:.3f}',
        f'- ROC-AUC: {metrics["roc_auc"]:.3f}',
        f'- Brier score: {metrics["brier"]:.3f}',
        f'- 5-fold CV ROC-AUC: {cv["logistic_regression"]["roc_auc"]["mean"]:.3f}',
        '',
        '## Intended use',
        'Selecting an appropriate exercise difficulty inside the EcoQuest lesson flow.',
        '',
        '## Limitations',
        'The model is trained on synthetic data, so it may not transfer perfectly '
        'to real learners. Thresholds are manual.',
        '',
        '## Failure cases',
        'Unusual learners far from the simulated distribution, or topics not seen '
        'during training.',
        '',
        '## Ethical considerations',
        'Difficulty adaptation should support learning, not discourage learners. '
        'The model output is a probability, not a fixed judgement of a learner.',
    ]
    config.MASTERY_MODEL_CARD.write_text('\n'.join(lines))
def precision_at_k(recommended, relevant, k=3):
    """Precision over the top-k recommended topics."""
    if not recommended:
        return 0.0
    top_k = set(recommended[:k])
    return len(top_k & relevant) / k


def recall_at_k(recommended, relevant, k=3):
    """Recall over the top-k recommended topics."""
    if not relevant:
        return 0.0
    top_k = set(recommended[:k])
    return len(top_k & relevant) / len(relevant)


def ndcg_at_k(recommended, relevant, k=5):
    """NDCG with binary relevance for the top-k recommendations."""
    dcg = sum(1.0 / np.log2(i + 2)
              for i, topic in enumerate(recommended[:k]) if topic in relevant)
    ideal = sum(1.0 / np.log2(i + 2) for i in range(min(k, len(relevant))))
    if ideal == 0:
        return 0.0
    return dcg / ideal


def _topic_texts_map(df):
    """Map each topic to a bag of its exercise answer text."""
    texts = {}
    for topic, group in df.groupby('topic'):
        body = ' '.join(group['user_answer'].astype(str)) + ' ' + topic
        texts[topic] = body
    return texts


def _topic_difficulty_map(df):
    """Map each topic to its mean exercise difficulty code (0..2)."""
    code = {'Beginner': 0, 'Intermediate': 1, 'Advanced': 2}
    mapping = {}
    for topic, group in df.groupby('topic'):
        mapping[topic] = float(group['difficulty'].map(code).mean() / 2.0)
    return mapping
def evaluate_grader(model, pairs, baseline='exact'):
    """Score the grader and the exact-match baseline on a labelled split."""
    labels = pairs['label'].str.upper().to_numpy()
    preds = []
    baseline_preds = []
    for _, row in pairs.iterrows():
        result = model.grade(row['user_answer'], row['correct_answer'])
        preds.append(result['verdict'])
        if baseline == 'exact':
            ok = row['user_answer'].lower().strip() == row['correct_answer'].lower().strip()
            baseline_preds.append('CORRECT' if ok else 'WRONG')

    metrics = {
        'accuracy': float(accuracy_score(labels, preds)),
        'macro_f1': float(f1_score(labels, preds, average='macro', zero_division=0)),
        'baseline_accuracy': float(accuracy_score(labels, baseline_preds)),
        'n': int(len(labels)),
    }
    return metrics


def write_grader_report(model, metrics, description, pairs=None):
    """Save grader metrics, a comparison figure and a model card."""
    config.GRADER_METRICS_JSON.write_text(json.dumps({
        'metrics': metrics,
        'description': description,
    }, indent=2))

    labels = ['accuracy', 'baseline_accuracy']
    values = [metrics['accuracy'], metrics['baseline_accuracy']]
    fig, ax = plt.subplots(figsize=(5, 4))
    ax.bar(labels, values, color=['steelblue', 'grey'])
    ax.set_ylim(0, 1)
    ax.set_ylabel('Score')
    ax.set_title('Grader vs exact-match baseline')
    plt.tight_layout()
    fig.savefig(config.FIGURES_DIR / 'grader_comparison.png', dpi=120)
    plt.close(fig)

    if pairs is not None:
        _plot_grader_thresholds(model, pairs)

    card = [
        '# Answer grader model card', '',
        '## Purpose', 'Acceptable free-text answers for FILL_BLANK and SPEAKING.',
        '', '## Problem formulation',
        'Three-class classification (correct / almost / wrong).', '',
        '## Training data',
        f'Synthetic labelled answer pairs ({metrics["n"]} test examples).', '',
        '## Features',
        'Character TF-IDF cosine similarity, token Jaccard, Levenshtein ratio.', '',
        '## Algorithm', 'Logistic Regression on the three similarity signals.', '',
        '## Baseline', f'Exact string match accuracy: {metrics["baseline_accuracy"]:.3f}', '',
        '## Test metrics',
        f'- Accuracy: {metrics["accuracy"]:.3f}',
        f'- Macro F1: {metrics["macro_f1"]:.3f}', '',
        '## Intended use', 'Grading short free-text ecology answers.', '',
        '## Limitations',
        'Text similarity can behave differently for non-native English speakers, '
        'unusual spelling, or valid answers expressed with uncommon wording.', '',
        '## Failure cases',
        'Valid paraphrases that share few tokens may be marked wrong, while short '
        'overlapping answers may be over-praised.', '',
        '## Ethical considerations',
        'The grader gives helpful feedback and partial credit, not punitive '
        'marking. Verdicts are suggestions, not judgements of the learner.',
    ]
    config.GRADER_MODEL_CARD.write_text('\n'.join(card))
    logger.info('Grader metrics written to %s', config.GRADER_METRICS_JSON)
def evaluate_recommender(train_df, test_df):
    """Compare the content recommender against random and most-popular baselines."""
    from ai_engine.models.recommender import train_recommender

    topic_texts = _topic_texts_map(train_df)
    topic_difficulty = _topic_difficulty_map(train_df)
    recommender = train_recommender(topic_texts, topic_difficulty)
    recommender.save()

    popular_order = list(train_df['topic'].value_counts().index)
    all_topics = list(topic_texts.keys())

    rec_scores = {'p3': [], 'r3': [], 'ndcg5': []}
    random_scores = {'p3': [], 'r3': [], 'ndcg5': []}
    popular_scores = {'p3': [], 'r3': [], 'ndcg5': []}
    rng = np.random.default_rng(config.RANDOM_SEED)

    for user_id, group in test_df.groupby('user_id'):
        if len(group) < 8:
            continue
        group = group.sort_values('timestamp')
        profile, target = group.iloc[:int(len(group) * 0.6)], group.iloc[int(len(group) * 0.6):]

        topic_acc = profile.groupby('topic')['is_correct'].mean().to_dict()
        relevant = set(target['topic'].unique())

        rec_topics = [item['topic'] for item in recommender.recommend(topic_acc, all_topics, k=5)]
        random_topics = list(all_topics)
        rng.shuffle(random_topics)

        rec_scores['p3'].append(precision_at_k(rec_topics, relevant, 3))
        rec_scores['r3'].append(recall_at_k(rec_topics, relevant, 3))
        rec_scores['ndcg5'].append(ndcg_at_k(rec_topics, relevant, 5))
        random_scores['p3'].append(precision_at_k(random_topics, relevant, 3))
        random_scores['r3'].append(recall_at_k(random_topics, relevant, 3))
        random_scores['ndcg5'].append(ndcg_at_k(random_topics, relevant, 5))
        popular_scores['p3'].append(precision_at_k(popular_order, relevant, 3))
        popular_scores['r3'].append(recall_at_k(popular_order, relevant, 3))
        popular_scores['ndcg5'].append(ndcg_at_k(popular_order, relevant, 5))

    def means(d):
        return {k: float(np.mean(v)) for k, v in d.items()}

    results = {
        'recommender': means(rec_scores),
        'random': means(random_scores),
        'most_popular': means(popular_scores),
    }
    _write_recommender_report(results)
    return results, recommender


def _write_recommender_report(results):
    config.RECOMMENDER_METRICS_JSON.write_text(json.dumps(results, indent=2))

    labels = ['Precision@3', 'Recall@3', 'NDCG@5']
    recommender = [results['recommender'][k] for k in ('p3', 'r3', 'ndcg5')]
    random_ = [results['random'][k] for k in ('p3', 'r3', 'ndcg5')]
    popular = [results['most_popular'][k] for k in ('p3', 'r3', 'ndcg5')]

    x = np.arange(len(labels))
    width = 0.25
    fig, ax = plt.subplots(figsize=(7, 4))
    ax.bar(x - width, recommender, width, label='Content recommender')
    ax.bar(x, random_, width, label='Random')
    ax.bar(x + width, popular, width, label='Most popular')
    ax.set_xticks(x); ax.set_xticklabels(labels)
    ax.set_ylim(0, 1); ax.legend(); ax.set_title('Recommender comparison')
    plt.tight_layout()
    fig.savefig(config.FIGURES_DIR / 'recommender_comparison.png', dpi=120)
    plt.close(fig)

    card = [
        '# Recommender model card', '',
        '## Purpose', 'Suggest the next ecology topics for a learner.', '',
        '## Problem formulation',
        'Rank candidate topics given a learner profile.', '',
        '## Training data',
        'TF-IDF vectors built from the simulated interaction text.', '',
        '## Features',
        'Content similarity, topic weakness, difficulty suitability.', '',
        '## Algorithm', 'TF-IDF + cosine similarity, weighted combination.', '',
        '## Baseline', 'Random and most-popular recommenders.', '',
        '## Test metrics',
        f"- Precision@3: {results['recommender']['p3']:.3f}",
        f"- Recall@3: {results['recommender']['r3']:.3f}",
        f"- NDCG@5: {results['recommender']['ndcg5']:.3f}", '',
        '## Intended use',
        'Ordering the learning path topics in the map view.', '',
        '## Limitations',
        'A recommender can narrow learner exposure if it only repeatedly suggests '
        'similar topics to the same learner.', '',
        '## Failure cases',
        'New topics with little text get low similarity; learners with sparse '
        'histories produce weak profiles.', '',
        '## Ethical considerations',
        'Recommendations should broaden, not narrow, a learner\'s exposure. '
        'The top item is never claimed to be objectively best.',
    ]
    config.RECOMMENDER_MODEL_CARD.write_text('\n'.join(card))
    logger.info('Recommender report written to %s', config.RECOMMENDER_METRICS_JSON)
def _plot_grader_thresholds(model, pairs):
    """Accuracy-vs-similarity-threshold curve to show grading behaviour."""
    sims, is_correct = [], []
    for _, row in pairs.iterrows():
        grade = model.grade(row['user_answer'], row['correct_answer'])
        sims.append(grade['similarity'])
        is_correct.append(1 if row['label'] == 'correct' else 0)
    sims = np.array(sims)
    is_correct = np.array(is_correct)

    thresholds = np.linspace(0, 1, 21)
    accs = [accuracy_score(is_correct, (sims >= t).astype(int)) for t in thresholds]

    baseline = pairs.apply(
        lambda r: int(r['user_answer'].lower().strip() == r['correct_answer'].lower().strip()),
        axis=1
    ).to_numpy()
    base_acc = accuracy_score(is_correct, baseline)

    fig, ax = plt.subplots(figsize=(6, 4))
    ax.plot(thresholds, accs, marker='o', label='Grading rule (sim >= t)')
    ax.axhline(base_acc, color='grey', ls='--', label=f'Exact-match baseline ({base_acc:.2f})')
    ax.set_xlabel('Similarity threshold')
    ax.set_ylabel('Binary accuracy')
    ax.set_title('Grader thresholds: accuracy vs similarity cutoff')
    ax.legend()
    plt.tight_layout()
    fig.savefig(config.FIGURES_DIR / 'grader_thresholds.png', dpi=120)
    plt.close(fig)
    logger.info('Model card written to %s', config.MASTERY_MODEL_CARD)