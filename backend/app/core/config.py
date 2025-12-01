from typing import Optional

try:
	# pydantic v1 compatibility
	from pydantic import BaseSettings, Field
except Exception:
	# pydantic v2 moved BaseSettings to pydantic-settings
	from pydantic import Field
	from pydantic_settings import BaseSettings


class Settings(BaseSettings):
	SUPABASE_URL: str = Field(..., description="Supabase project URL")
	SUPABASE_KEY: str = Field(..., description="Supabase service role key or anon key")
	OPENAI_API_KEY: Optional[str] = Field(None, description="OpenAI API key (optional for local dev)")
	JWT_SECRET: str = Field(..., description="Secret used to sign JWTs")
	ENV: str = Field("development", description="Environment name: development|production")
	REPORTS_BUCKET: Optional[str] = Field("reports", description="Supabase Storage bucket name for report images")

	class Config:
		env_file = ".env"
		env_file_encoding = "utf-8"


settings = Settings()


__all__ = ["settings", "Settings"]
