// 同步数据：两种方式 —— 输入手机端复制的同步码同步单次任务；一键同步全部尚未同步的任务
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { CATALOG } from '../mock/history';
import { syncCodeOf } from '../data/sync';
import { Button, Card, Section, IconLink, IconSync, IconCheck, IconWarn, IconChevronRight, fmtDT, fmtMb } from '../components/ui';

export function Sync() {
  const navigate = useNavigate();
  const ingest = useStore(s => s.ingest);
  const ingestAll = useStore(s => s.ingestAll);
  const set = useStore(s => s.set);
  const showToast = useStore(s => s.showToast);
  const syncs = useStore(s => s.syncs);
  const pending = useStore(s => s.pendingTasks());
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [allBusy, setAllBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (busy || !code.trim()) return;
    setBusy(true); setErr('');
    const r = await ingest(code);
    setBusy(false);
    if (r.ok) navigate(`/tasks/${r.task.id}`);
    else setErr(r.reason);
  };

  const syncAll = async () => {
    if (allBusy) return;
    setAllBusy(true);
    const n = await ingestAll();
    setAllBusy(false);
    showToast(n ? `已同步 ${n} 个任务` : '没有需要同步的任务');
    if (n) navigate('/tasks');
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.3fr) minmax(300px, 1fr)', gap: 24 }}>
      <div className="flex flex-col gap-4">
        {/* 方式一：同步码 */}
        <Card pad={24}>
          <div className="flex items-center">
            <div style={{ fontSize: 16, fontWeight: 600 }}>输入同步码</div>
            <button className="ml-auto pressable" style={{ fontSize: 12.5, color: 'var(--text-link)', cursor: 'pointer' }} onClick={() => set({ syncModalOpen: true })}>批量同步</button>
          </div>
          <div className="mt-1" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
            手机端「巡检结果 → 结果报告 → 同步到网页端」复制同步码，粘贴到这里。
          </div>
          <div className="flex items-center gap-2 mt-4">
            <div className="flex-1 relative">
              <span className="absolute" style={{ left: 12, top: 12, color: 'var(--text-tertiary)', display: 'inline-flex' }}><IconLink size={15} /></span>
              <input
                className="input mono w-full" style={{ height: 44, paddingLeft: 36, fontSize: 15, letterSpacing: '.06em', borderColor: err ? 'var(--danger)' : undefined }}
                placeholder="UAV-XXXX-XXXX" value={code}
                onChange={e => { setCode(e.target.value); setErr(''); }}
                onKeyDown={e => e.key === 'Enter' && submit()}
                autoFocus
              />
            </div>
            <Button style={{ height: 44, padding: '0 22px' }} onClick={submit} disabled={busy || !code.trim()} icon={busy ? <IconSync size={13} spinning /> : undefined}>
              {busy ? '同步中' : '同步'}
            </Button>
          </div>
          {err && <div className="mt-2 inline-flex items-center gap-1" style={{ fontSize: 12, color: 'var(--danger)' }}><IconWarn size={12} />{err}</div>}
        </Card>

        {/* 方式二：全量同步 */}
        <Card pad={24}>
          <div className="flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 16, fontWeight: 600 }}>同步全部数据</div>
              <div className="mt-1" style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
                拉取手机端与机载端所有尚未同步到网页端的巡检任务，包括过程数据、成果与报告。
              </div>
            </div>
            <Button style={{ height: 44, padding: '0 22px' }} onClick={syncAll} disabled={allBusy || pending.length === 0} icon={<IconSync size={13} spinning={allBusy} />}>
              {allBusy ? '同步中' : pending.length ? `同步 ${pending.length} 个任务` : '已全部同步'}
            </Button>
          </div>
          {pending.length > 0 && (
            <div className="mt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              {pending.map(t => (
                <div key={t.id} className="flex items-center gap-3" style={{ padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{t.routeName}</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.id} · {fmtDT(t.startedAt)}</div>
                  </div>
                  <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>同步码 {syncCodeOf(t.id)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* 最近同步 */}
      <Section title="最近同步" right={<button className="pressable" style={{ fontSize: 12, color: 'var(--text-link)', cursor: 'pointer' }} onClick={() => navigate('/tasks')}>全部任务</button>}>
        <Card pad={0} style={{ overflow: 'hidden' }}>
          {syncs.slice(0, 10).map((s, i) => {
            const t = CATALOG.find(x => x.id === s.taskId)!;
            return (
              <button key={s.code} className="w-full flex items-center gap-3 text-left pressable" style={{ padding: '11px 14px', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none', cursor: 'pointer' }} onClick={() => navigate(`/tasks/${t.id}`)}>
                <span style={{ color: s.complete ? 'var(--success)' : 'var(--warning)', display: 'inline-flex' }}>{s.complete ? <IconCheck size={14} /> : <IconWarn size={14} />}</span>
                <div className="flex-1 min-w-0">
                  <div className="truncate" style={{ fontSize: 12.5, fontWeight: 500 }}>{t.routeName}</div>
                  <div className="mono truncate" style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{fmtDT(t.startedAt)} · {fmtMb(s.sizeMb)}</div>
                </div>
                <span className="mono shrink-0" style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>同步于 {fmtDT(s.syncedAt).slice(5)}</span>
                <span style={{ color: 'var(--text-placeholder)', display: 'inline-flex' }}><IconChevronRight size={12} /></span>
              </button>
            );
          })}
        </Card>
      </Section>
    </div>
  );
}
