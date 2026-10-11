"""
nlp_engine.py
=============
NLP Processing Engine for the Voice-Based Student Academic Assistance Chatbot.

This module implements a complete NLP pipeline:
  1. Text cleaning and normalization
  2. Tokenization
  3. Stop-word removal
  4. Keyword extraction
  5. Intent classification (greeting / farewell / academic / unknown)
  6. Similarity-based answer matching using TF-IDF cosine similarity
"""

import re
import math
import json
import random
import os
import nltk

# ---------------------------------------------------------------------------
# Download required NLTK resources (only runs once)
# ---------------------------------------------------------------------------
_NLTK_PACKAGES = ["punkt", "stopwords", "wordnet", "punkt_tab", "averaged_perceptron_tagger"]

def _ensure_nltk_resources():
    """Download NLTK packages if they are not already present."""
    for pkg in _NLTK_PACKAGES:
        try:
            if pkg in ("punkt", "punkt_tab"):
                nltk.data.find(f"tokenizers/{pkg}")
            elif pkg == "averaged_perceptron_tagger":
                nltk.data.find(f"taggers/{pkg}")
            else:
                nltk.data.find(f"corpora/{pkg}")
        except LookupError:
            print(f"[NLP] Downloading NLTK resource: {pkg}")
            nltk.download(pkg, quiet=True)

_ensure_nltk_resources()

from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
DATA_PATH = os.path.join(os.path.dirname(__file__), "academic_data.json")

# NLTK English stop words set
_STOP_WORDS = set(stopwords.words("english"))

# Words to KEEP even if they are in stop words (they carry domain meaning)
_KEEP_WORDS = {
    "what", "how", "why", "when", "which", "where", "who",
    "is", "are", "not", "do", "does", "can", "could",
}

# Effective stop words = standard stop words MINUS keep words
_EFFECTIVE_STOP_WORDS = _STOP_WORDS - _KEEP_WORDS

_lemmatizer = WordNetLemmatizer()


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------
def load_data() -> dict:
    """Load the academic QA dataset from the JSON file."""
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

_DATA = load_data()


# ---------------------------------------------------------------------------
# Step 1 - Text Cleaning
# ---------------------------------------------------------------------------
def clean_text(text: str) -> str:
    """
    Normalize raw user input:
      - Convert to lowercase
      - Remove URLs, special characters, and extra whitespace
    """
    text = text.lower().strip()
    # Remove URLs
    text = re.sub(r"https?://\S+|www\.\S+", "", text)
    # Keep only letters, digits, spaces, apostrophes, and hyphens
    text = re.sub(r"[^a-z0-9\s'\-]", " ", text)
    # Collapse multiple spaces
    text = re.sub(r"\s+", " ", text).strip()
    return text


# ---------------------------------------------------------------------------
# Step 2 - Tokenization
# ---------------------------------------------------------------------------
def tokenize(text: str) -> list:
    """
    Split the cleaned text into individual word tokens using NLTK's
    word_tokenize, which handles contractions and punctuation correctly.
    """
    return word_tokenize(text)


# ---------------------------------------------------------------------------
# Step 3 - Stop-word Removal
# ---------------------------------------------------------------------------
def remove_stop_words(tokens: list) -> list:
    """
    Remove common, low-information words while preserving
    question words (what, how, why ...) that carry intent signals.
    """
    return [t for t in tokens if t not in _EFFECTIVE_STOP_WORDS and len(t) > 1]


# ---------------------------------------------------------------------------
# Step 4 - Lemmatization
# ---------------------------------------------------------------------------
def lemmatize_tokens(tokens: list) -> list:
    """
    Reduce each token to its dictionary base form (lemma).
    Example: 'running' -> 'run', 'trees' -> 'tree'
    """
    return [_lemmatizer.lemmatize(t) for t in tokens]


# ---------------------------------------------------------------------------
# Step 5 - Full Preprocessing Pipeline
# ---------------------------------------------------------------------------
def preprocess(text: str) -> list:
    """
    Run the complete NLP preprocessing pipeline:
    clean -> tokenize -> remove stop words -> lemmatize
    Returns a list of meaningful lemmatized tokens.
    """
    cleaned = clean_text(text)
    tokens = tokenize(cleaned)
    filtered = remove_stop_words(tokens)
    lemmas = lemmatize_tokens(filtered)
    return lemmas


# ---------------------------------------------------------------------------
# Step 6 - Intent Classification
# ---------------------------------------------------------------------------
def classify_intent(text: str) -> str:
    """
    Classify the user's message into one of four intents:
      'greeting'  - the user is saying hello
      'farewell'  - the user is saying goodbye
      'academic'  - the user is asking an academic question
      'unknown'   - cannot be classified
    """
    cleaned = clean_text(text)
    tokens = set(tokenize(cleaned))

    # Check greeting patterns
    greeting_words = set(_DATA["greetings"]["patterns"])
    if tokens & greeting_words:
        return "greeting"

    # Check farewell patterns
    farewell_words = set(_DATA["farewell"]["patterns"])
    if tokens & farewell_words:
        return "farewell"

    # If the message has substantive tokens, treat it as an academic question
    meaningful_tokens = preprocess(text)
    if len(meaningful_tokens) >= 1:
        return "academic"

    return "unknown"


# ---------------------------------------------------------------------------
# TF-IDF Helpers
# ---------------------------------------------------------------------------
def _build_corpus(qa_list: list) -> list:
    """
    Build a flat corpus where each document represents one QA entry.
    We combine the question text and its keywords for richer matching.
    """
    docs = []
    for qa in qa_list:
        keyword_str = " ".join(qa.get("keywords", []))
        combined = qa["question"] + " " + keyword_str
        docs.append(combined)
    return docs


