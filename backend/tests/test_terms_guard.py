"""
行業用詞的防漏網（ADR 0011、R48）：已改用名詞對照表的畫面，不能再直接寫健身用語，
否則美體店會看到「教練」「學員」「堂數」。要用 lib/terms.ts 的 useTerms()。

只掃已經改完的檔案（第一期：會員與教練前台、後台選單與主要列表）；之後改完的畫面加進 GUARDED。
API 的值（例如教練類型 '私人教練'、比較用的 '堂'）照常可以寫，掃描前先拿掉。
"""

import re
from pathlib import Path

import pytest

FRONTEND = Path(__file__).resolve().parents[2] / "frontend" / "src"

GUARDED = [
    "components/AppLayout.tsx",
    "components/member/MemberLayout.tsx",
    "pages/member/Home/index.tsx",
    "pages/member/Home/components/NextClassCard.tsx",
    "pages/member/Home/components/PlanCard.tsx",
    "pages/member/Book/index.tsx",
    "pages/member/Book/components/ConfirmSheet.tsx",
    "pages/member/Book/components/PrivatePanel.tsx",
    "pages/member/BuyProduct/index.tsx",
    "pages/member/BuyProduct/lib.ts",
    "pages/member/BuyProduct/components/OrderSheet.tsx",
    "pages/member/BuyProduct/components/PlanCard.tsx",
    "pages/member/MyBookings/index.tsx",
    "pages/member/MyProducts.tsx",
    "pages/member/MyCoupons.tsx",
    "pages/member/Me.tsx",
    "pages/coach/Today/index.tsx",
    "pages/coach/Today/components/ClassUnitCard.tsx",
    "pages/coach/Attendance.tsx",
    "pages/coach/Payouts.tsx",
    "pages/liff/LiffEntry/components/JoinPanel.tsx",
    "pages/admin/CoachList.tsx",
    "pages/admin/CoachForm.tsx",
    "pages/admin/BookingReviewList.tsx",
    "pages/admin/ProductList.tsx",
    "pages/admin/PurchaseList.tsx",
    "pages/admin/MemberList.tsx",
    "pages/admin/Dashboard.tsx",
]

# 健身專用的說法（美體店不該看到）
BANNED = re.compile(r"教練|學員|堂數|簽到|健身|上課|授課|每堂|退堂|\d+ 堂|堂課")
# API 的值與程式比較用的字面值
ALLOWED_LITERALS = re.compile(r"'(私人教練|團體課程教練|場租教練|堂|堂課)'")
COMMENTS = re.compile(r"/\*.*?\*/|//[^\n]*|\{/\*.*?\*/\}", re.S)


def _code(path: Path) -> list[tuple[int, str]]:
    text = COMMENTS.sub(lambda m: "\n" * m.group(0).count("\n"), path.read_text(encoding="utf-8"))
    text = ALLOWED_LITERALS.sub("''", text)
    return list(enumerate(text.splitlines(), start=1))


@pytest.mark.skipif(not FRONTEND.exists(), reason="沒有前端原始碼（只有後端的映像）")
@pytest.mark.parametrize("relative", GUARDED)
def test_no_hard_coded_fitness_words(relative):
    path = FRONTEND / relative
    hits = [f"{relative}:{no}: {line.strip()}" for no, line in _code(path) if BANNED.search(line)]
    assert not hits, "請改用 useTerms() 的用詞：\n" + "\n".join(hits)


@pytest.mark.skipif(not FRONTEND.exists(), reason="沒有前端原始碼（只有後端的映像）")
def test_frontend_and_backend_dictionaries_match():
    """lib/terms.ts 與 services/terms.py 的兩份對照表要一致（前端 camelCase、後端 snake_case）。"""
    from app.services.terms import TERMS

    source = (FRONTEND / "lib" / "terms.ts").read_text(encoding="utf-8")
    for label, kind in (("健身", "fitness"), ("美體", "beauty")):
        block = re.search(label + r": \{(.*?)\n  \}", source, re.S).group(1)
        front = {
            re.sub(r"[A-Z]", lambda m: "_" + m.group(0).lower(), key): value
            for key, value in re.findall(r"(\w+): '([^']*)'", block)
        }
        assert front == TERMS[kind], f"{label} 的用詞前後端不一致"
