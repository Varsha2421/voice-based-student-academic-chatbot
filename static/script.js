/**
 * script.js
 * =========
 * Frontend logic for the Voice-Based Student Academic Assistance Chatbot.
 *
 * Responsibilities:
 *  - Voice input via Web Speech API (SpeechRecognition)
 *  - Text input handling and form submission
 *  - Fetch API calls to the Flask backend (/chat, /suggestions)
 *  - Rendering user and bot messages in the chat window
 *  - Text-to-Speech output via SpeechSynthesis API
 *  - Suggested question chips and topic filter tags
 *  - Clear chat, toast notifications, and chat stats
 */

/* ============================================================
   1. GLOBAL STATE & DOM REFERENCES
   ============================================================ */
const BACKEND_URL = "";   // Empty = same origin (Flask serves the page)

// DOM elements
const chatMessages    = document.getElementById("chat-messages");
const messageInput    = document.getElementById("message-input");
const sendBtn         = document.getElementById("send-btn");
const micBtn          = document.getElementById("mic-btn");
const clearBtn        = document.getElementById("clear-btn");
const micStatus       = document.getElementById("mic-status");
const micStatusText   = document.getElementById("mic-status-text");
const suggestionsList = document.getElementById("suggestions-list");
const toastContainer  = document.getElementById("toast-container");
const statQuestions   = document.getElementById("stat-questions");
const statAnswered    = document.getElementById("stat-answered");

// App state
let isRecording      = false;
let recognition      = null;   // SpeechRecognition instance
let currentUtterance = null;   // Active SpeechSynthesisUtterance
let questionCount    = 0;
let answeredCount    = 0;


/* ============================================================
   2. INITIALIZATION
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  setupSpeechRecognition();
  loadSuggestions();
  setupEventListeners();
  // Let the welcome message appear naturally — no auto-greeting
});


/* ============================================================
   3. EVENT LISTENERS
   ============================================================ */
function setupEventListeners() {
  // Send on Enter key (Shift+Enter = new line)
  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  sendBtn.addEventListener("click", handleSendMessage);
  micBtn.addEventListener("click", toggleVoiceInput);
  clearBtn.addEventListener("click", clearChat);
}


/* ============================================================
   4. SEND MESSAGE FLOW
   ============================================================ */
/**
 * Reads the input field, validates it, appends the user bubble,
 * calls the Flask backend, and displays the bot response.
 */
async function handleSendMessage() {
  const text = messageInput.value.trim();

  if (!text) {
    showToast("Please type or speak a question first.", "info");
    return;
  }

  // Stop any ongoing speech
  stopSpeaking();

  // Clear the input field
  messageInput.value = "";
  setInputEnabled(false);

  // Append user message
  appendMessage("user", text);

  // Show typing indicator
  const typingEl = showTypingIndicator();

  try {
    const result = await fetchAnswer(text);
    removeTypingIndicator(typingEl);
    appendBotMessage(result);
  } catch (err) {
    removeTypingIndicator(typingEl);
    appendMessage("bot", "⚠️ Could not connect to the server. Please make sure the Flask backend is running.", null);
    showToast("Connection error: " + err.message, "error");
  } finally {
    setInputEnabled(true);
    messageInput.focus();
  }
}


/* ============================================================
   5. FETCH API CALL
   ============================================================ */
/**
 * POST the user message to the Flask /chat endpoint.
 * Returns the JSON response from the server.
 */
async function fetchAnswer(message) {
  const response = await fetch(`${BACKEND_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP ${response.status}`);
  }

  return response.json();
}


/* ============================================================
   6. RENDERING MESSAGES
   ============================================================ */
/**
 * Create and append a user or simple bot message bubble to the chat area.
 */
