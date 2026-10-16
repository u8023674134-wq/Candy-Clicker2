from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    bot_token: str
    webapp_url: str = "https://localhost:8000"
    db_path: str = "clicker.db"
    base_click_power: int = 1
    base_passive: float = 0.0


settings = Settings()
