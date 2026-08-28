// 任务库：已接入任务的检索、筛选、批量下载
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { SCENES, ROUTES } from '../mock/routes';
import { deviceOf } from '../mock/history';
import { syncCodeOf, normalizeCode, CODE_RE } from '../data/sync';
import { packSizeOf } from '../data/process';
import { Button, Card, Stat, StatusPill, Check, EmptyState, Tag, IconSearch, IconDownload, IconBox, IconWarn, IconLink, fmtDT, fmtMb, totalVolume, totalCount, isStacked, hasIssue, daysAgo } from '../components/ui';
import type { Task } from '../types';

type Range = 'all' | '7' | '30';
type Sort = 'time' | 'volume' | 'coverage';

export function Tasks() {
  const navigate = useNavigate();
  const tasks = useStore(s => s.libraryTasks());
  const syncs = useStore(s => s.syncs);
  const enqueue = useStore(s => s.enqueueDownload);
  const showToast = useStore(s => s.showToast);
  const set = useStore(s => s.set);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | Task['status']>('all');
  const [scene, setScene] = useState<string>('all');
  const [cargo, setCargo] = useState<'all' | 'bulk' | 'stacked'>('all');
  const [range, setRange] = useState<Range>('all');
  const [issueOnly, setIssueOnly] = useState(false);
  const [sort, setSort] = useState<Sort>('time');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const sceneOf = (t: Task) => ROUTES.find(r => r.id === t.routeId)?.sceneId ?? '';
  const sceneName = (t: Task) => SCENES.find(s => s.id === sceneOf(t))?.name ?? '';

  const shown = useMemo(() => {
    const kw = q.trim().toLowerCase();
    // 参考日期：以目录中最新任务当天为「今天」（演示数据固定在 2026-07）
    const latest = tasks.reduce((a, t) => (t.startedAt > a ? t.startedAt : a), '');
    const ref = new Date(latest).getTime();
    return tasks
      .filter(t => {
        if (status !== 'all' && t.status !== status) return false;
        if (scene !== 'all' && sceneOf(t) !== scene) return false;
        if (cargo !== 'all' && (isStacked(t) ? 'stacked' : 'bulk') !== cargo) return false;
        if (issueOnly && !hasIssue(t)) return false;
        if (range !== 'all' && (ref - new Date(t.startedAt).getTime()) / 86400000 > Number(range)) return false;
        if (!kw) return true;
        const code = syncCodeOf(t.id).toLowerCase();
        return t.id.toLowerCase().includes(kw) || code.includes(kw.replace(/\s/g, '')) || t.routeName.toLowerCase().includes(kw)
          || sceneName(t).toLowerCase().includes(kw) || deviceOf(t).toLowerCase().includes(kw) || t.operator.toLowerCase().includes(kw)
          || t.stacks.some(s => (s.tagCode ?? '').toLowerCase().includes(kw) || s.name.toLowerCase().includes(kw));
      })
      .sort((a, b) => sort === 'time' ? b.startedAt.localeCompare(a.startedAt)
        : sort === 'volume' ? totalVolume(b) - totalVolume(a) : b.coveragePct - a.coveragePct);
  }, [tasks, q, status, scene, cargo, range, issueOnly, sort]);

  // 搜索框里粘了一个尚未接入的同步码：直接引导接入
  const codeQ = normalizeCode(q);
  const unsyncedCode = CODE_RE.test(codeQ) && !tasks.some(t => syncCodeOf(t.id) === codeQ);

  const monthCount = tasks.filter(t => t.startedAt.startsWith('2026-07')).length;
  const totalVol = Math.round(tasks.filter(t => t.status === 'success').reduce((a, t) => a + totalVolume(t), 0));
  const totalPack = tasks.reduce((a, t) => a + packSizeOf(t), 0);
  const incomplete = syncs.filter(s => !s.complete).length;

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
      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <Stat label="已接入任务" value={tasks.length} unit="次" sub={`本月 ${monthCount} 次巡检`} />
        <Stat label="累计测算体积" value={totalVol.toLocaleString()} unit="m³" sub="仅统计完成任务" />
        <Stat label="数据包总量" value={fmtMb(totalPack).split(' ')[0]} unit={fmtMb(totalPack).split(' ')[1]} sub="点云 / 视频 / 图片 / 报告" />
        <Stat label="附件不完整" value={incomplete} unit="个" sub={incomplete ? '详情页可查看缺失项' : '全部数据包校验通过'} tone={incomplete ? 'warning' : undefined} />
      </div>

      {/* 工具栏 */}
      <Card pad={14} style={{ marginTop: 16 }}>
        <div className="flex items-center gap-2.5">
          <div className="relative" style={{ width: 360 }}>
            <span className="absolute" style={{ left: 11, top: 10, color: 'var(--text-tertiary)', display: 'inline-flex' }}><IconSearch size={14} /></span>
            <input className="input w-full" style={{ paddingLeft: 32 }} placeholder="搜索同步码 / 任务编号 / 航线 / 场景 / 设备 / 操作员 / 标签编码" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="flex items-center gap-1.5 ml-2">
            {chipBtn(sort === 'time', '按时间', () => setSort('time'))}
            {chipBtn(sort === 'volume', '按体积', () => setSort('volume'))}
            {chipBtn(sort === 'coverage', '按覆盖度', () => setSort('coverage'))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {picked.size > 0 && <span className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>已选 {picked.size} 个</span>}
            <Button small variant={picked.size ? 'primary' : 'secondary'} disabled={picked.size === 0} icon={<IconDownload size={13} />} onClick={batchDownload}>打包下载</Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          <span className="dlabel mr-1" style={{ fontSize: 10.5 }}>状态</span>
          {chipBtn(status === 'all', '全部', () => setStatus('all'))}
          {chipBtn(status === 'success', '完成', () => setStatus('success'))}
          {chipBtn(status === 'aborted', '中断', () => setStatus('aborted'))}
          {chipBtn(status === 'failed', '失败', () => setStatus('failed'))}
          <span className="dlabel ml-3 mr-1" style={{ fontSize: 10.5 }}>场景</span>
          {chipBtn(scene === 'all', '全部', () => setScene('all'))}
          {SCENES.map(sc => chipBtn(scene === sc.id, sc.name, () => setScene(sc.id)))}
          <span className="dlabel ml-3 mr-1" style={{ fontSize: 10.5 }}>货物</span>
          {chipBtn(cargo === 'all', '全部', () => setCargo('all'))}
          {chipBtn(cargo === 'bulk', '散料堆体', () => setCargo('bulk'))}
          {chipBtn(cargo === 'stacked', '规则码垛', () => setCargo('stacked'))}
          <span className="dlabel ml-3 mr-1" style={{ fontSize: 10.5 }}>时间</span>
          {chipBtn(range === 'all', '全部', () => setRange('all'))}
          {chipBtn(range === '7', '近 7 天', () => setRange('7'))}
          {chipBtn(range === '30', '近 30 天', () => setRange('30'))}
          <span className="ml-3" />
          {chipBtn(issueOnly, '仅看有异常', () => setIssueOnly(v => !v))}
        </div>
      </Card>

      {unsyncedCode && (
        <div className="flex items-center gap-3 mt-3" style={{ padding: '11px 14px', borderRadius: 10, background: 'var(--brand-subtle-bg)', border: '1px solid var(--brand-border)' }}>
          <span style={{ color: 'var(--brand)', display: 'inline-flex' }}><IconLink size={15} /></span>
          <span style={{ fontSize: 13 }} className="flex-1">
            <span className="mono">{codeQ}</span> 尚未接入网页端，接入后即可查看与下载。
          </span>
          <Button small onClick={() => set({ syncModalOpen: true, syncPrefill: codeQ })}>接入该同步码</Button>
        </div>
      )}

      {/* 列表 */}
      <Card pad={0} style={{ marginTop: 16, overflow: 'hidden' }}>
        {shown.length === 0 ? (
          <EmptyState icon={<IconBox size={22} />} text={tasks.length === 0 ? '还没有接入任何任务' : '没有匹配的任务'}
            sub={tasks.length === 0 ? '在手机端复制同步码后，点击左侧「接入同步码」' : '调整筛选条件，或检查同步码是否已接入'}
            actionText={tasks.length === 0 ? '接入同步码' : undefined} onAction={() => set({ syncModalOpen: true })} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="dtable">
              <thead>
                <tr>
                  <th style={{ width: 36 }}><Check on={allOn} indeterminate={!allOn && someOn} onChange={toggleAll} /></th>
                  <th>巡检时间</th>
                  <th>任务 / 同步码</th>
                  <th>场景 · 航线</th>
                  <th>设备</th>
                  <th>状态</th>
                  <th style={{ textAlign: 'right' }}>覆盖</th>
                  <th style={{ textAlign: 'right' }}>结果</th>
                  <th style={{ textAlign: 'right' }}>体积误差</th>
                  <th>异常</th>
                  <th>接入</th>
                  <th style={{ width: 120 }}></th>
                </tr>
              </thead>
              <tbody>
                {shown.map(t => {
                  const sync = syncs.find(s => s.taskId === t.id);
                  const issues = t.stacks.filter(s => s.issue).length;
                  const on = picked.has(t.id);
                  return (
                    <tr key={t.id} className={`row-link ${on ? 'row-on' : ''}`} onClick={() => navigate(`/tasks/${t.id}`)}>
                      <td><Check on={on} onChange={v => setPicked(p => { const n = new Set(p); v ? n.add(t.id) : n.delete(t.id); return n; })} /></td>
                      <td className="mono" style={{ whiteSpace: 'nowrap' }}>{fmtDT(t.startedAt)}</td>
                      <td>
                        <div className="mono" style={{ fontSize: 12 }}>{t.id}</div>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{syncCodeOf(t.id)}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{t.routeName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{sceneName(t)} · {t.operator}</div>
                      </td>
                      <td className="mono">{deviceOf(t)}</td>
                      <td><StatusPill task={t} /></td>
                      <td className="mono" style={{ textAlign: 'right', color: t.coveragePct < 100 ? 'var(--warning)' : undefined }}>{t.coveragePct}%</td>
                      <td className="mono" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {isStacked(t) ? <>{totalCount(t).toLocaleString()} <span style={{ color: 'var(--text-tertiary)' }}>件</span></> : <>{totalVolume(t).toFixed(1)} <span style={{ color: 'var(--text-tertiary)' }}>m³</span></>}
                        <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{t.stacks.length} 个{isStacked(t) ? '货位' : '堆体'}</div>
                      </td>
                      <td className="mono" style={{ textAlign: 'right', color: t.volumeErrPct > 4 ? 'var(--warning)' : undefined }}>±{t.volumeErrPct.toFixed(1)}%</td>
                      <td>
                        {issues > 0 || t.status !== 'success'
                          ? <span className="inline-flex items-center gap-1" style={{ fontSize: 11.5, color: 'var(--warning)' }}><IconWarn size={12} />{t.status !== 'success' ? '任务' + (t.status === 'aborted' ? '中断' : '失败') : `${issues} 项`}</span>
                          : <span style={{ fontSize: 11.5, color: 'var(--text-placeholder)' }}>无</span>}
                      </td>
                      <td>
                        <div className="mono" style={{ fontSize: 11 }}>{sync ? fmtDT(sync.syncedAt).slice(5) : ''}</div>
                        {sync && !sync.complete ? <Tag>附件缺失</Tag> : <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{sync && daysAgo(sync.syncedAt) >= 0 ? fmtMb(sync.sizeMb) : ''}</span>}
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
        <div className="flex items-center justify-between" style={{ padding: '10px 14px', borderTop: '1px solid var(--border-subtle)', fontSize: 11.5, color: 'var(--text-tertiary)' }}>
          <span>共 {shown.length} 条 · 点击行查看详情</span>
          <span>数据由手机端经同步码接入，与机载端原始记录一致</span>
        </div>
      </Card>
    </div>
  );
}
