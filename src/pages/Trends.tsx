// 库存趋势：同一航线多次巡检的体积变化，按堆体拆分，给出相邻差值与异常提示
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { ROUTES, SCENES } from '../mock/routes';
import { LineChart, DiffBars, PALETTE } from '../components/Charts';
import { Card, Section, Stat, EmptyState, StatusPill, IconTrend, IconWarn, fmtDate, totalVolume, isStacked, totalCount } from '../components/ui';

export function Trends() {
  const navigate = useNavigate();
  const tasks = useStore(s => s.libraryTasks());
  const density = 0.75;

  // 只展示有 2 次以上完成记录的航线
  const groups = useMemo(() => {
    const m = new Map<string, typeof tasks>();
    tasks.filter(t => t.status === 'success').forEach(t => m.set(t.routeId, [...(m.get(t.routeId) ?? []), t]));
    return [...m.entries()].filter(([, list]) => list.length >= 2)
      .map(([routeId, list]) => ({ routeId, list: list.sort((a, b) => a.startedAt.localeCompare(b.startedAt)) }))
      .sort((a, b) => b.list.length - a.list.length);
  }, [tasks]);
  const [routeId, setRouteId] = useState<string>(groups[0]?.routeId ?? '');
  const group = groups.find(g => g.routeId === routeId) ?? groups[0];

  if (!group) return <EmptyState icon={<IconTrend size={22} />} text="暂无可比对的航线" sub="同一航线接入 2 次以上完成的巡检后，这里会展示体积变化趋势" />;

  const route = ROUTES.find(r => r.id === group.routeId);
  const scene = SCENES.find(s => s.id === route?.sceneId);
  const runs = group.list;
  const stacked = isStacked(runs[0]);
  const stackIds = [...new Set(runs.flatMap(t => t.stacks.map(s => s.id)))];
  const xOf = (t: { startedAt: string }) => new Date(t.startedAt).getTime();
  const series = [
    { name: '合计', color: '#1B1F27', points: runs.map(t => ({ x: xOf(t), y: totalVolume(t) })) },
    ...stackIds.map((id, i) => ({
      name: runs[0].stacks.find(s => s.id === id)?.name ?? id, color: PALETTE[i % PALETTE.length],
      points: runs.filter(t => t.stacks.some(s => s.id === id)).map(t => ({ x: xOf(t), y: t.stacks.find(s => s.id === id)!.volumeM3 })),
    })),
  ];
  const first = totalVolume(runs[0]), last = totalVolume(runs[runs.length - 1]);
  const delta = Math.round((last - first) * 10) / 10;
  const diffs = runs.slice(1).map((t, i) => ({ label: fmtDate(t.startedAt).slice(5), value: Math.round((totalVolume(t) - totalVolume(runs[i])) * 10) / 10 }));
  const abnormal = runs.slice(1).map((t, i) => {
    const prev = runs[i];
    return t.stacks.map(s => {
      const p = prev.stacks.find(x => x.id === s.id);
      if (!p) return null;
      const pct = ((s.volumeM3 - p.volumeM3) / p.volumeM3) * 100;
      return Math.abs(pct) >= 12 ? { task: t, stack: s, pct } : null;
    }).filter(Boolean);
  }).flat() as { task: typeof runs[number]; stack: typeof runs[number]['stacks'][number]; pct: number }[];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="dlabel mr-1" style={{ fontSize: 10.5 }}>航线</span>
        {groups.map(g => {
          const r = ROUTES.find(x => x.id === g.routeId);
          return <button key={g.routeId} className={`chip ${g.routeId === group.routeId ? 'on' : ''}`} onClick={() => setRouteId(g.routeId)}>{r?.name ?? g.routeId} · {g.list.length} 次</button>;
        })}
      </div>

      <div className="grid mt-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <Stat label="当前库存（最近一次）" value={last.toFixed(1)} unit="m³" sub={stacked ? `${totalCount(runs[runs.length - 1]).toLocaleString()} 件` : `折算 ${(last * density).toFixed(1)} t（容重 ${density}）`} />
        <Stat label={`较首次（${fmtDate(runs[0].startedAt).slice(5)}）`} value={`${delta >= 0 ? '+' : ''}${delta.toFixed(1)}`} unit="m³" sub={`${((delta / first) * 100).toFixed(1)}%`} tone={Math.abs(delta / first) > 0.1 ? 'warning' : undefined} />
        <Stat label="巡检次数" value={runs.length} unit="次" sub={`${fmtDate(runs[0].startedAt)} 至 ${fmtDate(runs[runs.length - 1].startedAt)}`} />
        <Stat label="异常变化" value={abnormal.length} unit="项" sub="相邻两次单堆体变化 ≥ 12%" tone={abnormal.length ? 'warning' : undefined} />
      </div>

      <div className="grid mt-4" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: 16 }}>
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{route?.name} · {route?.scanTags.join('/')}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{scene?.name} · 各{stacked ? '货位' : '堆体'}体积随巡检时间变化（m³）</div>
            </div>
          </div>
          <div className="mt-3">
            <LineChart series={series} height={260} yUnit=" m³" xFmt={v => fmtDate(new Date(v).toISOString()).slice(5)} yFmt={v => v.toFixed(0)} xTicks={runs.map(xOf)} />
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600 }}>相邻两次差值</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>正值为入库，负值为出库（m³）</div>
          <div className="mt-4"><DiffBars items={diffs} height={150} /></div>
          <div className="mt-4 leading-[1.6]" style={{ fontSize: 11.5, color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
            体积差值受两次测算各自 ±{Math.max(...runs.map(t => t.volumeErrPct)).toFixed(1)}% 误差影响，小于误差带的变化不应作为出入库依据。
          </div>
        </Card>
      </div>

      {abnormal.length > 0 && (
        <Section title="异常变化" style={{ marginTop: 20 }}>
          <Card pad={0} style={{ overflow: 'hidden' }}>
            {abnormal.map((a, i) => (
              <button key={i} className="w-full flex items-center gap-3 text-left pressable" style={{ padding: '11px 16px', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none', cursor: 'pointer' }} onClick={() => navigate(`/tasks/${a.task.id}?tab=detail`)}>
                <span style={{ color: 'var(--warning)', display: 'inline-flex' }}><IconWarn size={14} /></span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{a.stack.name}</span>
                <span className="mono" style={{ fontSize: 12, color: a.pct > 0 ? 'var(--brand-subtle-text)' : 'var(--sig3d-ink)' }}>{a.pct > 0 ? '+' : ''}{a.pct.toFixed(1)}%</span>
                <span className="flex-1" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{fmtDate(a.task.startedAt)} 较上次{a.pct > 0 ? '增加' : '减少'}，超出误差带，建议核对出入库记录或安排补扫复核</span>
              </button>
            ))}
          </Card>
        </Section>
      )}

      <Section title="巡检记录" style={{ marginTop: 20 }}>
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <table className="dtable">
            <thead>
              <tr>
                <th>巡检时间</th><th>任务</th><th>状态</th>
                {stackIds.map(id => <th key={id} style={{ textAlign: 'right' }}>{runs[0].stacks.find(s => s.id === id)?.name ?? id}</th>)}
                <th style={{ textAlign: 'right' }}>合计 m³</th><th style={{ textAlign: 'right' }}>较上次</th><th style={{ textAlign: 'right' }}>误差</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((t, i) => {
                const d = i === 0 ? null : Math.round((totalVolume(t) - totalVolume(runs[i - 1])) * 10) / 10;
                return (
                  <tr key={t.id} className="row-link" onClick={() => navigate(`/tasks/${t.id}`)}>
                    <td className="mono">{fmtDate(t.startedAt)}</td>
                    <td className="mono" style={{ fontSize: 11.5 }}>{t.id}</td>
                    <td><StatusPill task={t} /></td>
                    {stackIds.map(id => { const s = t.stacks.find(x => x.id === id); return <td key={id} className="mono" style={{ textAlign: 'right' }}>{s ? s.volumeM3.toFixed(1) : '—'}</td>; })}
                    <td className="mono" style={{ textAlign: 'right', fontWeight: 500 }}>{totalVolume(t).toFixed(1)}</td>
                    <td className="mono" style={{ textAlign: 'right', color: d === null ? 'var(--text-placeholder)' : d >= 0 ? 'var(--brand-subtle-text)' : 'var(--sig3d-ink)' }}>{d === null ? '—' : `${d >= 0 ? '+' : ''}${d.toFixed(1)}`}</td>
                    <td className="mono" style={{ textAlign: 'right', color: 'var(--text-tertiary)' }}>±{t.volumeErrPct.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </Section>
    </div>
  );
}