def _tf(term: str, doc_tokens: list) -> float:
    """Term Frequency: proportion of a term in a document."""
    if not doc_tokens:
        return 0.0
    return doc_tokens.count(term) / len(doc_tokens)


def _idf(term: str, all_docs_tokens: list) -> float:
    """Inverse Document Frequency: log(N / df+1) to avoid division by zero."""
    n = len(all_docs_tokens)
    df = sum(1 for doc in all_docs_tokens if term in doc)
    return math.log((n + 1) / (df + 1)) + 1.0


def _tfidf_vector(query_tokens: list, doc_tokens: list, all_docs_tokens: list) -> dict:
    """Compute TF-IDF scores for query terms against a document."""
    scores = {}
    for term in set(query_tokens):
        scores[term] = _tf(term, doc_tokens) * _idf(term, all_docs_tokens)
    return scores


def _cosine_similarity(vec_a: dict, vec_b: dict) -> float:
    """
    Compute cosine similarity between two TF-IDF dictionaries.
    Returns a value in [0, 1].
    """
    common_terms = set(vec_a.keys()) & set(vec_b.keys())
    if not common_terms:
        return 0.0

    dot = sum(vec_a[t] * vec_b.get(t, 0.0) for t in common_terms)
    mag_a = math.sqrt(sum(v ** 2 for v in vec_a.values()))
    mag_b = math.sqrt(sum(v ** 2 for v in vec_b.values()))

    if mag_a == 0 or mag_b == 0:
        return 0.0
    return dot / (mag_a * mag_b)


# ---------------------------------------------------------------------------
# Step 7 - Keyword Matching (fast first pass)
# ---------------------------------------------------------------------------
def _keyword_score(query_tokens: list, qa_entry: dict) -> int:
    """
    Count how many of the QA entry's keywords appear in the query tokens.
    Used as a fast pre-filter before TF-IDF.
    """
    query_set = set(query_tokens)
    keyword_tokens = []
    for kw in qa_entry.get("keywords", []):
        keyword_tokens.extend(preprocess(kw))
    return len(query_set & set(keyword_tokens))


# ---------------------------------------------------------------------------
# Step 8 - Main Answer Retrieval
# ---------------------------------------------------------------------------
CONFIDENCE_THRESHOLD = 0.05   # Minimum cosine similarity to return an answer

def find_best_answer(user_input: str) -> dict:
    """
    Given raw user input, find the most relevant answer from the dataset.

    Returns a dict with:
      - answer (str): The response text
      - intent (str): Detected intent
      - confidence (float): Similarity score [0-1]
      - matched_question (str | None): The matched QA question, if any
      - topic (str | None): Topic of the matched answer
    """
    intent = classify_intent(user_input)

    # --- Handle greetings ---
    if intent == "greeting":
        return {
            "answer": random.choice(_DATA["greetings"]["responses"]),
            "intent": "greeting",
            "confidence": 1.0,
            "matched_question": None,
            "topic": "general",
        }

    # --- Handle farewells ---
    if intent == "farewell":
        return {
            "answer": random.choice(_DATA["farewell"]["responses"]),
            "intent": "farewell",
            "confidence": 1.0,
            "matched_question": None,
            "topic": "general",
        }

    # --- Academic intent: run NLP pipeline ---
    query_tokens = preprocess(user_input)

    if not query_tokens:
        return _fallback_response(intent)

    qa_list = _DATA["academic_qa"]
    corpus = _build_corpus(qa_list)

    # Preprocess each corpus document
    all_docs_tokens = [preprocess(doc) for doc in corpus]

    best_score = 0.0
    best_entry = None

    for idx, qa in enumerate(qa_list):
        doc_tokens = all_docs_tokens[idx]

        # Fast keyword pre-score (bonus weight)
        kw_score = _keyword_score(query_tokens, qa)

        # TF-IDF cosine similarity
        query_vec = _tfidf_vector(query_tokens, query_tokens, all_docs_tokens)
        doc_vec = _tfidf_vector(query_tokens, doc_tokens, all_docs_tokens)
        cos_sim = _cosine_similarity(query_vec, doc_vec)

        # Combined score: cosine similarity + keyword bonus
        combined = cos_sim + (0.15 * kw_score)

        if combined > best_score:
            best_score = combined
            best_entry = qa

    # --- Return best match or fallback ---
    if best_entry and best_score >= CONFIDENCE_THRESHOLD:
        return {
            "answer": best_entry["answer"],
            "intent": "academic",
            "confidence": round(min(best_score, 1.0), 4),
            "matched_question": best_entry["question"],
            "topic": best_entry.get("topic", "general"),
        }

    return _fallback_response(intent)


def _fallback_response(intent: str) -> dict:
    """Return a helpful fallback when no answer is found with sufficient confidence."""
    return {
        "answer": random.choice(_DATA["fallback_responses"]),
        "intent": intent,
        "confidence": 0.0,
        "matched_question": None,
        "topic": None,
    }


# ---------------------------------------------------------------------------
# Suggested Questions - for the UI chips
# ---------------------------------------------------------------------------
def get_suggested_questions(n: int = 6) -> list:
    """Return a random selection of suggested questions for the UI."""
    all_questions = [qa["question"] for qa in _DATA["academic_qa"]]
    return random.sample(all_questions, min(n, len(all_questions)))
