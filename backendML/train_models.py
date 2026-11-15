"""Treina dois classificadores: request (Valid/Anomalous), payload (norm/sqli/xss).

Train/val/test group split no primeiro conjunto; train/val a partir de payload_train,
held-out payload_test intocado para avaliação final. Métricas reais, não simuladas.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import warnings

import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, classification_report,
                             confusion_matrix, f1_score, precision_score, recall_score)
from sklearn.model_selection import GroupShuffleSplit
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC

ROOT = Path(__file__).resolve().parent
DATASETS = ROOT.parent / 'datasets'
MODELS = ROOT / 'models'
RANDOM_SEED = 42


def algorithms():
    # TF-IDF adequado para texto curto e variações de caracteres de payloads.
    return {
        'Regressão Logística': LogisticRegression(max_iter=800, class_weight='balanced', random_state=RANDOM_SEED),
        'Naive Bayes': MultinomialNB(alpha=0.7),
        'SVM Linear': LinearSVC(class_weight='balanced', random_state=RANDOM_SEED),
        'Random Forest': RandomForestClassifier(n_estimators=65, max_depth=28, min_samples_leaf=2,
                                                class_weight='balanced_subsample', n_jobs=-1, random_state=RANDOM_SEED),
    }


def make_pipeline(estimator):
    return Pipeline([
        ('vectorizer', TfidfVectorizer(analyzer='char', ngram_range=(2, 4),
                                       min_df=2, max_features=30000, sublinear_tf=True)),
        ('model', clone(estimator)),
    ])


def group_split(frame, *, test_size):
    groups = frame['text'].str.casefold().str.strip()
    splitter = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=RANDOM_SEED)
    train_idx, test_idx = next(splitter.split(frame['text'], frame['label'], groups))
    return frame.iloc[train_idx].reset_index(drop=True), frame.iloc[test_idx].reset_index(drop=True)


def load_request(path):
    frame = pd.read_csv(path, sep='«', engine='python', dtype=str).fillna('')
    if not {'Class', 'Method', 'Request'}.issubset(frame.columns):
        raise ValueError('CSV de requisições deve conter Class,Method,Request (separador «).')
    frame = frame[frame['Class'].isin(['Valid', 'Anomalous'])].copy()
    frame['label'] = frame['Class']
    frame['text'] = frame['Method'].str.upper().str.strip() + ' ' + frame['Request'].str.strip()
    frame = frame.drop_duplicates(['text', 'label'])
    if frame.groupby('text')['label'].nunique().gt(1).any():
        raise ValueError('Há requisições idênticas com rótulos conflitantes.')
    return frame[['text', 'label']].reset_index(drop=True)


def load_payload(path):
    frame = pd.read_csv(path, dtype=str, keep_default_na=False)
    if not {'payload', 'attack_type', 'label'}.issubset(frame.columns):
        raise ValueError('CSV de payloads deve conter payload,attack_type,label.')
    frame = frame[frame['attack_type'].isin(['norm', 'sqli', 'xss'])].copy()
    frame['text'] = frame['payload'].astype(str)
    frame['label'] = frame['attack_type']
    frame = frame.drop_duplicates(['text', 'label'])
    if frame.groupby('text')['label'].nunique().gt(1).any():
        raise ValueError('Há payloads idênticos com categorias conflitantes.')
    return frame[['text', 'label']].reset_index(drop=True)


def scores(model, dataset, labels):
    preds = model.predict(dataset['text'])
    truth = dataset['label'].to_numpy()
    return {
        'accuracy': round(float(accuracy_score(truth, preds)), 6),
        'precision': round(float(precision_score(truth, preds, labels=labels, average='macro', zero_division=0)), 6),
        'recall': round(float(recall_score(truth, preds, labels=labels, average='macro', zero_division=0)), 6),
        'f1': round(float(f1_score(truth, preds, labels=labels, average='macro', zero_division=0)), 6),
        'confusion_matrix': confusion_matrix(truth, preds, labels=labels).tolist(),
        'per_class': classification_report(truth, preds, labels=labels, output_dict=True, zero_division=0),
    }


def train_stage(name, train, test, labels):
    fit, validation = group_split(train, test_size=.20)
    if set(fit.label) != set(labels) or set(validation.label) != set(labels) or set(test.label) != set(labels):
        raise ValueError(f'Faltam classes na divisão do estágio {name}.')
    rows = []
    params = algorithms()
    print(f'\n[{name}] train={len(fit)}, validation={len(validation)}, test={len(test)}', flush=True)
    for label, estimator in params.items():
        model = make_pipeline(estimator)
        model.fit(fit['text'], fit['label'])
        val = scores(model, validation, labels)
        rows.append({'algorithm': label, 'validation': {k: val[k] for k in ('accuracy','precision','recall','f1')}})
        print(f'  validação {label}: F1 macro={val["f1"]:.4f}', flush=True)
    best = max(rows, key=lambda row: (row['validation']['f1'], row['validation']['recall']))['algorithm']
    # Reajusta os quatro modelos com todo conjunto de treino antes de avaliar o held-out.
    final_rows = []
    for row in rows:
        label = row['algorithm']
        model = make_pipeline(params[label])
        model.fit(train['text'], train['label'])
        test_scores = scores(model, test, labels)
        final_rows.append({'algorithm': label, 'validation': row['validation'], **test_scores})
        print(f'  teste {label}: acurácia={test_scores["accuracy"]:.4f}, F1 macro={test_scores["f1"]:.4f}', flush=True)
        if label == best:
            joblib.dump(model, MODELS / f'{name}.joblib')
    return {'best_algorithm': best, 'labels': labels, 'metric_selection': 'F1 macro da validação',
            'sizes': {'train_total': len(train), 'validation_for_selection': len(validation), 'test': len(test)},
            'results': final_rows}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--request', default=str(DATASETS / 'dataset_request_classifier.csv'))
    parser.add_argument('--payload-train', default=str(DATASETS / 'payload_train.csv'))
    parser.add_argument('--payload-test', default=str(DATASETS / 'payload_test.csv'))
    parser.add_argument('--smoke', action='store_true', help='Teste técnico rápido em amostras; NÃO usar métricas no artigo.')
    args = parser.parse_args()
    MODELS.mkdir(parents=True, exist_ok=True)
    requests = load_request(args.request)
    req_train, req_test = group_split(requests, test_size=.20)
    attack_train = load_payload(args.payload_train)
    attack_test = load_payload(args.payload_test)
    intersection = set(attack_train.text.str.casefold()) & set(attack_test.text.str.casefold())
    if intersection:
        warnings.warn(f'{len(intersection)} payloads aparecem em treino e teste; serão removidos do teste.')
        attack_test = attack_test[~attack_test.text.str.casefold().isin(intersection)].copy()
    if args.smoke:
        def take(frame, n):
            return frame.groupby('label', group_keys=False).sample(
                n=min(n, int(frame.label.value_counts().min())), random_state=RANDOM_SEED
            ).reset_index(drop=True)
        req_train, req_test = take(req_train, 100), take(req_test, 35)
        attack_train, attack_test = take(attack_train, 80), take(attack_test, 30)
    summary = {
        'smoke': bool(args.smoke), 'note': 'Dados de requisições: Valid/Anomalous. Payloads: norm/sqli/xss; outras categorias excluídas.',
        'request': train_stage('request', req_train, req_test, ['Valid','Anomalous']),
        'attack': train_stage('attack', attack_train, attack_test, ['norm','sqli','xss']),
    }
    (MODELS / 'metrics.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
    print('\nTreinamento concluído. Salvo em backendML/models. Smoke=',args.smoke, flush=True)

if __name__ == '__main__':
    main()
