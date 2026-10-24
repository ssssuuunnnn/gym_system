"""
資料庫連線與多租戶隔離（見 docs/adr/0001-multi-tenancy.md）。

- 應用程式以受 RLS 限制的帳號連線（DATABASE_URL）。
- 每個 Session 的 `info["tenant_id"]` 記錄目前租戶；每個交易開始時（after_begin）以
  `set_config('app.tenant_id', …, true)` 設到資料庫連線上，RLS policy 依此過濾。
  沒有租戶時設為空字串：業務表全部看不到、也寫不進去（預設拒絕）。
- 新增的業務資料（TenantMixin）在 flush 前自動填入目前租戶。
"""

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


TENANT_INFO_KEY = "tenant_id"


@event.listens_for(Session, "after_begin")
def _set_tenant_on_transaction(session: Session, transaction, connection) -> None:
    tenant_id = session.info.get(TENANT_INFO_KEY)
    connection.execute(
        text("SELECT set_config('app.tenant_id', :tid, true)"),
        {"tid": "" if tenant_id is None else str(tenant_id)},
    )


@event.listens_for(Session, "before_flush")
def _fill_tenant_id(session: Session, flush_context, instances) -> None:
    from app.models.tenant import TenantMixin  # 避免循環匯入

    tenant_id = session.info.get(TENANT_INFO_KEY)
    for obj in session.new:
        if isinstance(obj, TenantMixin) and getattr(obj, "tenant_id", None) is None:
            if tenant_id is None:
                raise RuntimeError(f"新增 {type(obj).__name__} 時沒有目前租戶")
            obj.tenant_id = tenant_id


def tenant_session(tenant_id: int | None) -> Session:
    """建立綁定指定租戶的 Session（CLI、背景工作用；API 請用 deps.get_db）。"""
    db = SessionLocal()
    db.info[TENANT_INFO_KEY] = tenant_id
    return db
