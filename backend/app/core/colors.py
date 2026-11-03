"""
品牌色的對比計算（WCAG 2.x 相對亮度）。形象網站與會員前台共用，前端 frontend/src/lib/brandColor.ts 是同一套規則。

自訂品牌色要同時當「白字的底色」（按鈕）與「淺底上的文字色」（標題小字、連結）：
- 對 CONTRAST_REFERENCE（各版型淺色區塊裡最深的 #EEF0F3）≥ 4.5:1，白底自然也夠
- 對自己的 8% 淺色底（樣式裡的 --soft）也 ≥ 4.5:1
深色區塊上改用 light_variant()：往白色調亮到對兩種深色底（#15181D、沉穩版型的深藍 #13294B）都 ≥ 6:1。
"""

import re

HEX_RE = re.compile(r"^#?([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$")
MIN_CONTRAST = 4.5
CONTRAST_REFERENCE = "#EEF0F3"
DARK_SURFACE = "#15181D"
# 會放亮色版文字的深色底：一般深色區塊、沉穩版型的深藍色帶
DARK_SURFACES = (DARK_SURFACE, "#13294B")
LIGHT_ON_DARK_CONTRAST = 6.0
SOFT_MIX = 0.08  # 與 CSS 的 color-mix(in srgb, var(--accent) 8%, #fff) 一致


def normalize_hex(value: str) -> str | None:
    """'#abc'、'abc'、'#aabbcc' → '#AABBCC'；格式不對回傳 None。"""
    m = HEX_RE.match(value.strip())
    if not m:
        return None
    digits = m.group(1)
    if len(digits) == 3:
        digits = "".join(ch * 2 for ch in digits)
    return f"#{digits.upper()}"


def _rgb(hex_color: str) -> tuple[float, float, float]:
    h = hex_color.lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))  # type: ignore[return-value]


def _hex(rgb: tuple[float, float, float]) -> str:
    return "#" + "".join(f"{round(max(0.0, min(1.0, c)) * 255):02X}" for c in rgb)


def luminance(hex_color: str) -> float:
    def channel(c: float) -> float:
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    r, g, b = (channel(c) for c in _rgb(hex_color))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def _mix(a: str, b: str, weight_a: float) -> str:
    ra, rb = _rgb(a), _rgb(b)
    return _hex(tuple(x * weight_a + y * (1 - weight_a) for x, y in zip(ra, rb)))  # type: ignore[arg-type]


def soft_background(hex_color: str) -> str:
    return _mix(hex_color, "#FFFFFF", SOFT_MIX)


def brand_contrast(hex_color: str) -> float:
    """自訂品牌色在網站上最差情況的對比（用來判斷能不能用）。"""
    return min(contrast(hex_color, CONTRAST_REFERENCE), contrast(hex_color, soft_background(hex_color)))


def brand_problem(value: str) -> str | None:
    """不能當品牌色的原因；可以用時回傳 None。"""
    hex_color = normalize_hex(value)
    if hex_color is None:
        return "請輸入 6 碼色碼，例如 #C3400D"
    ratio = brand_contrast(hex_color)
    if ratio < MIN_CONTRAST:
        return f"這個顏色太淺，按鈕的白字和淺色底上的文字會看不清楚（對比 {ratio:.1f}:1，至少要 {MIN_CONTRAST}:1），請選深一點的顏色"
    return None


def light_variant(hex_color: str) -> str:
    """放在深色區塊（主視覺、方案價格、沉穩的深藍色帶）上的亮色版：往白色調到對每種深色底都 ≥ 6:1。"""

    def ok(color: str) -> bool:
        return all(contrast(color, dark) >= LIGHT_ON_DARK_CONTRAST for dark in DARK_SURFACES)

    if ok(hex_color):
        return hex_color
    for step in range(1, 101):
        candidate = _mix("#FFFFFF", hex_color, step / 100)
        if ok(candidate):
            return candidate
    return "#FFFFFF"
