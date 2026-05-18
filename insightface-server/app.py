"""
InsightFace local API server
Matches the request/response format expected by backend/src/utils/insightFace.js

POST /compare
{
  "token": "<INSIGHTFACE_TOKEN>",
  "queryImage":     { "data": "<base64>", "mimeType": "image/jpeg" },
  "referenceImage": { "data": "<base64>", "mimeType": "image/jpeg" }
}

Response:
{ "score": 0-100, "similarity": 0.0-1.0 }
"""

import os
import base64
import io
import numpy as np
from flask import Flask, request, jsonify
from PIL import Image
import insightface
from insightface.app import FaceAnalysis

app = Flask(__name__)

TOKEN = os.environ.get("INSIGHTFACE_TOKEN", "1KioG8FWMS2R4sVGRR4uKDHHB3LnRzL76b")

# Load model once at startup
print("Loading InsightFace model (buffalo_sc)...")
face_app = FaceAnalysis(name="buffalo_sc", providers=["CPUExecutionProvider"])
face_app.prepare(ctx_id=0, det_size=(640, 640))
print("InsightFace model loaded.")


def decode_image(b64_data: str) -> np.ndarray:
    """Decode base64 image to numpy BGR array for InsightFace."""
    img_bytes = base64.b64decode(b64_data)
    pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    # InsightFace expects BGR
    return np.array(pil_img)[:, :, ::-1]


def get_embedding(img_array: np.ndarray):
    """Extract face embedding. Returns None if no face detected."""
    faces = face_app.get(img_array)
    if not faces:
        return None
    # Use the largest face (by bounding box area)
    largest = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    return largest.normed_embedding


def cosine_similarity(a, b) -> float:
    """Cosine similarity between two normalized embeddings."""
    return float(np.dot(a, b))


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True, "model": "buffalo_sc"})


@app.route("/compare", methods=["POST"])
def compare():
    data = request.get_json(force=True)

    # Token check
    if data.get("token") != TOKEN:
        return jsonify({"error": "Unauthorized"}), 401

    query_data = data.get("queryImage", {}).get("data")
    ref_data   = data.get("referenceImage", {}).get("data")

    if not query_data or not ref_data:
        return jsonify({"error": "Both queryImage and referenceImage are required"}), 400

    try:
        query_img = decode_image(query_data)
        ref_img   = decode_image(ref_data)
    except Exception as e:
        return jsonify({"error": f"Image decode failed: {str(e)}"}), 400

    query_emb = get_embedding(query_img)
    ref_emb   = get_embedding(ref_img)

    if query_emb is None:
        return jsonify({"error": "No face detected in query image", "score": 0, "similarity": 0.0})

    if ref_emb is None:
        return jsonify({"error": "No face detected in reference image", "score": 0, "similarity": 0.0})

    similarity = cosine_similarity(query_emb, ref_emb)
    # Map cosine similarity (typically 0.2–1.0 for same person) to 0–100 score
    # Threshold ~0.3 is commonly used for InsightFace buffalo models
    score = max(0, min(100, round((similarity - 0.0) / 1.0 * 100)))

    return jsonify({
        "similarity": round(similarity, 4),
        "score": score
    })


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7000))
    print(f"InsightFace API running on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
