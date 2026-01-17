# Multi-User DGX Chatbot

A premium, web-based chatbot interface interacting with a local Ollama instance. Designed for DGX servers (or any Linux/Windows machine), it supports multiple concurrent users with isolated sessions.

## Features
- **Premium UI**: Dark mode, glassmorphism, responsive design with "Stripe-inspired" aesthetics.
- **Multi-User**: Independent sessions without login requirements. Each user gets a unique session ID.
- **Streaming**: Real-time token streaming from Ollama.
- **Code Support**: Markdown rendering and syntax highlighting for code blocks.
- **Network Ready**: Automatically binds to `0.0.0.0` for easy LAN access.

---

## 🚀 Easy Setup Guide

### 1. Install Ollama (The AI Runner)
You need Ollama to run the AI models.

**For Linux (DGX/Server):**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**For Windows:**
Download and install from [Ollama.com](https://ollama.com/download).

### 2. Pull the AI Model
We recommend the `kimi-k2` model (or `lemma`, `mistral`, etc.) for coding tasks. 

Run this command in your terminal/command prompt:
```bash
ollama pull kimi-k2
```
*(If you want to use a different model, just pull it and update the model name in `app/templates/index.html` or `app/main.py`)*

### 3. Start Ollama Server
Ensure the Ollama backend is running:
```bash
ollama serve
```

---

## 🛠️ Application Installation

### 1. Clone this Repository
```bash
git clone https://github.com/Hemraj183/LLMChatbot.git
cd LLMChatbot
```

### 2. Install Python Dependencies
Make sure you have Python 3.8+ installed.
```bash
pip install -r requirements.txt
```

---

## 🏁 Running the Chatbot

Start the application with a single command:

```bash
python run.py
```

You will see output similar to this:
```
==================================================================
  Starting Chatbot Server...
  Access Locally: http://localhost:8000
  Access on Network: http://192.168.1.50:8000
==================================================================
```

### How to Access
- **On the Server**: Open `http://localhost:8000`
- **From another Computer**: Use the "Network" URL shown in the terminal (e.g., `http://192.168.1.50:8000`).

---

## ⚙️ Configuration

- **Port**: Default is `8000`. You can change this in `run.py`.
- **Model**: Default is configured to request `kimi-k2`.
    - TO change the default model, edit `app/static/app.js` (look for `model: "kimi-k2"`).
