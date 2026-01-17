import os
import uuid
from typing import Dict, List, Optional
from fastapi import FastAPI, Request, HTTPException, Body
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from app.ollama_client import OllamaClient

app = FastAPI()

# Mount static files
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Templates
templates = Jinja2Templates(directory="app/templates")

# Ollama Client
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
ollama_client = OllamaClient(base_url=OLLAMA_HOST)

# In-memory session storage
# structure: {session_id: [{"role": "user", "content": "..."}, ...]}
sessions: Dict[str, List[Dict[str, str]]] = {}

class ChatRequest(BaseModel):
    message: str
    model: str = "llama3.1:8b" 
    role_mode: str = "general" # general, data_engineer
    session_id: Optional[str] = None

SYSTEM_PROMPTS = {
    "general": "You are a helpful AI assistant.",
    "data_engineer": (
        "You are an expert Data Engineer and AI Specialist. "
        "You are highly skilled in Python, Spark, SQL, and Machine Learning pipelines. "
        "When asked about code, provide efficient, scalable, and production-ready solutions. "
        "Assume the user is technically competent but needs specific implementation details."
    )
}

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/health")
async def health_check():
    is_connected = await ollama_client.check_connection()
    return {"status": "ok", "ollama_connected": is_connected}

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    session_id = request.session_id
    
    # Create new session if none provided or invalid
    if not session_id or session_id not in sessions:
        session_id = str(uuid.uuid4())
        sessions[session_id] = []
        # Allow client to update their session_id if they sent a bad one? 
        # For simplicity, we assume client generates UUID or we return it. 
        # Actually, better pattern: Client generates UUID on load, sends it.
        # If server doesn't have it, we just initialize it.
    
    # Append user message
    sessions[session_id].append({"role": "user", "content": request.message})
    
    # Prepare messages history for context
    # 1. Get recent history
    raw_history = sessions[session_id][-20:]
    
    # 2. Prepend System Prompt based on mode
    system_content = SYSTEM_PROMPTS.get(request.role_mode, SYSTEM_PROMPTS["general"])
    # If using Qwen for coding, we might want to enforce data_engineer prompt if not specified, 
    # but let's respect the UI selection.
    
    messages = [{"role": "system", "content": system_content}] + raw_history

    async def response_generator():
        full_response = ""
        # stream from ollama
        async for chunk in ollama_client.chat_stream(request.model, messages):
            full_response += chunk
            yield chunk
        
        # Append assistant response to history after stream finishes
        sessions[session_id].append({"role": "assistant", "content": full_response})

    return StreamingResponse(response_generator(), media_type="text/plain")

@app.post("/api/reset")
async def reset_session(request: Request):
    data = await request.json()
    session_id = data.get("session_id")
    if session_id in sessions:
        sessions[session_id] = []
    return {"status": "reset"}
