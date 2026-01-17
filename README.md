# AuditPartnership Bot

A premium, web-based chatbot interface interacting with a local Ollama instance on your DGX server.
Designed for **AuditPartnership**, it supports multiple concurrent users with isolated sessions.

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

### 2. Pull the AI Models
This app is configured to use **Llama 3.1** and **Qwen 2.5 Coder**. You must pull them before running the app.

Run these commands in your terminal:
```bash
ollama pull llama3.1:70b
ollama pull qwen2.5-coder:32b
```

*(Note: You can swap these for smaller versions like `llama3.1:8b` or `qwen2.5-coder:7b` if your GPU memory is limited, but remember to update `app/templates/index.html` values).*

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
- **Model**: Default is configured to request `llama3.1:70b`.
    - TO change the default model, edit `app/static/app.js` (look for `model: "..."`).

## 🔄 Updating the Application
If you have already cloned the repository and want to pull the latest changes:

1.  **Navigate to the folder**:
    ```bash
    cd LLMChatbot
    ```

2.  **Pull the latest code**:
    ```bash
    git pull origin main
    ```

3.  **Restart the server**:
    Press `Ctrl+C` to stop the running server, then run:
    ```bash
    python run.py
    ```
