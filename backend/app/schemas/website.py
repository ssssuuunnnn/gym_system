"""
形象網站的內容格式（見 docs/adr/0003-gym-website.md）。

整份內容存成 websites.draft / websites.published 的 JSON；這裡是唯一的格式定義與驗證。
- 只存網站用的文字、圖片網址，以及教練／方案的 id；名稱、照片、價格、課堂在顯示時從系統讀取。
- 連結（LINE、Instagram、Facebook）與圖片網址在這裡驗證，樣板不必再擔心格式。
"""

import re
from datetime import datetime
from typing import Literal
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# ---------- 共用常數 ----------

SECTION_KEYS = ("hero", "about", "schedule", "coaches", "pricing", "gallery", "faq", "trial", "contact")
SectionKey = Literal["hero", "about", "schedule", "coaches", "pricing", "gallery", "faq", "trial", "contact"]
# 一定會顯示、不能關閉的段落
REQUIRED_SECTIONS = {"hero", "about", "contact"}

# 品牌色只能從預設色挑：每個顏色都確認過白字在上面、以及當文字放在白底／淺灰底都 ≥ 4.5:1；
# light 是放在深色區塊（主視覺、方案價格）上的亮色版，對 #15181d ≥ 6:1。
BRAND_COLORS: dict[str, dict[str, str]] = {
    "#C3400D": {"name": "橘紅", "light": "#FF8A5B"},
    "#0B7A75": {"name": "青綠", "light": "#5FD3CC"},
    "#2F54EB": {"name": "藍", "light": "#8FA8FF"},
    "#722ED1": {"name": "紫", "light": "#C29BFF"},
    "#1F1F1F": {"name": "黑", "light": "#E6E7EA"},
}
BrandColor = Literal["#C3400D", "#0B7A75", "#2F54EB", "#722ED1", "#1F1F1F"]
DEFAULT_BRAND_COLOR = "#C3400D"

# 網站圖片只能是本站上傳的檔案：/media/<子網域>/site/<uuid>.<jpg|png>（子網域由路由再比對）
SITE_IMAGE_RE = re.compile(r"^/media/[a-z0-9-]{1,63}/site/[0-9a-f]{32}\.(jpg|png)$")
LINE_ID_RE = re.compile(r"^@?[A-Za-z0-9._-]{1,40}$")
INSTAGRAM_RE = re.compile(r"^[A-Za-z0-9._]{1,30}$")


def _strip(value):
    return value.strip() if isinstance(value, str) else value


def _image_url(value: str | None) -> str | None:
    value = _strip(value) or None
    if value is not None and not SITE_IMAGE_RE.match(value):
        raise ValueError("圖片必須是在後台上傳的檔案")
    return value


class _Model(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="ignore")


# ---------- 段落 ----------


class SectionToggle(_Model):
    key: SectionKey
    visible: bool = True


class SeoSettings(_Model):
    title: str = Field(default="", max_length=70)
    description: str = Field(default="", max_length=160)
    og_image_url: str | None = None

    _img = field_validator("og_image_url", mode="before")(_image_url)


class HeroSection(_Model):
    eyebrow: str = Field(default="", max_length=40)
    tagline: str = Field(default="", max_length=40)
    description: str = Field(default="", max_length=200)
    image_url: str | None = None

    _img = field_validator("image_url", mode="before")(_image_url)


class Feature(_Model):
    title: str = Field(max_length=20)
    text: str = Field(default="", max_length=60)


class AboutSection(_Model):
    title: str = Field(default="關於我們", max_length=30)
    text: str = Field(default="", max_length=1000)
    features: list[Feature] = Field(default_factory=list, max_length=3)


class ScheduleSection(_Model):
    title: str = Field(default="本週團體課表", max_length=30)
    show_seats: bool = True


class CoachEntry(_Model):
    coach_id: int
    bio: str = Field(default="", max_length=80)


