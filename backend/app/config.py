import os
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DEFAULT_DB_PATH = BASE_DIR / "data" / "cynbit_inquiries.db"


class Settings:
    PROJECT_NAME: str = "Cynbit AI Client Inquiry Intelligence API"
    API_PREFIX: str = "/api"
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "").strip()
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{DEFAULT_DB_PATH.as_posix()}",
    )
    KB_PATH: Path = BASE_DIR / "sample_data" / "cynbit_knowledge_base.json"
    SAMPLE_INQUIRIES_PATH: Path = BASE_DIR / "sample_data" / "sample_inquiries.json"
    ALLOWED_ORIGINS: list[str] = [
        o.strip()
        for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
        if o.strip()
    ]

    @property
    def openai_configured(self) -> bool:
        return bool(self.OPENAI_API_KEY and self.OPENAI_API_KEY != "MY_OPENAI_API_KEY")


settings = Settings()
