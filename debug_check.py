import httpx
import asyncio
import sys

OLLAMA_URL = "http://localhost:11434"

async def check_ollama():
    print(f"1. Checking Connection to {OLLAMA_URL}...")
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(OLLAMA_URL)
            if resp.status_code == 200:
                print("   [PASS] Ollama is running.")
            else:
                print(f"   [FAIL] Ollama responded with status {resp.status_code}")
                return False
    except Exception as e:
        print(f"   [FAIL] Could not connect: {e}")
        print("   Make sure 'ollama serve' is running!")
        return False
    return True

async def list_models():
    print("\n2. Listing Available Models...")
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{OLLAMA_URL}/api/tags")
            if resp.status_code == 200:
                models = resp.json().get('models', [])
                if not models:
                    print("   [WARN] No models found! You need to run 'ollama pull <model>'")
                    return []
                
                model_names = [m['name'] for m in models]
                for m in model_names:
                    print(f"   - {m}")
                return model_names
            else:
                print(f"   [FAIL] Failed to list models: {resp.text}")
                return []
    except Exception as e:
        print(f"   [FAIL] Error listing models: {e}")
        return []

async def test_chat(model_name):
    print(f"\n3. Testing Generation with '{model_name}'...")
    payload = {
        "model": model_name,
        "messages": [{"role": "user", "content": "Say hello briefly."}],
        "stream": False
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(f"{OLLAMA_URL}/api/chat", json=payload)
            if resp.status_code == 200:
                print(f"   [PASS] Success! Response: {resp.json()['message']['content']}")
                return True
            else:
                print(f"   [FAIL] Error {resp.status_code}: {resp.text}")
                return False
    except Exception as e:
        print(f"   [FAIL] Exception during chat: {e}")
        return False

async def main():
    if not await check_ollama():
        return

    models = await list_models()
    if not models:
        return

    # Try to test one of the known preferred models, or just the first one
    preferred = ["llama3.1:70b", "llama3.1:8b", "qwen2.5-coder:32b", "llama3.1:latest"]
    
    target_model = None
    for p in preferred:
        if any(p in m for m in models): # weak matching
            target_model = p
            break
            
    if not target_model:
        target_model = models[0]
        print(f"\n   (Selecting '{target_model}' for test)")
    
    await test_chat(target_model)

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
