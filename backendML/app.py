
import os

from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

app = Flask(__name__)

CORS(app, origins=[
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173"
])

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")

if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
    raise RuntimeError(
        "Configure as variáveis do Supabase no arquivo .env"
    )

supabase = create_client(
    SUPABASE_URL,
    SUPABASE_SECRET_KEY
)


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "online",
        "message": "Backend WebDetector funcionando"
    })


@app.route("/api/database/test", methods=["GET"])
def testar_conexao():
    try:
        supabase.table("scenarios") \
            .select("id") \
            .limit(1) \
            .execute()

        return jsonify({
            "status": "connected",
            "message": "Conexao com Supabase realizada",
            "database": "PostgreSQL"
        }), 200

    except Exception:
        app.logger.exception("Erro na conexao com Supabase")

        return jsonify({
            "status": "error",
            "message": "Falha ao consultar o banco de dados."
        }), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
