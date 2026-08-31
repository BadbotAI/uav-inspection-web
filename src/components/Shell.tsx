// 桌面外壳：左侧导航 + 顶栏 + 内容区；同步码接入弹窗全局可用
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useStore, ACCOUNT, type SyncOutcome } from '../store';
import { Button, Modal, Toast, IconLink, IconBox, IconTrend, IconCheck, IconWarn, IconSync, IconChevronRight, fmtDT } from './ui';

function Mark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" fill="none">
      <circle cx="64" cy="64" r="60" stroke="rgba(76,107,192,.18)" strokeWidth="3" />
      <circle cx="64" cy="64" r="46" stroke="rgba(76,107,192,.34)" strokeWidth="3" strokeDasharray="4 8" />
      <path d="M64 4 A60 60 0 0 1 121 45" stroke="var(--brand)" strokeWidth="4" strokeLinecap="round" />
      <rect x="52" y="52" width="24" height="24" rx="6" stroke="var(--text-primary)" strokeWidth="5" />
      <path d="M36 36 L52 52 M92 36 L76 52 M36 92 L52 76 M92 92 L76 76" stroke="var(--text-primary)" strokeWidth="5" strokeLinecap="round" />
      <circle cx="36" cy="36" r="6.5" stroke="var(--brand)" strokeWidth="4" />
      <circle cx="92" cy="36" r="6.5" stroke="var(--brand)" strokeWidth="4" />
      <circle cx="36" cy="92" r="6.5" stroke="var(--brand)" strokeWidth="4" />
      <circle cx="92" cy="92" r="6.5" stroke="var(--brand)" strokeWidth="4" />
      <circle cx="64" cy="64" r="4" fill="var(--brand)" />
    </svg>
  );
}

const NAV = [
  { to: '/sync', label: '同步数据', icon: <IconLink size={15} /> },
  { to: '/tasks', label: '任务数据', icon: <IconBox size={15} /> },
  { to: '/analysis', label: '数据分析', icon: <IconTrend size={15} /> },
];

const TITLES: Record<string, string> = {
  '/sync': '同步数据', '/tasks': '任务数据', '/analysis': '数据分析',
};

