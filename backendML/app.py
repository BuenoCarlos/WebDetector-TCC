import os

from ml_api import build_app

app = build_app()

if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=int(os.getenv("ML_PORT", "5000")),
        debug=False
    )
