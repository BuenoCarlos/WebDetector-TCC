"""Treina dois classificadores: request (Valid/Anomalous), payload (norm/sqli/xss).
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import warnings
import re

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
DATASETS = ROOT / "datasets"
CANDIDATOS = ROOT / "candidatos"
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


def group_key(text, grouping="exact"):
    text = str(text).casefold().strip()

    if grouping == "template":
        text = re.sub(r"\b[0-9a-f]{24,}\b", "<hex>", text)
        text = re.sub(r"\b\d+\b", "<numero>", text)

    return text

def group_split(frame, *, test_size, grouping="exact"):
    groups = frame["text"].map(
        lambda text: group_key(text, grouping)
    )

    splitter = GroupShuffleSplit(
        n_splits=1,
        test_size=test_size,
        random_state=RANDOM_SEED
    )

    train_idx, test_idx = next(
        splitter.split(
            frame["text"],
            frame["label"],
            groups=groups
        )
    )

    train = frame.iloc[train_idx].reset_index(drop=True)
    test = frame.iloc[test_idx].reset_index(drop=True)

    return train, test

def check_no_overlap(train, test, grouping="exact"):
    train_keys = set(
        train["text"].map(
            lambda text: group_key(text, grouping)
        )
    )

    test_keys = set(
        test["text"].map(
            lambda text: group_key(text, grouping)
        )
    )

    repeated = train_keys.intersection(test_keys)

    if repeated:
        raise ValueError(
            f"Vazamento de dados: {len(repeated)} "
            "entradas compartilhadas entre conjuntos."
        )

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


def train_stage(
    name,
    train,
    test,
    labels,
    grouping,
    output_dir
):
    fit, validation = group_split(
        train,
        test_size=0.20,
        grouping=grouping
    )

    check_no_overlap(fit, validation, grouping)
    check_no_overlap(train, test, "exact")

    for description, dataset in [
        ("treinamento", fit),
        ("validação", validation),
        ("teste", test)
    ]:
        missing = set(labels) - set(dataset["label"])

        if missing:
            raise ValueError(
                f"{name}: classes ausentes em "
                f"{description}: {missing}"
            )

    algorithms_list = algorithms()
    validation_results = []

    print(f"\nModelo: {name}")
    print(f"Treinamento: {len(fit)}")
    print(f"Validação: {len(validation)}")
    print(f"Teste: {len(test)}")

    for algorithm_name, estimator in algorithms_list.items():
        model = make_pipeline(estimator)

        model.fit(
            fit["text"],
            fit["label"]
        )

        result = scores(
            model,
            validation,
            labels
        )

        validation_results.append({
            "algorithm": algorithm_name,
            "validation": {
                key: result[key]
                for key in (
                    "accuracy",
                    "precision",
                    "recall",
                    "f1"
                )
            }
        })

        print(
            f"Validação - {algorithm_name}: "
            f"F1 macro = {result['f1']:.4f}"
        )

    best = max(
        validation_results,
        key=lambda item: (
            item["validation"]["f1"],
            item["validation"]["recall"]
        )
    )["algorithm"]

    final_results = []

    for item in validation_results:
        algorithm_name = item["algorithm"]

        model = make_pipeline(
            algorithms_list[algorithm_name]
        )

        model.fit(
            train["text"],
            train["label"]
        )

        result = scores(model, test, labels)

        final_results.append({
            "algorithm": algorithm_name,
            "validation": item["validation"],
            **result
        })

        print(
            f"Teste - {algorithm_name}: "
            f"F1 macro = {result['f1']:.4f}"
        )

        if algorithm_name == best:
            joblib.dump(
                model,
                output_dir / f"{name}.joblib"
            )

    return {
        "best_algorithm": best,
        "labels": labels,
        "metric_selection": "F1 macro da validação",
        "sizes": {
            "train_total": len(train),
            "train_for_selection": len(fit),
            "validation_for_selection": len(validation),
            "test": len(test)
        },
        "results": final_results
    }


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--request",
        default=str(
            DATASETS / "dataset_request_classifier.csv"
        )
    )

    parser.add_argument(
        "--payload-train",
        default=str(DATASETS / "payload_train.csv")
    )

    parser.add_argument(
        "--payload-test",
        default=str(DATASETS / "payload_test.csv")
    )

    parser.add_argument(
        "--grouping",
        choices=["exact", "template"],
        default="exact"
    )

    parser.add_argument(
        "--smoke",
        action="store_true"
    )

    args = parser.parse_args()

    folder_name = args.grouping

    if args.smoke:
        folder_name += "_smoke"

    output_dir = CANDIDATOS / folder_name
    output_dir.mkdir(parents=True, exist_ok=True)

    requests = load_request(args.request)

    attack_train = load_payload(args.payload_train)
    attack_test = load_payload(args.payload_test)

    req_train, req_test = group_split(
        requests,
        test_size=0.20,
        grouping=args.grouping
    )

    check_no_overlap(
        req_train,
        req_test,
        args.grouping
    )

    check_no_overlap(
        attack_train,
        attack_test,
        "exact"
    )

    if args.smoke:
        def take(frame, n):
            quantity = min(
                n,
                int(frame["label"].value_counts().min())
            )

            return frame.groupby(
                "label",
                group_keys=False
            ).sample(
                n=quantity,
                random_state=RANDOM_SEED
            ).reset_index(drop=True)

        req_train = take(req_train, 100)
        req_test = take(req_test, 35)

        attack_train = take(attack_train, 80)
        attack_test = take(attack_test, 30)

    summary = {
        "smoke": args.smoke,
        "grouping": args.grouping,
        "random_seed": RANDOM_SEED,
        "note": (
            "Requisições: Valid/Anomalous. "
            "Payloads: norm/sqli/xss."
        ),
        "request": train_stage(
            "request",
            req_train,
            req_test,
            ["Valid", "Anomalous"],
            args.grouping,
            output_dir
        ),
        "attack": train_stage(
            "attack",
            attack_train,
            attack_test,
            ["norm", "sqli", "xss"],
            args.grouping,
            output_dir
        )
    }

    metrics_path = output_dir / "metrics.json"

    metrics_path.write_text(
        json.dumps(
            summary,
            ensure_ascii=False,
            indent=2
        ),
        encoding="utf-8"
    )

    print("\nTreinamento finalizado.")
    print(f"Resultados: {output_dir}")

    if args.smoke:
        print(
            "ATENÇÃO: teste rápido. "
            "Não utilizar essas métricas no TCC."
        )


if __name__ == "__main__":
    main()