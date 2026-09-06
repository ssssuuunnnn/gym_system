import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.routers import auth, coaches, courses, products, purchases, reservations, system_settings, time_slots, users

app = FastAPI(title=settings.PROJECT_NAME)

# 上傳檔案（教練照片等）以靜態路徑 /media 對外提供
os.makedirs(settings.MEDIA_DIR, exist_ok=True)
app.mount("/media", StaticFiles(directory=settings.MEDIA_DIR), name="media")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(coaches.router, prefix=settings.API_V1_PREFIX)
app.include_router(products.router, prefix=settings.API_V1_PREFIX)
app.include_router(purchases.router, prefix=settings.API_V1_PREFIX)
app.include_router(courses.router, prefix=settings.API_V1_PREFIX)
app.include_router(time_slots.router, prefix=settings.API_V1_PREFIX)
app.include_router(reservations.router, prefix=settings.API_V1_PREFIX)
app.include_router(users.router, prefix=settings.API_V1_PREFIX)
app.include_router(system_settings.router, prefix=settings.API_V1_PREFIX)


@app.get("/health")
def health_check():
    return {"status": "ok"}
