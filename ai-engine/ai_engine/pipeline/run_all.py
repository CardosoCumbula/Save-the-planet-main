"""End-to-end pipeline for the AI engine.

Run with:

    python -m ai_engine.pipeline.run_all

Stages:

    1. simulate data
    2. prepare data
    3. train mastery (fit + save)
    4. train grader
    5. train recommender
    6. evaluate all
    7. write reports
"""

import logging

import pandas as pd
from sklearn.model_selection import train_test_split

from ai_engine import config
from ai_engine.data import features, prepare, simulate
from ai_engine.evaluation import evaluate
from ai_engine.models import grader as grader_module
from ai_engine.models import mastery as mastery_module

logger = logging.getLogger(__name__)

TOTAL_STEPS = 7


def _banner(step: int, message: str):
    print(f'[{step}/{TOTAL_STEPS}] {message}')


def _prepare_labelled_pairs():
    """Randomly split the labelled answer pairs with class balance preserved."""
    pairs = pd.read_csv(config.GRADER_PAIRS_RAW)
    train, test = train_test_split(
        pairs, test_size=0.2, stratify=pairs['label'],
        random_state=config.RANDOM_SEED)
    return train, test


def run():
    _banner(1, 'Generating synthetic data...')
    simulate.generate_interactions()
    simulate.generate_grader_pairs()

    _banner(2, 'Preparing data...')
    prepare.prepare_all()

    _banner(3, 'Training mastery model...')
    train = pd.read_csv(config.TRAIN_FILE)
    test = pd.read_csv(config.VALIDATION_FILE)
    X_train, feature_names = features.build_mastery_features(train)
    y_train = train['is_correct'].to_numpy()
    X_test, _ = features.build_mastery_features(test)
    y_test = test['is_correct'].to_numpy()
    master = mastery_module.train_mastery(X_train, y_train, feature_names)
    master.save()

    _banner(4, 'Training answer grader...')
    pairs_train, pairs_test = _prepare_labelled_pairs()
    grader = grader_module.train_grader(pairs_train)
    grader.save()

    _banner(5, 'Training recommender...')
    recommender_results, _ = evaluate.evaluate_recommender(train, test)

    _banner(6, 'Evaluating models...')
    metrics, y_pred, y_prob = evaluate.evaluate_classifier(master.model, X_test, y_test)
    baselines = {
        'majority_class': evaluate.majority_class_baseline(y_train, y_test),
        'accuracy_heuristic': evaluate.accuracy_heuristic_baseline(y_train, y_test),
    }
    cv = evaluate.cross_validate_models(X_train, y_train)
    grader_metrics = evaluate.evaluate_grader(grader, pairs_test)
    evaluate.plot_metrics(master.model, X_test, y_test, y_pred, y_prob, feature_names)

    _banner(7, 'Writing reports...')
    evaluate.write_mastery_report(metrics, baselines, cv, master.algorithm)
    evaluate.write_grader_report(grader, grader_metrics,
                                 'Synthetic labelled pairs, 80/20 class-stratified split',
                                 pairs_test)
    _write_summary(metrics, baselines, grader_metrics, recommender_results)

    print()
    print('Pipeline completed successfully.')
    print()
    print('Summary:')
    print(f"Dataset rows  : {len(pd.read_csv(config.TRAIN_FILE)) + len(test)}")
    print(f"Train rows    : {len(X_train)}   Validation rows: {len(test)}")
    print(f"Mastery accuracy : {metrics['accuracy']:.4f}  ROC-AUC: {metrics['roc_auc']:.4f}")
    print(f"Mastery baseline : {baselines['majority_class']['accuracy']:.4f}"
          f"  delta: {metrics['accuracy'] - baselines['majority_class']['accuracy']:+.4f}")
    print(f"Grader accuracy  : {grader_metrics['accuracy']:.4f}"
          f"  baseline: {grader_metrics['baseline_accuracy']:.4f}")
    print(f"Recommender P@3  : {recommender_results['recommender']['p3']:.4f}"
          f"  NDCG@5: {recommender_results['recommender']['ndcg5']:.4f}")


def _write_summary(metrics, baselines, grader_metrics, recommender_results):
    """Write the one-row-per-model summary table used by the README."""
    rows = [
        {
            'model': 'mastery',
            'task': 'predict next-answer correctness',
            'algorithm': 'LogisticRegression',
            'baseline_score': baselines['majority_class']['accuracy'],
            'model_score': metrics['accuracy'],
            'headline_metric': 'accuracy',
            'delta': metrics['accuracy'] - baselines['majority_class']['accuracy'],
        },
        {
            'model': 'grader',
            'task': 'grade free-text answers',
            'algorithm': 'LogisticRegression + TF-IDF',
            'baseline_score': grader_metrics['baseline_accuracy'],
            'model_score': grader_metrics['accuracy'],
            'headline_metric': 'accuracy',
            'delta': grader_metrics['accuracy'] - grader_metrics['baseline_accuracy'],
        },
        {
            'model': 'recommender',
            'task': 'recommend next topics',
            'algorithm': 'TFIDFContentBased',
            'baseline_score': recommender_results['random']['p3'],
            'model_score': recommender_results['recommender']['p3'],
            'headline_metric': 'precision@3',
            'delta': (recommender_results['recommender']['p3']
                      - recommender_results['random']['p3']),
        },
    ]
    summary = pd.DataFrame(rows)
    summary.to_csv(config.SUMMARY_CSV, index=False)
    print(summary.to_string(index=False))


if __name__ == '__main__':
    run()