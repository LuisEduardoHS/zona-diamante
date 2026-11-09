from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, SecretStr

class Settings(BaseSettings):
    environment: str = "development"
    log_level: str = "INFO"

    supabase_url: str = ""
    supabase_publishable_key: str = ""
    supabase_secret_key: str = ""
    database_url: str = ""

    trivia_timezone: str = "America/Monterrey"

    trivia_email_enabled: bool = False
    brevo_api_key: SecretStr = SecretStr('')
    email_dispatch_secret: SecretStr = SecretStr('')
    email_from_address: str = ''
    email_from_name: str = 'Zona Diamante'
    email_site_url: str = 'https://zona-diamante.pages.dev'
    email_api_url: str = 'https://zona-diamante.onrender.com'
    trivia_email_batch_size: int = Field(default=10, ge=1, le=20)

    frontend_origins: str = (
        "http://localhost:5500,"
        "http://127.0.0.1:5500,"
        "https://zona-diamante.netlify.app"
        )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def cors_origins(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.frontend_origins.split(",")
            if origin.strip()
        ]

settings = Settings()
