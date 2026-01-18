import httpx
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class OllamaClient:
    def __init__(self, base_url="http://localhost:11434", api_key=None):
        self.base_url = base_url
        self.api_key = api_key
        self.headers = {}
        if self.api_key:
            self.headers["Authorization"] = f"Bearer {self.api_key}"
            print(f"  [OllamaClient] API Key detected, using Authorization header.")

    async def chat_stream(self, model: str, messages: list, options: dict = None, images: list = None):
        """
        Streams chat responses from Ollama.
        """
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": model,
            "messages": messages,
            "stream": True
        }
        
        if options:
            payload["options"] = options
        if images:
            # Add images to the LAST message in the conversation for vision models
            if messages:
                messages[-1]["images"] = images

        print(f"  [OllamaClient] Connecting to {url} with model {model}...")
        try:
            async with httpx.AsyncClient(timeout=None, headers=self.headers) as client:
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
                                    eval_count = data.get("eval_count", 0)
                                    eval_duration = data.get("eval_duration", 1)  # avoid div by zero
                                    if eval_count > 0:
                                        tps = eval_count / (eval_duration / 1e9)
                                        metadata = {
                                            "tps": round(tps, 2),
                                            "tokens": eval_count,
                                            "duration_s": round(eval_duration / 1e9, 2)
                                        }
                                        yield f"__METADATA__{json.dumps(metadata)}"
                                    
                                    print(f"  [OllamaClient] Stream done.")
                                    break
                            except json.JSONDecodeError:
                                logger.error(f"Failed to decode JSON: {line}")
                                continue
        except httpx.HTTPStatusError as e:
            status_code = e.response.status_code
            print(f"  [OllamaClient] HTTP ERROR {status_code}: {e}")
            
            if status_code == 401:
                logger.error(f"Unauthorized access to Ollama at {self.base_url}")
                yield "Error: Unauthorized access to AI service. Please check your authentication credentials."
            elif status_code == 403:
                logger.error(f"Forbidden access to Ollama at {self.base_url}")
                yield "Error: Access forbidden. You don't have permission to use this AI service."
            else:
                logger.error(f"HTTP error {status_code}: {e}")
                yield f"Error: Service returned HTTP {status_code}. Please contact support."
        except httpx.ConnectError:
            print(f"  [OllamaClient] CONNECTION ERROR to {self.base_url}")
            logger.error(f"Could not connect to Ollama at {self.base_url}")
            yield "Error: Could not connect to AI service. Please check if the service is running."
        except httpx.TimeoutException:
            print(f"  [OllamaClient] TIMEOUT connecting to {self.base_url}")
            logger.error(f"Timeout connecting to Ollama at {self.base_url}")
            yield "Error: Connection timeout. The AI service is taking too long to respond."
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
            async with httpx.AsyncClient(timeout=5.0, headers=self.headers) as client:
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
                    if response.status_code == 401:
                        print(f"  [OllamaClient] Unauthorized access when fetching models")
                    elif response.status_code == 403:
                        print(f"  [OllamaClient] Forbidden access when fetching models")
                    return []
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error fetching models: {e.response.status_code}")
            print(f"  [OllamaClient] HTTP Error {e.response.status_code} fetching models")
            return []
        except httpx.ConnectError as e:
            logger.error(f"Connection error fetching models: {e}")
            print(f"  [OllamaClient] Connection error fetching models")
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
            async with httpx.AsyncClient(timeout=2.0, headers=self.headers) as client:
                response = await client.get(f"{self.base_url}/")
                return response.status_code == 200
        except:
            return False