class CoachesSection(_Model):
    title: str = Field(default="教練團隊", max_length=30)
    items: list[CoachEntry] = Field(default_factory=list, max_length=30)

    @field_validator("items")
    @classmethod
    def _unique(cls, items: list[CoachEntry]) -> list[CoachEntry]:
        ids = [i.coach_id for i in items]
        if len(ids) != len(set(ids)):
            raise ValueError("教練重複")
        return items


class PlanEntry(_Model):
    product_id: int
    description: str = Field(default="", max_length=80)


class PricingSection(_Model):
    title: str = Field(default="方案價格", max_length=30)
    items: list[PlanEntry] = Field(default_factory=list, max_length=12)
    note: str = Field(default="價格以現場公告為準。", max_length=200)

    @field_validator("items")
    @classmethod
    def _unique(cls, items: list[PlanEntry]) -> list[PlanEntry]:
        ids = [i.product_id for i in items]
        if len(ids) != len(set(ids)):
            raise ValueError("方案重複")
        return items


class GalleryImage(_Model):
    url: str
    caption: str = Field(default="", max_length=40)

    _img = field_validator("url", mode="before")(_image_url)


class GallerySection(_Model):
    title: str = Field(default="環境照片", max_length=30)
    images: list[GalleryImage] = Field(default_factory=list, max_length=12)


class FaqItem(_Model):
    q: str = Field(min_length=1, max_length=60)
    a: str = Field(min_length=1, max_length=500)


class FaqSection(_Model):
    title: str = Field(default="常見問題", max_length=30)
    items: list[FaqItem] = Field(default_factory=list, max_length=20)


def default_privacy_notice(company_name: str) -> str:
    return (
        f"{company_name}（以下稱本公司）依個人資料保護法告知：\n"
        "一、蒐集目的：安排體驗課程與聯繫服務。\n"
        "二、蒐集的個人資料類別：姓名、手機號碼、LINE ID 及您填寫的留言。\n"
        "三、利用期間：至蒐集目的完成為止；未成為會員者，最長保存 6 個月後刪除。\n"
        "四、利用地區與對象：僅限本公司於臺灣境內聯繫您時使用，不提供給第三方。\n"
        "五、您可以向本公司請求查詢、閱覽、複製、補充、更正、停止蒐集利用或刪除您的個人資料。\n"
        "六、您可自由選擇是否提供；若不提供，本公司將無法與您聯繫安排體驗課程。"
    )


class TrialSection(_Model):
    title: str = Field(default="預約體驗課", max_length=30)
    intro: str = Field(default="留下聯絡方式，我們會盡快與你聯繫，安排體驗時間。", max_length=200)
    interests: list[str] = Field(
        default_factory=lambda: ["私人教練課", "團體課（任選）", "還不確定，想先諮詢"], min_length=1, max_length=8
    )
    slots: list[str] = Field(default_factory=lambda: ["平日白天", "平日晚上", "週末"], min_length=1, max_length=8)
    privacy_notice: str = Field(default="", max_length=2000)

    @field_validator("interests", "slots")
    @classmethod
    def _options(cls, values: list[str]) -> list[str]:
        cleaned = [v.strip() for v in values if v and v.strip()]
        if not cleaned:
            raise ValueError("至少要有一個選項")
        if any(len(v) > 30 for v in cleaned):
            raise ValueError("每個選項最多 30 字")
        return list(dict.fromkeys(cleaned))


