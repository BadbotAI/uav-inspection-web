// 轻量 SVG 图表：折线（遥测 / 趋势）与差值柱，不引入图表库
import { useState } from 'react';

export interface Series { name: string; color: string; points: { x: number; y: number; label?: string }[] }

export function LineChart({
  series, height = 200, yUnit = '', xFmt = v => String(v), yFmt = v => String(v), xTicks, yMin, yMax, markers, area,
}: {
  series: Series[]; height?: number; yUnit?: string;
  xFmt?: (v: number) => string; yFmt?: (v: number) => string;
  xTicks?: number[]; yMin?: number; yMax?: number;
  markers?: { x: number; label: string; tone?: 'warn' | 'info' }[];
  area?: boolean;
}) {
  const [hover, setHover] = useState<{ x: number; px: number } | null>(null);
  const W = 1000, H = height, padL = 46, padR = 16, padT = 14, padB = 28;
  const all = series.flatMap(s => s.points);
  if (all.length === 0) return null;
  const xs = all.map(p => p.x), ys = all.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = yMin ?? Math.min(...ys), y1 = yMax ?? Math.max(...ys);
  if (y1 === y0) { y1 += 1; y0 -= 1; }
  const pad = (y1 - y0) * 0.08;
  if (yMin === undefined) y0 -= pad;
  if (yMax === undefined) y1 += pad;
  const sx = (x: number) => padL + ((x - x0) / (x1 - x0 || 1)) * (W - padL - padR);
  const sy = (y: number) => padT + (1 - (y - y0) / (y1 - y0)) * (H - padT - padB);
  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => y0 + ((y1 - y0) * i) / yTicks);
  const xt = xTicks ?? Array.from({ length: 6 }, (_, i) => x0 + ((x1 - x0) * i) / 5);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const x = x0 + ((px - padL) / (W - padL - padR)) * (x1 - x0);
    if (px < padL || px > W - padR) { setHover(null); return; }
    setHover({ x, px });
  };
  const nearest = (s: Series, x: number) => s.points.reduce((a, p) => (Math.abs(p.x - x) < Math.abs(a.x - x) ? p : a), s.points[0]);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={sy(t)} y2={sy(t)} stroke="rgba(16,24,40,.07)" />
            <text x={padL - 8} y={sy(t) + 3.5} textAnchor="end" fontSize="10" fill="#737E90" fontFamily="ui-monospace, Menlo, monospace">{yFmt(t)}</text>
          </g>
        ))}
        {xt.map(t => (
          <text key={t} x={sx(t)} y={H - 8} textAnchor="middle" fontSize="10" fill="#737E90" fontFamily="ui-monospace, Menlo, monospace">{xFmt(t)}</text>
        ))}
        {markers?.map((m, i) => (
          <g key={i}>
            <line x1={sx(m.x)} x2={sx(m.x)} y1={padT} y2={H - padB} stroke={m.tone === 'warn' ? '#D9453C' : '#4C6BC0'} strokeDasharray="3 3" strokeWidth="1" />
            <text x={sx(m.x) + 4} y={padT + 10} fontSize="10" fill={m.tone === 'warn' ? '#D9453C' : '#4C6BC0'}>{m.label}</text>
          </g>
        ))}
        {series.map(s => {
          const d = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ');
          const last = s.points[s.points.length - 1], first = s.points[0];
          return (
            <g key={s.name}>
              {area && <path d={`${d} L${sx(last.x)} ${H - padB} L${sx(first.x)} ${H - padB} Z`} fill={s.color} opacity=".08" />}
              <path d={d} fill="none" stroke={s.color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              {s.points.length <= 12 && s.points.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="3.2" fill="#FFFFFF" stroke={s.color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />)}
            </g>
          );
        })}
        {hover && (
          <g>
            <line x1={hover.px} x2={hover.px} y1={padT} y2={H - padB} stroke="rgba(16,24,40,.25)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            {series.map(s => { const p = nearest(s, hover.x); return <circle key={s.name} cx={sx(p.x)} cy={sy(p.y)} r="4" fill={s.color} />; })}
          </g>
        )}
      </svg>
      {hover && (
        <div className="absolute pointer-events-none mono" style={{ left: `${(hover.px / W) * 100}%`, top: 8, transform: hover.px > W * 0.7 ? 'translateX(calc(-100% - 10px))' : 'translateX(10px)', padding: '6px 9px', borderRadius: 7, fontSize: 11, background: 'rgba(27,31,39,.92)', color: '#FFFFFF', whiteSpace: 'nowrap' }}>
          <div style={{ color: 'rgba(255,255,255,.6)' }}>{xFmt(nearest(series[0], hover.x).x)}</div>
          {series.map(s => { const p = nearest(s, hover.x); return (
            <div key={s.name} className="flex items-center gap-1.5">
              <span style={{ width: 8, height: 8, borderRadius: 999, background: s.color, display: 'inline-block' }} />
              {s.name} {p.label ?? `${yFmt(p.y)}${yUnit}`}
            </div>
          ); })}
        </div>
      )}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1" style={{ paddingLeft: 46 }}>
        {series.map(s => (
          <span key={s.name} className="inline-flex items-center gap-1.5" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            <span style={{ width: 10, height: 2.5, borderRadius: 2, background: s.color }} />{s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

// 差值柱：入库为正（蓝）、出库为负（橙）
export function DiffBars({ items, height = 120 }: { items: { label: string; value: number }[]; height?: number }) {
  const max = Math.max(1, ...items.map(i => Math.abs(i.value)));
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {items.map(it => {
        const h = (Math.abs(it.value) / max) * (height - 34);
        const pos = it.value >= 0;
        return (
          <div key={it.label} className="flex-1 flex flex-col items-center justify-end" style={{ height: '100%' }}>
            <span className="mono" style={{ fontSize: 10.5, color: pos ? 'var(--brand-subtle-text)' : 'var(--sig3d-ink)' }}>{pos ? '+' : ''}{it.value.toFixed(1)}</span>
            <div style={{ width: '60%', maxWidth: 34, height: Math.max(3, h), borderRadius: 4, background: pos ? 'var(--brand)' : 'var(--sig3d)', opacity: .85, marginTop: 3 }} />
            <span className="mono mt-1" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{it.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export const PALETTE = ['#4C6BC0', '#E8792B', '#1FA971', '#B97A17', '#7C5CBF', '#3D4B5C'];
