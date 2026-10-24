"""形象網站的讀寫（routers/website.py 與 routers/site.py 共用）。"""

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.coach import Coach
from app.models.product import Product
from app.models.system_settings import SystemSettings
from app.models.website import Website
from app.schemas.website import SiteContent, default_site_content

DEFAULT_COMPANY_NAME = "健身工作室"


def company_name(db: Session) -> str:
    row = db.query(SystemSettings).first()
    return (row.short_name or row.company_name) if row else DEFAULT_COMPANY_NAME


def get_or_create_website(db: Session) -> Website:
    """每家一筆，第一次讀取時以預設內容建立（比照 system_settings 的做法）。"""
    site = db.query(Website).first()
    if site is None:
        site = Website(draft=default_site_content(company_name(db)).model_dump(mode="json"))
        db.add(site)
        db.flush()
    return site


def check_references(db: Session, content: SiteContent, subdomain: str) -> list[str]:
    """內容引用的教練、方案與圖片是否屬於這家（RLS 下查不到別家的資料）。回傳問題清單。"""
    problems = []
    coach_ids = {c.coach_id for c in content.coaches.items}
    if coach_ids:
        found = {cid for (cid,) in db.query(Coach.id).filter(Coach.id.in_(coach_ids))}
        if coach_ids - found:
            problems.append("教練團隊裡有已不存在的教練，請重新整理後再存")
    product_ids = {p.product_id for p in content.pricing.items}
    if product_ids:
        found = {pid for (pid,) in db.query(Product.id).filter(Product.id.in_(product_ids))}
        if product_ids - found:
            problems.append("方案價格裡有已不存在的商品，請重新整理後再存")
    prefix = f"/media/{subdomain}/site/"
    if any(not url.startswith(prefix) for url in content.image_urls()):
        problems.append("圖片必須是在本站後台上傳的檔案")
    return problems


def touch(site: Website, username: str) -> None:
    site.updated_at = datetime.utcnow()
    site.updated_by_name = username
