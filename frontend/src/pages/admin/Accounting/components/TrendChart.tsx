import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Empty, theme } from 'antd';
import dayjs from 'dayjs';
import type { TrendPoint } from '../../../../api/accounting';
import { money, signedMoney } from '../lib';

export interface TrendChartProps {
  /** 每月收入／支出，舊到新 */
  data: TrendPoint[];
  height?: number;
  style?: CSSProperties;
}

const PAD = { top: 12, right: 8, bottom: 28, left: 56 };
const GAP = 2; // 同一個月兩根柱子之間的間隔
const RADIUS = 4;

/** 好讀的刻度：1、2、5 × 10ⁿ */
function niceStep(max: number, ticks: number) {
  const raw = max / ticks;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

const axisLabel = (v: number) => (v >= 10000 ? `${v / 10000} 萬` : v.toLocaleString('zh-TW'));

/** 只有上方圓角的柱子（底部貼齊基準線） */
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(RADIUS, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * 近幾個月的收入與支出（分組長條圖）。滑過某個月顯示收入、支出、淨額。
 * 顏色：收入＝藍、支出＝橘（antd 色票）；圖例在上方，數字另有表格可看。
 */
export function TrendChart({ data, height = 240, style }: TrendChartProps) {
  const { token } = theme.useToken();
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([e]) => setWidth(Math.max(280, e.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const series = [
    { key: 'income' as const, label: '收入', color: token.blue6 },
    { key: 'expense' as const, label: '支出', color: token.orange6 },
  ];

  const max = Math.max(0, ...data.flatMap((d) => [d.income, d.expense]));
  const step = niceStep(max || 1, 4);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const band = plotW / Math.max(1, data.length);
  const barW = Math.max(3, Math.min(24, (band * 0.6 - GAP) / 2));
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const empty = data.every((d) => d.income === 0 && d.expense === 0);

  const hovered = hover != null ? data[hover] : null;
  const tipLeft = hover != null ? PAD.left + band * hover + band / 2 : 0;

  return (
    <div style={{ position: 'relative', ...style }}>
      <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 12, color: token.colorTextSecondary }}>
        {series.map((s) => (
          <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div ref={box} style={{ position: 'relative' }}>
        {empty ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="這段期間沒有收支" style={{ height }} />
        ) : (
          <svg width={width} height={height} role="img" aria-label="每月收入與支出" style={{ display: 'block' }}>
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                  stroke={t === 0 ? token.colorBorder : token.colorBorderSecondary}
                  strokeDasharray={t === 0 ? undefined : '2 4'}
                />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={token.colorTextTertiary}>
                  {axisLabel(t)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const cx = PAD.left + band * i + band / 2;
              const showLabel = data.length <= 12 || i % 2 === data.length % 2;
              return (
                <g key={d.month}>
                  {hover === i && (
                    <rect x={PAD.left + band * i} y={PAD.top} width={band} height={plotH} fill={token.colorFillTertiary} />
                  )}
                  {series.map((s, j) => {
                    const v = d[s.key];
                    if (v <= 0) return null;
                    const x = j === 0 ? cx - GAP / 2 - barW : cx + GAP / 2;
                    return <path key={s.key} d={barPath(x, y(v), barW, y(0) - y(v))} fill={s.color} />;
                  })}
                  {showLabel && (
                    <text x={cx} y={height - 8} textAnchor="middle" fontSize={11} fill={token.colorTextTertiary}>
                      {dayjs(`${d.month}-01`).format(dayjs(`${d.month}-01`).month() === 0 ? 'YYYY/M' : 'M 月')}
                    </text>
                  )}
                  {/* 滑鼠感應區＝整個月份欄，比柱子大 */}
                  <rect
                    x={PAD.left + band * i}
                    y={PAD.top}
                    width={band}
                    height={plotH + PAD.bottom}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  />
                </g>
              );
            })}
          </svg>
        )}
        {hovered && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: Math.min(Math.max(tipLeft, 80), width - 80),
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              background: token.colorBgElevated,
              boxShadow: token.boxShadowSecondary,
              borderRadius: token.borderRadius,
              padding: '8px 12px',
              fontSize: 12,
              whiteSpace: 'nowrap',
              color: token.colorText,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{dayjs(`${hovered.month}-01`).format('YYYY 年 M 月')}</div>
            {series.map((s) => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                <span style={{ color: token.colorTextSecondary }}>{s.label}</span>
                <span style={{ marginLeft: 'auto', paddingLeft: 12 }}>{money(hovered[s.key])}</span>
              </div>
            ))}
            <div style={{ display: 'flex', marginTop: 4, borderTop: `1px solid ${token.colorSplit}`, paddingTop: 4 }}>
              <span style={{ color: token.colorTextSecondary }}>淨額</span>
              <span style={{ marginLeft: 'auto', paddingLeft: 12, fontWeight: 600 }}>{signedMoney(hovered.net)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