function appendMessage(sender, text, topic = null) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${sender === "user" ? "user-message" : "bot-message"}`;

  const avatar   = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = sender === "user" ? "🎓" : "🤖";

  const content  = document.createElement("div");
  content.className = "message-content";

  const bubble   = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = text;

  const meta = document.createElement("div");
  meta.className = "message-meta";
  meta.textContent = getTime();

  if (sender === "bot" && topic && topic !== "general") {
    const badge = document.createElement("span");
    badge.className = "topic-badge";
    badge.textContent = topicLabel(topic);
    meta.prepend(badge);
  }

  content.appendChild(bubble);
  content.appendChild(meta);
  wrapper.appendChild(avatar);
  wrapper.appendChild(content);

  // Remove welcome message on first real message
  removeWelcomeMessage();
  chatMessages.appendChild(wrapper);
  scrollToBottom();

  // Stats tracking
  if (sender === "user") { questionCount++; updateStats(); }

  return wrapper;
}

/**
 * Append a bot message with optional speak button and topic badge.
 */
function appendBotMessage(result) {
  const { answer, topic, intent, confidence } = result;

  const wrapper = document.createElement("div");
  wrapper.className = "message bot-message";

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = "🤖";

  const content = document.createElement("div");
  content.className = "message-content";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = answer;

  const meta = document.createElement("div");
  meta.className = "message-meta";

  // Topic badge
  if (topic && topic !== "general" && intent === "academic") {
    const badge = document.createElement("span");
    badge.className = "topic-badge";
    badge.textContent = topicLabel(topic);
    meta.appendChild(badge);
  }

  // Timestamp
  const time = document.createElement("span");
  time.textContent = getTime();
  meta.appendChild(time);

  // Speak button
  const speakBtn = document.createElement("button");
  speakBtn.className = "btn-speak";
  speakBtn.title = "Read aloud";
  speakBtn.innerHTML = "🔊";
  speakBtn.setAttribute("aria-label", "Read answer aloud");
  speakBtn.addEventListener("click", () => speakText(answer, speakBtn));
  meta.appendChild(speakBtn);

  content.appendChild(bubble);
  content.appendChild(meta);
  wrapper.appendChild(avatar);
  wrapper.appendChild(content);

  removeWelcomeMessage();
  chatMessages.appendChild(wrapper);
  scrollToBottom();

  // Auto-speak the answer
  speakText(answer, speakBtn);

  // Stats
  if (intent !== "greeting" && intent !== "farewell") {
    answeredCount++;
    updateStats();
  }
}


/* ============================================================
   7. TYPING INDICATOR
   ============================================================ */
function showTypingIndicator() {
  const wrapper = document.createElement("div");
  wrapper.className = "typing-indicator";
  wrapper.id = "typing-indicator";

  const avatar = document.createElement("div");
  avatar.className = "message-avatar bot-message";
  avatar.style.cssText = "background: linear-gradient(135deg,#43e97b,#38f9d7); width:36px; height:36px; border-radius:50%; display:grid; place-items:center; font-size:16px;";
  avatar.textContent = "🤖";

  const bubble = document.createElement("div");
  bubble.className = "typing-bubble";
  [1, 2, 3].forEach(() => {
    const dot = document.createElement("div");
    dot.className = "typing-dot";
    bubble.appendChild(dot);
  });

  wrapper.appendChild(avatar);
  wrapper.appendChild(bubble);
  chatMessages.appendChild(wrapper);
  scrollToBottom();
  return wrapper;
}

function removeTypingIndicator(el) {
  if (el && el.parentNode) el.parentNode.removeChild(el);
}


/* ============================================================
   8. VOICE INPUT (Web Speech API)
   ============================================================ */
/**
 * Check browser support and set up SpeechRecognition instance.
 * The Web Speech API is supported in Chrome, Edge, and Safari.
 */
function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    micBtn.disabled = true;
    micBtn.title = "Voice input not supported in this browser. Use Chrome or Edge.";
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false;          // Stop after a single utterance
  recognition.interimResults = false;       // We only want final results
  recognition.lang = "en-US";
  recognition.maxAlternatives = 1;

  // Called when the user finishes speaking
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    messageInput.value = transcript;
    stopRecording();
    // Automatically send the recognized text
    setTimeout(() => handleSendMessage(), 300);
  };

  recognition.onerror = (event) => {
    stopRecording();
    let msg = "Voice recognition error.";
    if (event.error === "not-allowed") {
      msg = "Microphone access denied. Please allow microphone permission in your browser.";
    } else if (event.error === "no-speech") {
      msg = "No speech detected. Please try again.";
    } else if (event.error === "audio-capture") {
      msg = "No microphone found. Please connect a microphone.";
    }
    showToast(msg, "error");
  };

  recognition.onend = () => {
    if (isRecording) stopRecording();
  };
}

/**
 * Toggle voice recording on/off.
 */
function toggleVoiceInput() {
  if (!recognition) {
    showToast("Voice input is not supported in your browser. Please use Chrome or Edge.", "error");
    return;
  }

  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

function startRecording() {
  stopSpeaking();
  try {
    recognition.start();
    isRecording = true;
    micBtn.classList.add("recording");
    micBtn.title = "Click to stop recording";
    micBtn.innerHTML = "⏹️";
    micStatus.classList.add("visible");
    micStatusText.textContent = "Listening… speak your question";
  } catch (e) {
    showToast("Could not start voice recognition. Please try again.", "error");
  }
}

function stopRecording() {
  isRecording = false;
  micBtn.classList.remove("recording");
  micBtn.title = "Click to speak your question";
  micBtn.innerHTML = "🎤";
  micStatus.classList.remove("visible");
  try { recognition.stop(); } catch (e) { /* ignore */ }
}


/* ============================================================
   9. TEXT-TO-SPEECH (SpeechSynthesis API)
   ============================================================ */
/**
 * Read the given text aloud using the browser's SpeechSynthesis API.
 * @param {string} text - The text to speak
 * @param {HTMLElement} btn - The speak button to animate
 */
function speakText(text, btn = null) {
  if (!window.speechSynthesis) {
    showToast("Text-to-speech is not supported in your browser.", "info");
    return;
  }

  stopSpeaking();

  // Limit length to avoid very long speech
  const spoken = text.length > 500 ? text.substring(0, 500) + "..." : text;
  const utterance = new SpeechSynthesisUtterance(spoken);
  utterance.lang  = "en-US";
  utterance.rate  = 0.95;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  if (btn) {
    utterance.onstart = () => btn.classList.add("speaking");
    utterance.onend   = () => { btn.classList.remove("speaking"); currentUtterance = null; };
    utterance.onerror = () => { btn.classList.remove("speaking"); currentUtterance = null; };
  }

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

function stopSpeaking() {
  if (window.speechSynthesis && window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }
  currentUtterance = null;
}


/* ============================================================
   10. SUGGESTED QUESTIONS (loaded from /suggestions endpoint)
   ============================================================ */
async function loadSuggestions() {
  try {
    const res  = await fetch(`${BACKEND_URL}/suggestions?n=6`);
    const data = await res.json();
    renderSuggestions(data.suggestions || []);
  } catch (e) {
    // Fallback static suggestions if server not ready
    renderSuggestions([
      "What is Natural Language Processing?",
      "Explain supervised learning",
      "What is a binary search tree?",
      "What are ACID properties in DBMS?",
      "How does exception handling work in Python?",
      "What is Big O notation?",
    ]);
  }
}

function renderSuggestions(questions) {
  suggestionsList.innerHTML = "";
  questions.forEach((q) => {
    const chip = document.createElement("button");
    chip.className = "suggestion-chip";
    chip.textContent = q;
    chip.addEventListener("click", () => {
      messageInput.value = q;
      handleSendMessage();
    });
    suggestionsList.appendChild(chip);
  });
}


/* ============================================================
   11. TOPIC FILTER TAGS
   ============================================================ */
/**
 * Clicking a topic tag fills the input with a related query.
 * Called via inline onclick in the HTML for simplicity.
 */
function filterByTopic(topic) {
  const topicQueries = {
    nlp:    "What is Natural Language Processing?",
    ai_ml:  "What is Machine Learning?",
    python: "What is Python programming?",
    java:   "What is Java?",
    dsa:    "What are data structures?",
    dbms:   "What is DBMS?",
    exam:   "How should I prepare for exams?",
    study:  "What are effective study tips?",
  };
  const query = topicQueries[topic] || `Tell me about ${topic}`;
  messageInput.value = query;
  messageInput.focus();
}


/* ============================================================
   12. CLEAR CHAT
   ============================================================ */
function clearChat() {
  chatMessages.innerHTML = `
    <div class="welcome-message" id="welcome-message">
      <span class="welcome-icon">🎓</span>
      <h2>Welcome to Academic Assistant!</h2>
      <p>Ask me anything about NLP, AI/ML, Python, Java,<br>
         Data Structures, DBMS, or study tips.<br>
         Type below or use the 🎤 microphone button!</p>
    </div>`;
  stopSpeaking();
  questionCount = 0;
  answeredCount = 0;
  updateStats();
  showToast("Chat cleared!", "success");
  loadSuggestions();
}


/* ============================================================
   13. UTILITY FUNCTIONS
   ============================================================ */
function removeWelcomeMessage() {
  const welcome = document.getElementById("welcome-message");
  if (welcome) welcome.remove();
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function setInputEnabled(enabled) {
  messageInput.disabled = !enabled;
  sendBtn.disabled = !enabled;
  micBtn.disabled = !enabled;
}

function getTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function updateStats() {
  if (statQuestions) statQuestions.textContent = questionCount;
  if (statAnswered)  statAnswered.textContent  = answeredCount;
}

/**
 * Map internal topic keys to display labels.
 */
function topicLabel(topic) {
  const map = {
    nlp:         "🧠 NLP",
    ai_ml:       "🤖 AI/ML",
    python:      "🐍 Python",
    java:        "☕ Java",
    dsa:         "🌲 DSA",
    dbms:        "🗃️ DBMS",
    exam:        "📝 Exam",
    study_tips:  "💡 Study Tips",
    general:     "💬 General",
  };
  return map[topic] || topic;
}


/* ============================================================
   14. TOAST NOTIFICATIONS
   ============================================================ */
/**
 * Display a temporary notification toast.
 * @param {string} message
 * @param {"info"|"error"|"success"} type
 * @param {number} duration - ms before auto-dismiss
 */
function showToast(message, type = "info", duration = 3500) {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const icons = { info: "ℹ️", error: "❌", success: "✅" };
  toast.textContent = `${icons[type] || ""} ${message}`;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("hide");
    toast.addEventListener("animationend", () => toast.remove());
  }, duration);
}
