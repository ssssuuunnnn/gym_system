import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.routers import (
    auth,
    coach_payouts,
    coaches,
    courses,
    inquiries,
    platform,
    products,
    purchases,
    reservations,
    site,
    system_settings,
    time_slots,
    users,
    website,
)

app = FastAPI(title=settings.PROJECT_NAME)

# 上傳檔案（教練照片等）以靜態路徑 /media 對外提供
os.makedirs(settings.MEDIA_DIR, exist_ok=True)
app.mount("/media", StaticFiles(directory=settings.MEDIA_DIR), name="media")
# 形象網站的樣式（見 docs/adr/0003-gym-website.md）
app.mount("/site/static", StaticFiles(directory=site.STATIC_DIR), name="site-static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(coaches.router, prefix=settings.API_V1_PREFIX)
app.include_router(coach_payouts.router, prefix=settings.API_V1_PREFIX)
app.include_router(products.router, prefix=settings.API_V1_PREFIX)
app.include_router(purchases.router, prefix=settings.API_V1_PREFIX)
app.include_router(courses.router, prefix=settings.API_V1_PREFIX)
app.include_router(time_slots.router, prefix=settings.API_V1_PREFIX)
app.include_router(reservations.router, prefix=settings.API_V1_PREFIX)
app.include_router(users.router, prefix=settings.API_V1_PREFIX)
app.include_router(system_settings.router, prefix=settings.API_V1_PREFIX)
app.include_router(platform.router, prefix=settings.API_V1_PREFIX)
app.include_router(website.router, prefix=settings.API_V1_PREFIX)
app.include_router(inquiries.router, prefix=settings.API_V1_PREFIX)
# 形象網站：首頁 /、/site/*、robots.txt、sitemap.xml（不在 /api/v1 底下）
app.include_router(site.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
