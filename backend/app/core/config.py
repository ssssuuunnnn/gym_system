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
    # 平台管理後台（見 docs/adr/0002-platform-console.md）：只能管理健身房清單、平台帳號與各家管理員帳號，
    # 讀取各家帳號時同樣受 RLS 限制；跨租戶統計只透過 platform_tenant_stats() 取得彙總數字。
    PLATFORM_DATABASE_URL: str = "postgresql+psycopg://fitness_platform:platform_pw@localhost:5432/fitness_dev"
    PLATFORM_DB_ROLE: str = "fitness_platform"
    # 平台管理後台的子網域：<PLATFORM_SUBDOMAIN>.<BASE_DOMAIN>（已列為保留字，不會分配給健身房）
    PLATFORM_SUBDOMAIN: str = "platform"
    # 平台管理員登入有效時間較短
    PLATFORM_TOKEN_EXPIRE_MINUTES: int = 120

    # 網站對外的通訊協定，用來組 LINE 通知裡的後台連結（https://<子網域>.<BASE_DOMAIN>/…）
    PUBLIC_SCHEME: str = "https"

    # LINE 通知店家（見 docs/adr/0004-line-notifications.md）：平台共用一個 LINE 官方帳號（Messaging API）。
    # 沒有設定 LINE_CHANNEL_ACCESS_TOKEN 時不會真的發送（通知記為「未設定 LINE」），方便本機開發。
    LINE_CHANNEL_SECRET: str = ""
    LINE_CHANNEL_ACCESS_TOKEN: str = ""
    # 官方帳號的 Basic ID（例如 @123abcde），用來產生加好友網址與 QR 碼
    LINE_BOT_BASIC_ID: str = ""
    LINE_BOT_NAME: str = "店家小幫手"
    LINE_API_BASE: str = "https://api.line.me"
    # 平台的 LINE 方案每月額度（只用於平台後台顯示）
    LINE_PLAN_MONTHLY_QUOTA: int = 3000
    # 背景重試發送：每隔幾秒檢查一次待發送的通知；0＝不啟動（測試用）
    LINE_DISPATCH_INTERVAL_SECONDS: int = 60
    # 健身房自己的 LINE 官方帳號（見 docs/adr/0005-gym-line-oa.md）：金鑰加密後存在資料庫。
    # 加密金鑰（Fernet，32 bytes urlsafe base64）；留空時由 SECRET_KEY 衍生——換 SECRET_KEY 會讓已存的金鑰無法解密。
    DATA_ENCRYPTION_KEY: str = ""

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