class ContactSection(_Model):
    title: str = Field(default="交通與聯絡", max_length=30)
    address: str = Field(default="", max_length=100)
    transport: str = Field(default="", max_length=200)
    phone: str = Field(default="", max_length=30)
    hours: str = Field(default="", max_length=200)
    line: str = Field(default="", max_length=200, description="LINE 官方帳號：@ID 或加好友網址")
    instagram: str = Field(default="", max_length=200, description="Instagram 帳號名稱或網址")
    facebook: str = Field(default="", max_length=300, description="Facebook 粉絲專頁網址")

    @field_validator("line")
    @classmethod
    def _line(cls, value: str) -> str:
        if not value:
            return ""
        if value.startswith("http"):
            host = urlparse(value).hostname or ""
            if urlparse(value).scheme != "https" or host not in {"lin.ee", "line.me", "page.line.me"}:
                raise ValueError("LINE 連結請貼 lin.ee 或 line.me 開頭的網址，或填 @ID")
            return value
        if not LINE_ID_RE.match(value):
            raise ValueError("LINE ID 格式不正確")
        return value if value.startswith("@") else f"@{value}"

    @field_validator("instagram")
    @classmethod
    def _instagram(cls, value: str) -> str:
        if not value:
            return ""
        if value.startswith("http"):
            parsed = urlparse(value)
            if parsed.hostname not in {"instagram.com", "www.instagram.com"}:
                raise ValueError("請填 Instagram 帳號名稱或 instagram.com 網址")
            value = parsed.path.strip("/").split("/")[0]
        value = value.lstrip("@")
        if not INSTAGRAM_RE.match(value):
            raise ValueError("Instagram 帳號格式不正確")
        return value

    @field_validator("facebook")
    @classmethod
    def _facebook(cls, value: str) -> str:
        if not value:
            return ""
        parsed = urlparse(value)
        if parsed.scheme != "https" or parsed.hostname not in {
            "facebook.com", "www.facebook.com", "m.facebook.com", "fb.com", "www.fb.com",
        }:
            raise ValueError("請貼 https://www.facebook.com/ 開頭的粉絲專頁網址")
        return value


# ---------- 整份內容 ----------


class SiteContent(_Model):
    theme: Literal["bold"] = "bold"
    brand_color: BrandColor = DEFAULT_BRAND_COLOR
    seo: SeoSettings = Field(default_factory=SeoSettings)
    sections: list[SectionToggle] = Field(default_factory=lambda: [SectionToggle(key=k) for k in SECTION_KEYS])
    hero: HeroSection = Field(default_factory=HeroSection)
    about: AboutSection = Field(default_factory=AboutSection)
    schedule: ScheduleSection = Field(default_factory=ScheduleSection)
    coaches: CoachesSection = Field(default_factory=CoachesSection)
    pricing: PricingSection = Field(default_factory=PricingSection)
    gallery: GallerySection = Field(default_factory=GallerySection)
    faq: FaqSection = Field(default_factory=FaqSection)
    trial: TrialSection = Field(default_factory=TrialSection)
    contact: ContactSection = Field(default_factory=ContactSection)

    @model_validator(mode="after")
    def _normalize_sections(self):
        """每個段落剛好出現一次（缺的補在最後、重複的去掉），必備段落強制顯示。"""
        seen: dict[str, SectionToggle] = {}
        for s in self.sections:
            seen.setdefault(s.key, s)
        ordered = list(seen.values()) + [SectionToggle(key=k) for k in SECTION_KEYS if k not in seen]
        for s in ordered:
            if s.key in REQUIRED_SECTIONS:
                s.visible = True
        self.sections = ordered
        return self

    def image_urls(self) -> list[str]:
        urls = [self.seo.og_image_url, self.hero.image_url] + [img.url for img in self.gallery.images]
        return [u for u in urls if u]


def default_site_content(company_name: str) -> SiteContent:
    content = SiteContent()
    content.seo.title = company_name[:70]
    content.trial.privacy_notice = default_privacy_notice(company_name)
    return content


# ---------- API ----------


class WebsiteOut(BaseModel):
    draft: SiteContent
    is_published: bool
    has_unpublished_changes: bool
    published_at: datetime | None
    published_by_name: str | None
    updated_at: datetime
    updated_by_name: str | None


class WebsiteImageOut(BaseModel):
    url: str


class PreviewTokenOut(BaseModel):
    token: str
    expires_in: int
