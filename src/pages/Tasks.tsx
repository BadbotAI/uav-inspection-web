// 任务数据：已同步任务的检索与批量下载
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { SCENES, ROUTES } from '../mock/routes';
import { syncCodeOf, normalizeCode, CODE_RE } from '../data/sync';
import { packSizeOf } from '../data/process';
import { Button, Card, Stat, StatusPill, Check, EmptyState, IconSearch, IconDownload, IconBox, IconWarn, IconLink, fmtDT, fmtMb, totalVolume, totalCount, isStacked } from '../components/ui';
import type { Task } from '../types';

export function Tasks() {
  const navigate = useNavigate();
  const tasks = useStore(s => s.libraryTasks());
  const enqueue = useStore(s => s.enqueueDownload);
  const showToast = useStore(s => s.showToast);
  const set = useStore(s => s.set);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | Task['status']>('all');
  const [scene, setScene] = useState<string>('all');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const sceneOf = (t: Task) => ROUTES.find(r => r.id === t.routeId)?.sceneId ?? '';
  const sceneName = (t: Task) => SCENES.find(s => s.id === sceneOf(t))?.name ?? '';

  const shown = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return tasks
      .filter(t => {
        if (status !== 'all' && t.status !== status) return false;
        if (scene !== 'all' && sceneOf(t) !== scene) return false;
        if (!kw) return true;
        const code = syncCodeOf(t.id).toLowerCase();
        return t.id.toLowerCase().includes(kw) || code.includes(kw.replace(/\s/g, '')) || t.routeName.toLowerCase().includes(kw)
          || sceneName(t).toLowerCase().includes(kw) || t.operator.toLowerCase().includes(kw);
      })
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }, [tasks, q, status, scene]);

  // 搜索框里粘了一个尚未同步的同步码：直接引导同步
  const codeQ = normalizeCode(q);
  const unsyncedCode = CODE_RE.test(codeQ) && !tasks.some(t => syncCodeOf(t.id) === codeQ);

  const totalVol = Math.round(tasks.filter(t => t.status === 'success').reduce((a, t) => a + totalVolume(t), 0));
  const totalPack = tasks.reduce((a, t) => a + packSizeOf(t), 0);

  const allOn = shown.length > 0 && shown.every(t => picked.has(t.id));
  const someOn = shown.some(t => picked.has(t.id));
  const toggleAll = (v: boolean) => setPicked(v ? new Set(shown.map(t => t.id)) : new Set());
  const batchDownload = () => {
    const list = tasks.filter(t => picked.has(t.id));
    list.forEach(t => enqueue(t, 'all'));
    showToast(`已加入下载队列：${list.length} 个数据包`);
    setPicked(new Set());
    navigate('/downloads');
  };

  const chipBtn = (on: boolean, label: string, onClick: () => void) => (
    <button key={label} className={`chip ${on ? 'on' : ''}`} onClick={onClick}>{label}</button>
  );

  return (
    <div>
      {/* 概览 */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Stat label="已同步任务" value={tasks.length} unit="次" />
        <Stat label="累计测算体积" value={totalVol.toLocaleString()} unit="m³" sub="仅统计完成任务" />
        <Stat label="数据总量" value={fmtMb(totalPack).split(' ')[0]} unit={fmtMb(totalPack).split(' ')[1]} sub="点云 / 视频 / 图片 / 报告" />
      </div>

      {/* 工具栏 */}
      <Card pad={14} style={{ marginTop: 16 }}>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative" style={{ width: 300 }}>
            <span className="absolute" style={{ left: 11, top: 10, color: 'var(--text-tertiary)', display: 'inline-flex' }}><IconSearch size={14} /></span>
            <input className="input w-full" style={{ paddingLeft: 32 }} placeholder="搜索任务 / 同步码 / 航线 / 场景" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="flex items-center gap-1.5">
            {chipBtn(status === 'all', '全部', () => setStatus('all'))}
            {chipBtn(status === 'success', '完成', () => setStatus('success'))}
            {chipBtn(status === 'aborted', '中断', () => setStatus('aborted'))}
          </div>
          <span style={{ width: 1, height: 20, background: 'var(--border-subtle)' }} />
          <div className="flex flex-wrap items-center gap-1.5">
            {chipBtn(scene === 'all', '全部场景', () => setScene('all'))}
            {SCENES.map(sc => chipBtn(scene === sc.id, sc.name, () => setScene(sc.id)))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {picked.size > 0 && <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>已选 {picked.size} 个</span>}
            <Button small variant={picked.size ? 'primary' : 'secondary'} disabled={picked.size === 0} icon={<IconDownload size={13} />} onClick={batchDownload}>打包下载</Button>
          </div>
        </div>
      </Card>

      {unsyncedCode && (
        <div className="flex items-center gap-3 mt-3" style={{ padding: '11px 14px', borderRadius: 10, background: 'var(--brand-subtle-bg)', border: '1px solid var(--brand-border)' }}>
          <span style={{ color: 'var(--brand)', display: 'inline-flex' }}><IconLink size={15} /></span>
          <span style={{ fontSize: 13 }} className="flex-1"><span className="mono">{codeQ}</span> 尚未同步到网页端。</span>
          <Button small onClick={() => set({ syncModalOpen: true, syncPrefill: codeQ })}>同步</Button>
        </div>
      )}

      {/* 列表 */}
      <Card pad={0} style={{ marginTop: 16, overflow: 'hidden' }}>
        {shown.length === 0 ? (
          <EmptyState icon={<IconBox size={22} />} text={tasks.length === 0 ? '还没有同步任何任务' : '没有匹配的任务'}
            sub={tasks.length === 0 ? '在「同步数据」输入手机端复制的同步码，或一键同步全部' : '调整筛选条件试试'}
            actionText={tasks.length === 0 ? '去同步数据' : undefined} onAction={() => navigate('/sync')} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="dtable">
              <thead>
                <tr>
                  <th style={{ width: 36 }}><Check on={allOn} indeterminate={!allOn && someOn} onChange={toggleAll} /></th>
                  <th>巡检时间</th>
                  <th>任务 / 同步码</th>
                  <th>场景 · 航线</th>
                  <th>状态</th>
                  <th style={{ textAlign: 'right' }}>覆盖</th>
                  <th style={{ textAlign: 'right' }}>结果</th>
                  <th>异常</th>
                  <th style={{ width: 120 }}></th>
                </tr>
              </thead>
              <tbody>
                {shown.map(t => {
                  const issues = t.stacks.filter(s => s.issue).length;
                  const on = picked.has(t.id);
                  return (
                    <tr key={t.id} className={`row-link ${on ? 'row-on' : ''}`} onClick={() => navigate(`/tasks/${t.id}`)}>
                      <td><Check on={on} onChange={v => setPicked(p => { const n = new Set(p); v ? n.add(t.id) : n.delete(t.id); return n; })} /></td>
                      <td className="mono">{fmtDT(t.startedAt)}</td>
                      <td>
                        <div className="mono" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{t.id}</div>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{syncCodeOf(t.id)}</div>
                      </td>
                      <td style={{ minWidth: 200 }}>
                        <div style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{t.routeName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{sceneName(t)} · {t.operator}</div>
                      </td>
                      <td><StatusPill task={t} /></td>
                      <td className="mono" style={{ textAlign: 'right', color: t.coveragePct < 100 ? 'var(--warning)' : undefined }}>{t.coveragePct}%</td>
                      <td className="mono" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {isStacked(t) ? <>{totalCount(t).toLocaleString()} <span style={{ color: 'var(--text-tertiary)' }}>件</span></> : <>{totalVolume(t).toFixed(1)} <span style={{ color: 'var(--text-tertiary)' }}>m³</span></>}
                      </td>
                      <td>
                        {issues > 0 || t.status !== 'success'
                          ? <span className="inline-flex items-center gap-1" style={{ fontSize: 11.5, color: 'var(--warning)', whiteSpace: 'nowrap' }}><IconWarn size={12} />{t.status !== 'success' ? '任务' + (t.status === 'aborted' ? '中断' : '失败') : `${issues} 项`}</span>
                          : <span style={{ fontSize: 11.5, color: 'var(--text-placeholder)' }}>无</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="inline-flex items-center gap-1.5">
                          <Button small variant="secondary" onClick={e => { e.stopPropagation(); navigate(`/tasks/${t.id}?tab=report`); }}>报告</Button>
                          <Button small variant="secondary" icon={<IconDownload size={12} />} title="打包下载" onClick={e => { e.stopPropagation(); enqueue(t, 'all'); showToast('已加入下载队列'); }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-subtle)', fontSize: 11.5, color: 'var(--text-tertiary)' }}>
          共 {shown.length} 条 · 点击行查看详情
        </div>
      </Card>
    </div>
  );
}
