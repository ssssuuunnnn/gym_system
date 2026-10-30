"""
行業用詞（ADR 0011、R48）：同一套系統給健身房與美體店（按摩、美容、SPA）用，
前後台的名詞依租戶的行業類型切換。前端的同一份對照表在 frontend/src/lib/terms.ts，兩邊要一起改。

只換「顯示的文字」；API 與資料庫裡的值（例如商品分類「團體課程／課程／用品」、教練類型）不變。
"""

from app.core.tenant_context import current_tenant

TERMS: dict[str, dict[str, str]] = {
    "fitness": {
        "business": "健身房",
        "system_name": "健身工作室管理系統",
        "staff": "教練",
        "service": "課程",
        "private": "私人課",
        "group": "團體課",
        "unit": "堂",
        "hours": "堂數",
        "attend": "上課",
        "teach": "授課",
        "customer": "學員",
        "check_in": "簽到",
        "trial": "體驗課",
        "book": "預約課程",
        "schedule": "課表",
        "staff_pay": "教練鐘點",
        "product_course": "課程",
        "product_supply": "用品",
        "private_staff": "私人教練",
        "group_staff": "團體課程教練",
        "rental_staff": "場租教練",
    },
    "beauty": {
        "business": "店家",
        "system_name": "美體工作室管理系統",
        "staff": "美容師",
        "service": "療程",
        "private": "個人療程",
        "group": "團體課",
        "unit": "次",
        "hours": "次數",
        "attend": "到店",
        "teach": "服務",
        "customer": "顧客",
        "check_in": "報到",
        "trial": "體驗療程",
        "book": "預約療程",
        "schedule": "課表",
        "staff_pay": "美容師服務費",
        "product_course": "療程",
        "product_supply": "商品",
        "private_staff": "美容師",
        "group_staff": "團體課程老師",
        "rental_staff": "場地租用",
    },
}

# 新的行業類型預設開不開團體課程（美體店預設關閉，可在系統設定打開）
GROUP_CLASSES_DEFAULT = {"fitness": True, "beauty": False}


def business_type() -> str:
    tenant = current_tenant.get()
    return tenant.business_type if tenant and tenant.business_type in TERMS else "fitness"


def terms(kind: str | None = None) -> dict[str, str]:
    """目前租戶（或指定行業）的用詞。"""
    return TERMS.get(kind or business_type(), TERMS["fitness"])


def t(key: str) -> str:
    return terms()[key]
