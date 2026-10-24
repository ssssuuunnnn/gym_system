from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    全域設定。對應「技術棧與系統架構」章節：
    - DATABASE_URL 正式環境使用 MySQL（mysql+pymysql://...），本機開發預設 SQLite 方便快速啟動。
    - SECRET_KEY / ALGORITHM / ACCESS_TOKEN_EXPIRE_MINUTES 對應 JWT 登入機制。
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "健身工作室管理系統 API"
    API_V1_PREFIX: str = "/api/v1"

    DATABASE_URL: str = "sqlite:///./dev.db"

    SECRET_KEY: str = "change-me-to-a-random-secret"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    # 工作室所在時區：預約的 booking_date + start_hour 是當地時間，取消期限／簽到時間窗以此判斷。
    STUDIO_TIMEZONE: str = "Asia/Taipei"

    # 教練照片等上傳檔案的存放目錄，透過 /media 靜態路徑對外提供。
    MEDIA_DIR: str = "media"


settings = Settings()
