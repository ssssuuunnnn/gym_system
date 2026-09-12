/**
 * 裝飾用的假 QR Code 圖樣（非真實可掃描條碼）。本系統目前沒有會員端掃描功能，
 * 此圖僅供「課程報到」畫面與看板視覺呈現用，移植自 Claude Design 原型的 drawPseudoQR。
 */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h;
}

export function drawPseudoQR(canvas: HTMLCanvasElement, seed: string): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const size = canvas.width;
  const cells = 21;
  const cell = size / cells;
  let s = hashStr(seed) >>> 0;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#000';
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const inFinder = (x < 7 && y < 7) || (x > cells - 8 && y < 7) || (x < 7 && y > cells - 8);
      if (inFinder) continue;
      if (rand() > 0.55) ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  const drawFinder = (fx: number, fy: number) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(fx * cell, fy * cell, 7 * cell, 7 * cell);
    ctx.fillStyle = '#fff';
    ctx.fillRect((fx + 1) * cell, (fy + 1) * cell, 5 * cell, 5 * cell);
    ctx.fillStyle = '#000';
    ctx.fillRect((fx + 2) * cell, (fy + 2) * cell, 3 * cell, 3 * cell);
  };
  drawFinder(0, 0);
  drawFinder(cells - 7, 0);
  drawFinder(0, cells - 7);
}

/** 每 30 秒變化一次的種子，讓 QR 圖樣定時「更新」（僅視覺效果）。 */
export function buildQrSeed(courseId: number, bookingDate: string, startHour: number): string {
  const bucket = Math.floor(Date.now() / 30000);
  return `${courseId}|${bookingDate}|${startHour}|${bucket}`;
}
