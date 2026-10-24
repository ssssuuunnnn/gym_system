from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    全域設定。
    - 資料庫為 PostgreSQL，分兩個帳號（見 docs/adr/0001-multi-tenancy.md）：
      DATABASE_URL＝應用程式（受 RLS 限制）；MIGRATION_DATABASE_URL＝資料表擁有者（migration、平台工具）。
    - SECRET_KEY / ALGORITHM / ACCESS_TOKEN_EXPIRE_MINUTES 對應 JWT 登入機制。
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "健身工作室管理系統 API"
    API_V1_PREFIX: str = "/api/v1"

    DATABASE_URL: str = "postgresql+psycopg://fitness_app:app_pw@localhost:5432/fitness_dev"
    MIGRATION_DATABASE_URL: str = "postgresql+psycopg://fitness_owner:owner_pw@localhost:5432/fitness_dev"
    # migration 授權給哪個應用程式帳號（GRANT 資料讀寫權限）
    APP_DB_ROLE: str = "fitness_app"

    # 多租戶：每家健身房一個子網域 <subdomain>.<BASE_DOMAIN>，由 Host 判斷租戶。
    BASE_DOMAIN: str = "localhost"
    # 沒有子網域時（本機 localhost、IP）使用的租戶；正式環境應留空，未知網址回 404。
    DEFAULT_TENANT: str = ""

    SECRET_KEY: str = "change-me-to-a-random-secret"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    # 租戶未設定時區時的預設值（各租戶時區在 tenants.timezone）。
    STUDIO_TIMEZONE: str = "Asia/Taipei"

    # 教練照片等上傳檔案的存放目錄，透過 /media 靜態路徑對外提供；每個租戶一個子資料夾。
    MEDIA_DIR: str = "media"


settings = Settings()
