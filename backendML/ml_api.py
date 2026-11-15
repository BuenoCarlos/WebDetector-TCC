"""API ML unificada: classificação de requisições e de ataques + avaliação HTTP."""
from __future__ import annotations
import json
import os
from pathlib import Path
from urllib.parse import urlencode

from evidence_engine import analyze

ROOT = Path(__file__).resolve().parent
MODELS = ROOT / 'models'
_app_models = {}
_metrics = None


def initialize():
    global _metrics
    if _metrics is not None:
        return
    import joblib
    file = MODELS / 'metrics.json'
    if not file.exists():
        raise RuntimeError('Execute primeiro: python train_models.py')
    metrics = json.loads(file.read_text(encoding='utf-8'))
    if metrics.get('smoke'):
        raise RuntimeError('Os modelos atuais foram treinados em --smoke; execute o treino completo sem --smoke.')
    loaded = {stage: joblib.load(MODELS / f'{stage}.joblib') for stage in ('request','attack')}
    _app_models.update(loaded)
    _metrics = metrics


def classify_request(method: str, field: str, payload: str):
    initialize()
    x = f'{method.upper()} {urlencode({field: payload})}'
    label = str(_app_models['request'].predict([x])[0])
    return {'classification':label,'algorithm':_metrics['request']['best_algorithm'],
            'confidence': None, 'description': 'Classificação de conteúdo da requisição (Valid/Anomalous), não de exploração.'}


def classify_attack(payload: str):
    initialize()
    label = str(_app_models['attack'].predict([payload])[0])
    return {'classification':label,'algorithm':_metrics['attack']['best_algorithm'],
            'confidence':None,'description':'Tipo do payload (norm/sqli/xss) previsto pelo modelo supervisionado.'}


def build_app():
    from flask import Flask, jsonify, request
    app = Flask(__name__)
    app.config['MAX_CONTENT_LENGTH'] = 50000

    @app.get('/api/ml/health')
    def health():
        try:
            initialize()
            return jsonify({'status':'ready','models':list(_app_models),'types':['SQLI','XSS']})
        except Exception as e:
            return jsonify({'status':'not_ready','error':str(e)}),503

    @app.get('/api/ml/metrics')
    def metrics():
        initialize()
        return jsonify(_metrics)

    @app.post('/api/ml/predict')
    def predict():
        data = request.get_json(silent=True) or {}
        try:
            method = str(data.get('method','GET'))
            field = str(data.get('field','payload'))
            payload = str(data.get('payload',''))[:5000]
            return jsonify({'request_ml':classify_request(method,field,payload),
                            'attack_ml':classify_attack(payload)})
        except Exception as e:
            return jsonify({'error':str(e)}),503

    @app.post('/api/ml/analyze')
    def evaluate():
        data = request.get_json(silent=True)
        if not isinstance(data,dict) or data.get('attackType') not in ('SQLI','XSS'):
            return jsonify({'error':'Informe JSON e attackType SQLI ou XSS.'}),400
        try:
            result = analyze(data)
        except ValueError as e:
            return jsonify({'error':str(e)}),400
        ml = None
        ml_error = None
        try:
            req = data.get('request') or {}
            payload = str(req.get('payload',''))[:5000]
            ml = {'request':classify_request(str(req.get('method','GET')), str(req.get('field','payload')),payload),
                  'attack':classify_attack(payload)}
        except Exception as e:
            ml_error = str(e)
        return jsonify({**result,'ml':ml,'ml_error':ml_error})

    return app


if __name__ == '__main__':
    app = build_app()
    app.run(host='127.0.0.1',port=int(os.getenv('ML_PORT','5000')),debug=False)
