import httpx
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class OllamaClient:
    def __init__(self, base_url="http://localhost:11434"):
        self.base_url = base_url

    async def chat_stream(self, model: str, messages: list):
        """
        Streams chat responses from Ollama.
        """
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": model,
            "messages": messages,
            "stream": True
        }

        print(f"  [OllamaClient] Connecting to {url} with model {model}...")
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream("POST", url, json=payload) as response:
                    print(f"  [OllamaClient] Response Status: {response.status_code}")
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if line:
                            try:
                                data = json.loads(line)
                                if "message" in data:
                                    content = data["message"].get("content", "")
                                    if content:
                                        yield content
                                if data.get("done", False):
                                    print(f"  [OllamaClient] Stream done.")
                                    break
                            except json.JSONDecodeError:
                                logger.error(f"Failed to decode JSON: {line}")
                                continue
        except httpx.ConnectError:
            print(f"  [OllamaClient] CONNECTION ERROR to {self.base_url}")
            logger.error(f"Could not connect to Ollama at {self.base_url}")
            yield "Error: Could not connect to Ollama. Is it running?"
        except Exception as e:
            print(f"  [OllamaClient] EXCEPTION: {e}")
            logger.error(f"An error occurred: {e}")
            yield f"Error: {str(e)}"

    async def get_models(self):
        """
        Fetches the list of available models from Ollama.
        """
        try:
            print(f"  [OllamaClient] Fetching models from {self.base_url}/api/tags...")
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/tags")
                if response.status_code == 200:
                    data = response.json()
                    # Extract model names
                    models = [model["name"] for model in data.get("models", [])]
                    models.sort() # Sort alphabetically
                    print(f"  [OllamaClient] Found {len(models)} models: {models}")
                    return models
                else:
                    logger.error(f"Failed to fetch models: {response.status_code} {response.text}")
                    return []
        except Exception as e:
            logger.error(f"Error fetching models: {e}")
            print(f"  [OllamaClient] Error fetching models: {e}")
            return []

    async def check_connection(self):
        """
        Checks if Ollama is reachable.
        """
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                response = await client.get(f"{self.base_url}/")
                return response.status_code == 200
        except:
            return False
