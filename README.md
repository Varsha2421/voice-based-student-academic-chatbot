# Voice-Based Student Academic Assistance Chatbot

A complete NLP-powered chatbot for college students that supports **voice input**, **text input**, and **spoken responses**. It answers academic questions on topics including NLP, AI/ML, Python, Java, Data Structures, DBMS/SQL, and study/exam tips.

---

## 🚀 Features

| Feature | Details |
|---|---|
| 🎤 Voice Input | Web Speech API (Chrome/Edge) captures spoken questions |
| 💬 Text Input | Type and submit questions manually |
| 🧠 NLP Pipeline | Clean → Tokenize → Stop-word removal → Lemmatize → TF-IDF matching |
| 🔊 Text-to-Speech | Browser SpeechSynthesis reads answers aloud |
| 📚 42 Q&A Entries | Covers NLP, AI/ML, Python, Java, DSA, DBMS, exam, study tips |
| 🏷️ Intent Detection | Classifies greeting / farewell / academic / unknown |
| 💡 Suggestions | Dynamic suggested questions from the dataset |
| 📊 Session Stats | Tracks questions asked and answers given |
| 🌙 Dark UI | Modern glassmorphism design, fully responsive |

---

## 📁 Project Structure

```
voice-chatbot/
├── app.py                 # Flask backend and REST API endpoints
├── nlp_engine.py          # NLP processing pipeline and answer retrieval
├── academic_data.json     # Academic Q&A dataset (42+ entries)
├── requirements.txt       # Python dependencies
├── README.md              # This file
├── templates/
│   └── index.html         # Chatbot web interface (Jinja2 template)
└── static/
    ├── style.css          # Dark glassmorphism stylesheet
    └── script.js          # Voice, TTS, Fetch API, UI logic
```

---

## ⚙️ Setup & Installation

### Prerequisites
- Python 3.9 or higher
- pip (Python package manager)
- Google Chrome or Microsoft Edge (for voice input)

### Step 1 — Clone or navigate to the project folder

```bash
cd voice-chatbot
```

### Step 2 — Create a virtual environment (recommended)

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### Step 3 — Install dependencies

```bash
pip install -r requirements.txt
```

### Step 4 — Download NLTK resources (automatic on first run)

NLTK data is downloaded automatically when `nlp_engine.py` is first imported.
You can also run this manually:

```python
import nltk
nltk.download('punkt')
nltk.download('stopwords')
nltk.download('wordnet')
```

### Step 5 — Run the Flask application

```bash
python app.py
```

Open your browser and go to: **http://127.0.0.1:5000**

---

## 🌐 API Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/` | Serves the chatbot HTML interface |
| `POST` | `/chat` | Accepts `{"message": "..."}`, returns answer JSON |
| `GET` | `/suggestions` | Returns suggested questions (`?n=6`) |
| `GET` | `/health` | Returns server status |

### Example `/chat` request:
```json
POST /chat
Content-Type: application/json

{ "message": "What is machine learning?" }
```

### Example `/chat` response:
```json
{
  "answer": "Machine Learning (ML) is a subset of AI...",
  "intent": "academic",
  "confidence": 0.8234,
  "matched_question": "What is Machine Learning?",
  "topic": "ai_ml"
}
```

---

## 🧠 NLP Pipeline Explained

```
User Input
   │
   ▼
1. Text Cleaning          lowercase + remove special characters
   │
   ▼
2. Tokenization           word_tokenize (NLTK)
   │
   ▼
3. Stop-word Removal      remove "the", "is", etc. (keep "what", "how", "why")
   │
   ▼
4. Lemmatization          "running" → "run", "trees" → "tree"
   │
   ▼
5. Intent Classification  greeting / farewell / academic / unknown
   │
   ▼
6. TF-IDF Matching        compute cosine similarity against all Q&A entries
   │
   ▼
7. Keyword Bonus          extra score for exact keyword matches
   │
   ▼
8. Best Answer             return matched answer if confidence ≥ threshold
                           else return fallback response
```

---

## 🗣️ Voice Input Instructions

1. Open the app in **Chrome** or **Microsoft Edge**
2. Click the 🎤 microphone button
3. Allow microphone access when prompted
4. Speak your question clearly
5. The recognized text appears in the input field and is sent automatically
6. The answer is displayed and read aloud

---

## 📚 Covered Topics

- **NLP**: Tokenization, stemming, lemmatization, TF-IDF, stop words, Bag of Words, Word2Vec
- **AI/ML**: Supervised/unsupervised learning, neural networks, overfitting, reinforcement learning
- **Python**: List comprehensions, decorators, OOP, exception handling
- **Java**: JVM, interfaces vs abstract classes, multithreading
- **DSA**: Arrays, linked lists, stacks, queues, trees, graphs, sorting, Big O
- **DBMS**: SQL, normalization, JOINs, ACID properties, indexing
- **Exam & Study**: Preparation tips, time management, focus techniques, Pomodoro

---

## 🛠️ Troubleshooting

| Problem | Solution |
|---|---|
| `ModuleNotFoundError: flask` | Run `pip install -r requirements.txt` |
| NLTK resource error | Run `python -c "import nltk; nltk.download('all')"` |
| Microphone not working | Use Chrome/Edge; check browser microphone permissions |
| Port 5000 in use | Change port in `app.py`: `app.run(port=5001)` |
| No answers found | Rephrase the question or use a topic tag chip |

---

## 👨‍💻 Technologies Used

| Component | Technology |
|---|---|
| Backend | Python 3, Flask 3, Flask-CORS |
| NLP | NLTK (tokenize, stopwords, WordNetLemmatizer) |
| Similarity | Custom TF-IDF + Cosine Similarity |
| Voice Input | Web Speech API (SpeechRecognition) |
| Voice Output | SpeechSynthesis API |
| Frontend | HTML5, Vanilla CSS, Vanilla JavaScript |
| Data | JSON flat-file dataset |

---

## 📝 License

This project is created for educational purposes as a college mini-project. Feel free to modify and extend it.
