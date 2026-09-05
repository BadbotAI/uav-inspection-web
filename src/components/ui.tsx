// 基础组件与格式化：与手机端同一套设计语言（钢蓝 / 浅色 / 细描边卡片），桌面尺寸
import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import type { Task } from '../types';

// ---------- 格式化 ----------
const p2 = (n: number) => String(n).padStart(2, '0');
export const fmtDate = (iso: string) => iso.slice(0, 10);
export const fmtTime = (iso: string) => iso.slice(11, 19);
export const fmtDT = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
export const fmtDuration = (sec: number) => `${Math.floor(sec / 60)}分${p2(Math.round(sec % 60))}秒`;
export const fmtMb = (mb: number) => (mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(2)} MB`);
export const daysAgo = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
export const STATUS_TEXT: Record<Task['status'], string> = { success: '完成', aborted: '中断', failed: '失败' };
export const TAG_NAME = { qr: '二维码', barcode: '条码', rfid: 'RFID' } as const;
export const ISSUE_TEXT = {
  unclear: '识别不清晰', occluded: '部分遮挡', uncovered: '未完整覆盖', changed: '变化异常',
} as const;
export const totalVolume = (t: Task) => Math.round(t.stacks.reduce((a, s) => a + s.volumeM3, 0) * 10) / 10;
export const totalCount = (t: Task) => t.stacks.reduce((a, s) => a + (s.totalCount ?? 0), 0);
export const isStacked = (t: Task) => t.stacks[0]?.cargoType === 'stacked';
export const hasIssue = (t: Task) => t.stacks.some(s => s.issue) || t.status !== 'success';

// ---------- 图标：统一细线风格 ----------
const S = (size = 15) => ({
  width: size, height: size, viewBox: '0 0 16 16', fill: 'none' as const,
  stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
});
type IP = { size?: number };
export const IconDrone = ({ size }: IP) => (<svg {...S(size)}><rect x="5.6" y="5.6" width="4.8" height="4.8" rx="1.2" /><path d="M2.5 2.5l3.1 3.1M13.5 2.5l-3.1 3.1M2.5 13.5l3.1-3.1M13.5 13.5l-3.1-3.1" /><circle cx="2.5" cy="2.5" r="1.1" /><circle cx="13.5" cy="2.5" r="1.1" /><circle cx="2.5" cy="13.5" r="1.1" /><circle cx="13.5" cy="13.5" r="1.1" /></svg>);
export const IconSearch = ({ size }: IP) => (<svg {...S(size)}><circle cx="7" cy="7" r="4.3" /><path d="M10.3 10.3 13.8 13.8" /></svg>);
export const IconDownload = ({ size }: IP) => (<svg {...S(size)}><path d="M8 1.8v7M5.2 6 8 8.8 10.8 6" /><path d="M2.4 9.6v3a1.2 1.2 0 0 0 1.2 1.2h8.8a1.2 1.2 0 0 0 1.2-1.2v-3" /></svg>);
export const IconCopy = ({ size }: IP) => (<svg {...S(size)}><rect x="5.5" y="5.5" width="8" height="8" rx="1.4" /><path d="M10.5 5.5V3.7a1.2 1.2 0 0 0-1.2-1.2H3.7a1.2 1.2 0 0 0-1.2 1.2v5.6a1.2 1.2 0 0 0 1.2 1.2h1.8" /></svg>);
export const IconDoc = ({ size }: IP) => (<svg {...S(size)}><path d="M4 1.8h5.2L13 5.6v8.2a.6.6 0 0 1-.6.6H4a.6.6 0 0 1-.6-.6V2.4a.6.6 0 0 1 .6-.6z" /><path d="M9.2 1.8v3.8H13M5.8 8.6h4.4M5.8 11h4.4" /></svg>);
export const IconLayers = ({ size }: IP) => (<svg {...S(size)}><path d="M8 2.2 14 5.4 8 8.6 2 5.4z" /><path d="M2 8.4 8 11.6l6-3.2M2 11.2 8 14.4l6-3.2" /></svg>);
export const IconChevronRight = ({ size }: IP) => (<svg {...S(size)}><path d="M6 3.5 10.5 8 6 12.5" /></svg>);
export const IconChevronDown = ({ size }: IP) => (<svg {...S(size)}><path d="M3.5 6 8 10.5 12.5 6" /></svg>);
export const IconChevronLeft = ({ size }: IP) => (<svg {...S(size)}><path d="M10 3.5 5.5 8 10 12.5" /></svg>);
export const IconSync = ({ size, spinning }: IP & { spinning?: boolean }) => (<svg {...S(size)} style={spinning ? { animation: 'spin 1s linear infinite' } : undefined}><path d="M13.2 6.6A5.4 5.4 0 0 0 3.6 4.9M2.8 9.4a5.4 5.4 0 0 0 9.6 1.7" /><path d="M13.4 2.6v3.6H9.8M2.6 13.4V9.8h3.6" /></svg>);
export const IconCheck = ({ size }: IP) => (<svg {...S(size)} strokeWidth={1.8}><path d="M3.4 8.4 6.6 11.6 12.6 4.8" /></svg>);
export const IconWarn = ({ size }: IP) => (<svg {...S(size)}><path d="M8 2.6 14.6 13.2H1.4z" /><path d="M8 6.6V9.4" strokeWidth={1.4} /><circle cx="8" cy="11.3" r="0.8" fill="currentColor" stroke="none" /></svg>);
export const IconRoute = ({ size }: IP) => (<svg {...S(size)}><path d="M3.6 12.4c4.4 0 4.4-5.6 4.8-7.2.3-1 1-1.6 2.4-1.6" strokeDasharray="2.2 1.8" /><circle cx="3.6" cy="12.4" r="1.5" /><rect x="10.4" y="2" width="3.2" height="3.2" rx="0.9" /></svg>);
export const IconTrend = ({ size }: IP) => (<svg {...S(size)}><path d="M2 12.5 6 8l3 2.6 5-5.6" /><path d="M10.6 5H14v3.4" /></svg>);
export const IconBox = ({ size }: IP) => (<svg {...S(size)}><path d="M8 1.8 13.6 4.8v6.4L8 14.2 2.4 11.2V4.8z" /><path d="M2.4 4.8 8 7.8l5.6-3M8 7.8v6.4" /></svg>);
export const IconArchive = ({ size }: IP) => (<svg {...S(size)}><rect x="2" y="2.6" width="12" height="3.2" rx="0.8" /><path d="M3 5.8v6.8a.8.8 0 0 0 .8.8h8.4a.8.8 0 0 0 .8-.8V5.8M6.4 8.8h3.2" /></svg>);
export const IconGear = ({ size }: IP) => (<svg {...S(size)}><circle cx="8" cy="8" r="2.2" /><path d="M8 1.6v2M8 12.4v2M1.6 8h2M12.4 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M12.5 3.5l-1.4 1.4M4.9 11.1l-1.4 1.4" /></svg>);
export const IconLink = ({ size }: IP) => (<svg {...S(size)}><path d="M6.6 9.4 9.4 6.6M7.2 4.4l1.2-1.2a2.6 2.6 0 0 1 3.7 3.7l-1.2 1.2M8.8 11.6l-1.2 1.2a2.6 2.6 0 0 1-3.7-3.7l1.2-1.2" /></svg>);
export const IconPrint = ({ size }: IP) => (<svg {...S(size)}><path d="M4.6 5.6V2.4h6.8v3.2M4.6 11.2H3a1 1 0 0 1-1-1V6.6a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v3.6a1 1 0 0 1-1 1h-1.6" /><rect x="4.6" y="9.2" width="6.8" height="4.4" rx="0.6" /></svg>);
export const IconExpand = ({ size }: IP) => (<svg {...S(size)}><path d="M2.4 6V2.4H6M10 2.4h3.6V6M13.6 10v3.6H10M6 13.6H2.4V10" /></svg>);
export const IconCompress = ({ size }: IP) => (<svg {...S(size)}><path d="M6 2.4V6H2.4M10 2.4V6h3.6M13.6 10H10v3.6M2.4 10H6v3.6" /></svg>);
export const IconPin = ({ size }: IP) => (<svg {...S(size)}><path d="M8 14.2s4.2-4 4.2-7.4a4.2 4.2 0 0 0-8.4 0c0 3.4 4.2 7.4 4.2 7.4z" /><circle cx="8" cy="6.8" r="1.5" /></svg>);
export const IconPhone = ({ size }: IP) => (<svg {...S(size)}><rect x="4" y="1.5" width="8" height="13" rx="1.6" /><path d="M6.4 12h3.2" /></svg>);
export const IconPlus = ({ size }: IP) => (<svg {...S(size)}><path d="M8 3v10M3 8h10" /></svg>);
export const IconFilter = ({ size }: IP) => (<svg {...S(size)}><path d="M2.4 3.4h11.2L9.6 8.4v4.4l-3.2 1.2V8.4z" /></svg>);
export const IconCamera = ({ size }: IP) => (<svg {...S(size)}><path d="M2.4 5.6h2.4l1.2-1.8h4l1.2 1.8h2.4v7.2H2.4z" /><circle cx="8" cy="9" r="2.2" /></svg>);
export const IconVideo = ({ size }: IP) => (<svg {...S(size)}><rect x="2" y="4" width="8.4" height="8" rx="1.2" /><path d="M10.4 7.2 14 5.2v5.6l-3.6-2" /></svg>);
export const IconUser = ({ size }: IP) => (<svg {...S(size)}><circle cx="8" cy="5.4" r="2.8" /><path d="M2.8 14a5.2 5.2 0 0 1 10.4 0" /></svg>);

// ---------- 容器 ----------
export function Card({ children, style, className = '', pad = 16 }: { children: React.ReactNode; style?: React.CSSProperties; className?: string; pad?: number }) {
  return (
    <div
      className={className}
      style={{
        borderRadius: 10, padding: pad,
        background: 'var(--surface-1)', border: '1px solid var(--card-stroke)', boxShadow: 'var(--shadow-card)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Section({ title, right, children, style }: { title: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="dlabel" style={{ fontSize: 11 }}>{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger-outline';
export function Button({
  variant = 'primary', small, disabled, onClick, children, style, icon, title,
}: {
  variant?: ButtonVariant; small?: boolean; disabled?: boolean; onClick?: (e: React.MouseEvent) => void;
  children?: React.ReactNode; style?: React.CSSProperties; icon?: React.ReactNode; title?: string;
}) {
  const base: Record<ButtonVariant, React.CSSProperties> = {
    primary: { background: 'var(--brand)', color: '#FFFFFF', border: '1px solid transparent', boxShadow: '0 1px 6px rgba(76,107,192,.25)' },
    secondary: { background: 'var(--surface-1)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' },
    ghost: { background: 'transparent', color: 'var(--text-link)', border: '1px solid transparent' },
    'danger-outline': { background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid rgba(217,69,60,.35)' },
  };
  return (
    <button
      title={title}
      className={`inline-flex items-center justify-center gap-1.5 select-none ${disabled ? '' : 'pressable'}`}
      style={{
        height: small ? 30 : 36, padding: small ? '0 12px' : '0 16px', borderRadius: 8,
        fontSize: small ? 12.5 : 13.5, fontWeight: 500, whiteSpace: 'nowrap',
        ...base[variant],
        ...(disabled ? { background: 'var(--surface-3)', color: 'var(--text-placeholder)', border: '1px solid var(--border-subtle)', cursor: 'default', boxShadow: 'none' } : { cursor: 'pointer' }),
        ...style,
      }}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  );
}

export type PillTone = 'hi' | 'mid' | 'lo' | 'info' | 'neutral';
const PILL: Record<PillTone, { bg: string; fg: string }> = {
  hi: { bg: 'var(--success-bg)', fg: 'var(--success)' },
  mid: { bg: 'var(--warning-bg)', fg: 'var(--warning)' },
  lo: { bg: 'var(--danger-bg)', fg: 'var(--danger)' },
  info: { bg: 'var(--brand-subtle-bg)', fg: 'var(--brand-subtle-text)' },
  neutral: { bg: 'var(--tag-gray-bg)', fg: 'var(--tag-gray-fg)' },
};
export function Pill({ tone = 'neutral', children }: { tone?: PillTone; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1" style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500, background: PILL[tone].bg, color: PILL[tone].fg, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}
export function Tag({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'info' }) {
  return (
    <span style={{ padding: '2px 7px', borderRadius: 5, fontSize: 10.5, background: tone === 'info' ? 'var(--tag-blue-bg)' : 'var(--tag-gray-bg)', color: tone === 'info' ? 'var(--tag-blue-fg)' : 'var(--tag-gray-fg)', whiteSpace: 'nowrap' }}>
      {children}
    </span>
  );
}
export const StatusPill = ({ task }: { task: Task }) => (
  <Pill tone={task.status === 'success' ? 'hi' : task.status === 'aborted' ? 'mid' : 'lo'}>{STATUS_TEXT[task.status]}</Pill>
);

export function Stat({ label, value, unit, sub, tone }: { label: string; value: React.ReactNode; unit?: string; sub?: React.ReactNode; tone?: 'danger' | 'warning' }) {
  return (
    <Card pad={14}>
      <div className="dlabel">{label}</div>
      <div className="flex items-baseline gap-1 mt-1.5">
        <span className="mono" style={{ fontSize: 24, lineHeight: 1.1, fontWeight: 500, color: tone === 'danger' ? 'var(--danger)' : tone === 'warning' ? 'var(--warning)' : 'var(--text-primary)' }}>{value}</span>
        {unit && <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{unit}</span>}
      </div>
      {sub && <div className="mt-1" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{sub}</div>}
    </Card>
  );
}

export function EmptyState({ icon, text, sub, actionText, onAction }: { icon?: React.ReactNode; text: string; sub?: string; actionText?: string; onAction?: () => void }) {
  return (
    <div className="flex flex-col items-center text-center" style={{ padding: '56px 24px' }}>
      {icon && <span className="flex items-center justify-center mb-3" style={{ width: 52, height: 52, borderRadius: 999, background: 'var(--fill-quiet)', color: 'var(--text-tertiary)' }}>{icon}</span>}
      <div style={{ fontSize: 14, fontWeight: 500 }}>{text}</div>
      {sub && <div className="mt-1 leading-[1.6]" style={{ fontSize: 12.5, color: 'var(--text-tertiary)', maxWidth: 360 }}>{sub}</div>}
      {actionText && <div className="mt-4"><Button onClick={onAction}>{actionText}</Button></div>}
    </div>
  );
}

export function Modal({ open, title, onClose, children, width = 560, footer }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode; width?: number; footer?: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center mask-in no-print" style={{ background: 'rgba(16,24,40,.36)' }} onClick={onClose}>
      <div className="dialog-in flex flex-col" style={{ width, maxWidth: 'calc(100vw - 48px)', maxHeight: 'calc(100vh - 64px)', background: 'var(--surface-1)', borderRadius: 14, boxShadow: 'var(--shadow-modal)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center shrink-0" style={{ height: 52, padding: '0 8px 0 20px', borderBottom: '1px solid var(--divider)' }}>
          <span className="flex-1" style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
          <button className="flex items-center justify-center pressable" style={{ width: 36, height: 36, fontSize: 20, color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={onClose} aria-label="关闭">×</button>
        </div>
        <div className="flex-1 overflow-y-auto" style={{ padding: 20 }}>{children}</div>
        {footer && <div className="shrink-0 flex items-center justify-end gap-2" style={{ padding: '12px 20px', borderTop: '1px solid var(--divider)', background: 'var(--surface-3)' }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Toast() {
  const toast = useStore(s => s.toast);
  if (!toast) return null;
  return (
    <div className="fixed z-[60] mask-in no-print" style={{ left: '50%', bottom: 28, transform: 'translateX(-50%)', padding: '9px 16px', borderRadius: 999, fontSize: 13, background: 'rgba(27,31,39,.92)', color: '#FFFFFF', boxShadow: 'var(--shadow-popover)', whiteSpace: 'nowrap' }}>
      {toast}
    </div>
  );
}

export function CopyButton({ text, label = '复制', small = true, done = '已复制' }: { text: string; label?: string; small?: boolean; done?: string }) {
  const showToast = useStore(s => s.showToast);
  const [ok, setOk] = useState(false);
  return (
    <Button
      variant="secondary" small={small} icon={ok ? <IconCheck size={12} /> : <IconCopy size={12} />}
      onClick={async e => {
        e.stopPropagation();
        try { await navigator.clipboard.writeText(text); } catch { /* 剪贴板不可用时仍提示 */ }
        setOk(true); showToast(done); setTimeout(() => setOk(false), 1600);
      }}
    >
      {ok ? done : label}
    </Button>
  );
}

// 同步码展示：等宽、可复制
export function CodeChip({ code, copy = true }: { code: string; copy?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="mono" style={{ fontSize: 12.5, padding: '3px 8px', borderRadius: 6, background: 'var(--brand-subtle-bg)', color: 'var(--brand-subtle-text)', letterSpacing: '.04em' }}>{code}</span>
      {copy && <CopyButton text={code} label="" />}
    </span>
  );
}

// 自绘下拉选择：与输入框同几何的触发器 + 玻璃浮层选项；点击外部或 Esc 收起
export function Select({
  value, options, onChange, width = 160, ariaLabel,
}: {
  value: string;
  options: { value: string; label: string; hint?: string }[];
  onChange: (v: string) => void;
  width?: number;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); window.removeEventListener('keydown', onKey); };
  }, [open]);
  const cur = options.find(o => o.value === value) ?? options[0];
  const isDefault = cur?.value === options[0]?.value;
  return (
    <div ref={ref} className="relative" style={{ width }}>
      <button
        className="input w-full flex items-center gap-2 text-left"
        style={{ cursor: 'pointer', borderColor: open ? 'var(--brand)' : undefined, boxShadow: open ? '0 0 0 3px rgba(76,107,192,.14)' : undefined }}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open} aria-haspopup="listbox" aria-label={ariaLabel}
      >
        <span className="flex-1 truncate" style={{ color: isDefault ? 'var(--text-secondary)' : 'var(--text-primary)', fontWeight: isDefault ? 400 : 500 }}>
          {cur?.label}
        </span>
        <span style={{ display: 'inline-flex', color: 'var(--text-tertiary)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          <IconChevronDown size={12} />
        </span>
      </button>
      {open && (
        <div
          className="absolute flex flex-col mask-in"
          role="listbox"
          style={{
            left: 0, top: 'calc(100% + 5px)', minWidth: '100%', zIndex: 30, padding: 5, gap: 2,
            background: 'var(--glass-bg)', backdropFilter: 'blur(14px)', borderRadius: 10,
            border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-popover)',
            maxHeight: 288, overflowY: 'auto',
          }}
        >
          {options.map(o => {
            const on = o.value === value;
            return (
              <button
                key={o.value}
                role="option" aria-selected={on}
                className="flex items-center gap-2 text-left"
                style={{
                  padding: '8px 10px', borderRadius: 7, fontSize: 12.5, cursor: 'pointer', whiteSpace: 'nowrap',
                  background: on ? 'var(--brand-subtle-bg)' : 'transparent',
                  color: on ? 'var(--brand-subtle-text)' : 'var(--text-primary)', fontWeight: on ? 500 : 400,
                }}
                onMouseEnter={e => { if (!on) (e.currentTarget as HTMLElement).style.background = 'var(--fill-quiet)'; }}
                onMouseLeave={e => { if (!on) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                onClick={() => { onChange(o.value); setOpen(false); }}
              >
                <span className="flex-1">{o.label}</span>
                {o.hint && <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{o.hint}</span>}
                {on && <span style={{ display: 'inline-flex' }}><IconCheck size={12} /></span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// 表格行选择框：无 emoji 的方框勾选
export function Check({ on, onChange, indeterminate }: { on: boolean; onChange: (v: boolean) => void; indeterminate?: boolean }) {
  return (
    <button
      className="flex items-center justify-center"
      style={{ width: 16, height: 16, borderRadius: 4, cursor: 'pointer', background: on || indeterminate ? 'var(--brand)' : 'var(--surface-1)', border: `1.4px solid ${on || indeterminate ? 'var(--brand)' : 'var(--border-strong)'}`, color: '#FFFFFF' }}
      onClick={e => { e.stopPropagation(); onChange(!on); }}
      aria-label={on ? '取消选择' : '选择'}
    >
      {on && <IconCheck size={10} />}
      {!on && indeterminate && <span style={{ width: 8, height: 1.6, background: '#FFFFFF', borderRadius: 1 }} />}
    </button>
  );
}
