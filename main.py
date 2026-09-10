import os
from flask import Flask, jsonify

app = Flask(__name__)


@app.get("/")
def health():
    return jsonify(ok=True, service="808dystopia-core")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "10000"))
    app.run(host="0.0.0.0", port=port)
