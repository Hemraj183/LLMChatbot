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

        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream("POST", url, json=payload) as response:
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
                                    break
                            except json.JSONDecodeError:
                                logger.error(f"Failed to decode JSON: {line}")
                                continue
        except httpx.ConnectError:
            logger.error(f"Could not connect to Ollama at {self.base_url}")
            yield "Error: Could not connect to Ollama. Is it running?"
        except Exception as e:
            logger.error(f"An error occurred: {e}")
            yield f"Error: {str(e)}"

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
