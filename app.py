"""
app.py
======
Flask backend for the Voice-Based Student Academic Assistance Chatbot.

Endpoints:
  GET  /              - Serves the main chatbot UI
  POST /chat          - Accepts user message, runs NLP, returns answer JSON
  GET  /suggestions   - Returns a list of suggested questions for the UI
  GET  /health        - Simple health-check endpoint
"""

from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import nlp_engine as nlp

# ---------------------------------------------------------------------------
# Application Setup
# ---------------------------------------------------------------------------
app = Flask(__name__)
CORS(app)   # Allow cross-origin requests (useful during local development)

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    """Serve the main chatbot HTML page."""
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    """
    Main chat endpoint.

    Expects JSON body:  { "message": "<user question>" }
    Returns JSON:       { "answer": "...", "intent": "...",
                          "confidence": 0.95, "matched_question": "...",
                          "topic": "..." }
    """
    # --- Input validation ---
    data = request.get_json(silent=True)
    if not data or "message" not in data:
        return jsonify({"error": "Request body must include a 'message' field."}), 400

    user_message = data["message"].strip()

    if not user_message:
        return jsonify({"error": "Message cannot be empty."}), 400

    if len(user_message) > 500:
        return jsonify({"error": "Message too long. Please keep it under 500 characters."}), 400

    # --- Run NLP pipeline ---
    try:
        result = nlp.find_best_answer(user_message)
    except Exception as e:
        app.logger.error(f"NLP error: {e}")
        return jsonify({"error": "Internal NLP processing error. Please try again."}), 500

    # --- Build and return response ---
    return jsonify({
        "answer": result["answer"],
        "intent": result["intent"],
        "confidence": result["confidence"],
        "matched_question": result.get("matched_question"),
        "topic": result.get("topic"),
    })


@app.route("/suggestions", methods=["GET"])
def suggestions():
    """
    Return a shuffled list of suggested academic questions for the UI chips.
    Query param: n (int, default 6) — number of suggestions to return.
    """
    try:
        n = int(request.args.get("n", 6))
        n = max(1, min(n, 12))   # Clamp between 1 and 12
    except ValueError:
        n = 6

    questions = nlp.get_suggested_questions(n)
    return jsonify({"suggestions": questions})


@app.route("/health", methods=["GET"])
def health():
    """Health-check endpoint — useful for verifying the server is running."""
    return jsonify({"status": "ok", "message": "Chatbot backend is running."})


# ---------------------------------------------------------------------------
# Entry Point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("=" * 60)
    print("  Voice-Based Student Academic Assistance Chatbot")
    print("  Starting Flask server on http://127.0.0.1:5000")
    print("=" * 60)
    # debug=True enables auto-reload on code changes (dev only)
    app.run(debug=True, host="127.0.0.1", port=5000)
