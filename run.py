# run.py
import uvicorn
import socket
import os

def get_ip_address():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

if __name__ == "__main__":
    local_ip = get_ip_address()
    port = 8000
    print(f"\n==================================================================")
    print(f"  Starting Chatbot Server...")
    print(f"  Access Locally: http://localhost:{port}")
    print(f"  Access on Network: http://{local_ip}:{port}")
    print(f"  Ensure Ollama is running: 'ollama serve'")
    print(f"  Ensure Model is pulled: 'ollama pull kimi-k2' (or your chosen model)")
    print(f"==================================================================\n")
    
    # IMPORTANT: reload=True for dev, but bind to 0.0.0.0 for network access
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