// 同步码接入弹窗：支持一次粘贴多个码，逐个校验、拉取并给出结果
export function SyncModal() {
  const open = useStore(s => s.syncModalOpen);
  const prefill = useStore(s => s.syncPrefill);
  const set = useStore(s => s.set);
  const ingest = useStore(s => s.ingest);
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<SyncOutcome[]>([]);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => { if (open) { setText(prefill); setResults([]); setCurrent(null); } }, [open, prefill]);

  const codes = text.split(/[\n,，;；\s]+/).map(s => s.trim()).filter(Boolean);
  const close = () => set({ syncModalOpen: false, syncPrefill: '' });

  const run = async () => {
    if (busy || codes.length === 0) return;
    setBusy(true);
    const out: SyncOutcome[] = [];
    for (const c of codes) {
      setCurrent(c);
      out.push(await ingest(c));
      setResults([...out]);
    }
    setCurrent(null);
    setBusy(false);
    // 单个码接入成功：短暂展示结果后直接进入任务详情
    const first = out[0];
    if (out.length === 1 && first.ok) {
      const id = first.task.id;
      setTimeout(() => { close(); navigate(`/tasks/${id}`); }, 500);
    }
  };

  const downloadRecordsOk = results.filter(r => r.ok).length;

  return (
    <Modal
      open={open} onClose={close} title="同步数据" width={600}
      footer={<>
        <Button variant="secondary" onClick={close}>{results.length ? '完成' : '取消'}</Button>
        <Button onClick={run} disabled={busy || codes.length === 0} icon={busy ? <IconSync size={13} spinning /> : <IconLink size={13} />}>
          {busy ? '同步中' : codes.length > 1 ? `同步 ${codes.length} 个任务` : '同步'}
        </Button>
      </>}
    >
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        粘贴手机端复制的同步码。一次可粘贴多个，用换行或逗号分隔。
      </div>
      <textarea
        className="input mt-3 mono"
        style={{ width: '100%', height: 92, padding: '10px 12px', resize: 'vertical', fontSize: 13.5, letterSpacing: '.04em', lineHeight: 1.6 }}
        placeholder={'UAV-XXXX-XXXX'}
        value={text} onChange={e => setText(e.target.value)} disabled={busy}
        onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void run(); }}
        autoFocus
      />
      <div className="mt-1.5 flex items-center justify-between" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
        <span>有效期 7 天，超期请在手机端重新生成</span>
        <span className="mono">{codes.length} 个</span>
      </div>

      {(results.length > 0 || current) && (
        <div className="mt-4 flex flex-col gap-1.5">
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-3" style={{ padding: '10px 12px', borderRadius: 8, background: r.ok ? 'var(--success-bg)' : 'var(--danger-bg)' }}>
              <span style={{ color: r.ok ? 'var(--success)' : 'var(--danger)', display: 'inline-flex' }}>{r.ok ? <IconCheck size={14} /> : <IconWarn size={14} />}</span>
              <span className="mono" style={{ fontSize: 12.5, minWidth: 128 }}>{r.ok ? r.record.code : r.code}</span>
              <span className="flex-1 truncate" style={{ fontSize: 12.5, color: r.ok ? 'var(--text-primary)' : 'var(--danger)' }}>
                {r.ok ? `${r.already ? '此前已同步' : '已同步'} · ${r.task.routeName} · ${fmtDT(r.task.startedAt)}` : r.reason}
              </span>
              {r.ok && (
                <button className="inline-flex items-center gap-0.5 pressable" style={{ fontSize: 12, color: 'var(--text-link)', cursor: 'pointer' }} onClick={() => { close(); navigate(`/tasks/${r.task.id}`); }}>
                  查看 <IconChevronRight size={11} />
                </button>
              )}
            </div>
          ))}
          {current && (
            <div className="flex items-center gap-3" style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--brand-subtle-bg)' }}>
              <span style={{ color: 'var(--brand)', display: 'inline-flex' }}><IconSync size={14} spinning /></span>
              <span className="mono" style={{ fontSize: 12.5, minWidth: 128 }}>{current}</span>
              <span style={{ fontSize: 12.5, color: 'var(--brand-subtle-text)' }}>正在拉取数据包</span>
            </div>
          )}
          {!busy && results.length > 1 && (
            <div className="mono mt-1" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{downloadRecordsOk}/{results.length} 个同步成功</div>
          )}
        </div>
      )}
    </Modal>
  );
}

export function Shell() {
  const loc = useLocation();
  const set = useStore(s => s.set);
  const base = '/' + (loc.pathname.split('/')[1] || 'tasks');
  const title = TITLES[base] ?? '仓储无人机巡检 · 数据中心';

  return (
    <div className="flex" style={{ minHeight: '100vh' }}>
      {/* 侧栏 */}
      <aside className="no-print shrink-0 flex flex-col" style={{ width: 'var(--sidebar-w)', background: 'var(--surface-1)', borderRight: '1px solid var(--border-subtle)', position: 'sticky', top: 0, height: '100vh' }}>
        <div className="flex items-center gap-2.5" style={{ padding: '18px 16px 14px' }}>
          <Mark />
          <div className="min-w-0">
            <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: '.04em' }}>仓储无人机巡检</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', letterSpacing: '.06em' }}>数据中心</div>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5" style={{ padding: '0 10px' }}>
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `navitem ${isActive ? 'on' : ''}`}>
              <span style={{ display: 'inline-flex', opacity: .9 }}>{n.icon}</span>
              <span className="flex-1">{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto" style={{ padding: 14, borderTop: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center mono shrink-0" style={{ width: 30, height: 30, borderRadius: 999, background: 'var(--brand-subtle-bg)', color: 'var(--brand-subtle-text)', fontSize: 12.5, fontWeight: 600 }}>{ACCOUNT.name}</span>
            <div className="min-w-0">
              <div className="truncate" style={{ fontSize: 12.5, fontWeight: 500 }}>{ACCOUNT.org} · {ACCOUNT.name}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{ACCOUNT.role} · 私有化部署</div>
            </div>
          </div>
        </div>
      </aside>

      {/* 内容 */}
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="no-print flex items-center shrink-0" style={{ height: 54, padding: '0 28px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--glass-bar)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 20 }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
        </header>
        <div className="flex-1" style={{ padding: '24px 28px 40px', maxWidth: 1360, width: '100%' }}>
          <Outlet />
        </div>
      </main>

      <SyncModal />
      <Toast />
    </div>
  );
}
