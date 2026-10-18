import os
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")
os.environ.setdefault("ANONYMIZED_TELEMETRY", "False")


def local_path(name: str, default: str) -> Path:
    path = Path(os.getenv(name, default))
    return path if path.is_absolute() else ROOT / path


@dataclass(frozen=True)
class Settings:
    ollama: str = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
    chat_model: str = os.getenv("OLLAMA_CHAT_MODEL", "gemma3:4b")
    embed_model: str = os.getenv("OLLAMA_EMBED_MODEL", "embeddinggemma")
    chroma_path: Path = local_path("CHROMA_PATH", "data/chroma")
    knowledge_path: Path = local_path("KNOWLEDGE_PATH", "knowledge")
    top_k: int = int(os.getenv("TOP_K", "4"))
    min_similarity: float = float(os.getenv("MIN_SIMILARITY", "0.45"))

    def __post_init__(self):
        url = urlparse(self.ollama)
        if url.scheme != "http" or url.hostname not in {"localhost", "127.0.0.1", "::1"}:
            raise ValueError(
                "OLLAMA_BASE_URL must be an HTTP loopback address; cloud endpoints are disabled."
            )
        if any("cloud" in model.lower() for model in (self.chat_model, self.embed_model)):
            raise ValueError("Cloud models are disabled. Select a downloaded local model.")


settings = Settings()
