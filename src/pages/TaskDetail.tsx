// 任务详情：概览 / 三维成果 / 飞行过程 / 明细 / 报告 / 附件
import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useStore } from '../store';
import { ROUTES, SCENES } from '../mock/routes';
import { deviceOf } from '../mock/history';
import { syncCodeOf } from '../data/sync';
import { processOf, attachmentsOf, packSizeOf, photoCountOf } from '../data/process';
import { Viewer3D } from '../components/Viewer3D';
import { LineChart } from '../components/Charts';
import {
  Button, Card, Section, Stat, StatusPill, ConfPill, Pill, Tag, Check, CodeChip, EmptyState,
  IconChevronLeft, IconDownload, IconPrint, IconDoc, IconWarn, IconCheck, IconCamera, IconVideo, IconBox, IconPin,
  fmtDT, fmtDate, fmtTime, fmtDuration, fmtMb, totalVolume, totalCount, isStacked, TAG_NAME, ISSUE_TEXT, STATUS_TEXT,
} from '../components/ui';
import type { Task, Attachment } from '../types';

type Tab = 'overview' | 'model' | 'process' | 'report' | 'files';
const TABS: [Tab, string][] = [['overview', '概览'], ['model', '三维成果'], ['process', '飞行过程'], ['report', '报告'], ['files', '附件下载']];
const DENSITY = 0.75;
const RETURN_TEXT: Record<Task['returnTrigger'], string> = {
  route_complete: '航线执行完成', user: '操作员手动返航', auto_timeout: '悬停超时自动返航', safety: '定位丢失原地降落', rc_override: '遥控器接管',
};
const KIND_ICON: Record<Attachment['kind'], React.ReactNode> = {
  pcd: <IconBox size={15} />, json: <IconDoc size={15} />, pdf: <IconDoc size={15} />, mp4: <IconVideo size={15} />, zip: <IconCamera size={15} />, csv: <IconDoc size={15} />,
};

function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

export function TaskDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get('tab') as Tab) || 'overview';
  const setTab = (t: Tab) => setSp(t === 'overview' ? {} : { tab: t });
  const task = useStore(s => s.taskById(id));
  const sync = useStore(s => s.syncOf(id));
  const enqueue = useStore(s => s.enqueueDownload);
  const showToast = useStore(s => s.showToast);
  const set = useStore(s => s.set);
  const [selected, setSelected] = useState<number | null>(null);
  const [pickedFiles, setPickedFiles] = useState<Set<string>>(new Set());
  const route = task ? ROUTES.find(r => r.id === task.routeId) : undefined;
  // 钩子保持在条件返回之前
  const procMemo = useMemo(() => (task ? processOf(task, route) : null), [task, route]);

  if (!task || !sync || !procMemo) {
    return (
      <EmptyState icon={<IconWarn size={22} />} text="该任务尚未同步" sub={`任务 ${id} 还没有同步到网页端。请在手机端复制该次巡检的同步码后同步。`} actionText="同步数据" onAction={() => set({ syncModalOpen: true })} />
    );
  }

  const scene = SCENES.find(s => s.id === route?.sceneId);
  const proc = procMemo;
  const atts = attachmentsOf(task);
  const stacked = isStacked(task);
  const unit = stacked ? '货位' : '堆体';
  const vol = totalVolume(task);
  const code = syncCodeOf(task.id);
  const missing = new Set(sync.missing);
  const issues = task.stacks.filter(s => s.issue);

  const dl = (keys: string[] | 'all') => {
    enqueue(task, keys);
    // JSON 类附件直接落一份真实文件，便于演示
    const jsonKeys = (keys === 'all' ? [] : keys).filter(k => ['volume', 'inventory', 'events'].includes(k));
    jsonKeys.forEach(k => {
      const att = atts.find(a => a.key === k)!;
      downloadJson(att.name, k === 'events' ? proc.events : k === 'volume' ? { taskId: task.id, totalVolumeM3: vol, stacks: task.stacks } : { taskId: task.id, totalCount: totalCount(task), stacks: task.stacks.map(s => ({ id: s.id, name: s.name, tagType: s.tagType, tagCode: s.tagCode, layerCount: s.layerCount, perLayerCount: s.perLayerCount, totalCount: s.totalCount })) });
    });
    showToast(keys === 'all' ? '已开始下载完整数据包' : `已开始下载 ${keys.length} 个文件`);
  };

  return (
    <div>
      {/* 头部 */}
      <div className="no-print flex items-start gap-4">
        <button className="flex items-center justify-center pressable shrink-0" style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border-default)', background: 'var(--surface-1)', color: 'var(--text-secondary)', cursor: 'pointer', marginTop: 2 }} onClick={() => navigate('/tasks')} aria-label="返回任务库"><IconChevronLeft size={15} /></button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <span style={{ fontSize: 20, fontWeight: 600 }}>{task.routeName}</span>
            <StatusPill task={task} />
            {task.coveragePct < 100 && <Pill tone="mid">覆盖 {task.coveragePct}%</Pill>}
            {!sync.complete && <Pill tone="mid">附件缺失</Pill>}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 mono" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            <span>{task.id}</span>
            <span>{fmtDT(task.startedAt)}</span>
            <span className="inline-flex items-center gap-1"><IconPin size={11} />{scene?.name}</span>
            <span>{deviceOf(task)}</span>
            <span>{task.operator}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CodeChip code={code} />
          <Button variant="secondary" icon={<IconDoc size={13} />} onClick={() => setTab('report')}>报告</Button>
          <Button icon={<IconDownload size={13} />} onClick={() => dl('all')}>下载数据包 · {fmtMb(packSizeOf(task))}</Button>
        </div>
      </div>

      <div className="no-print flex mt-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        {TABS.map(([k, n]) => <button key={k} className={`ptab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{n}</button>)}
      </div>

      {/* 概览 */}
      {tab === 'overview' && (
        <div className="mt-5">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(172px, 1fr))', gap: 12 }}>
            <Stat label={stacked ? '合计件数' : '合计体积'} value={stacked ? totalCount(task).toLocaleString() : vol.toFixed(1)} unit={stacked ? '件' : 'm³'} sub={stacked ? `${vol.toFixed(1)} m³ · ${task.stacks.length} 个货位` : `折算 ${(vol * DENSITY).toFixed(1)} t · ${task.stacks.length} 个堆体`} />
            <Stat label="覆盖度" value={task.coveragePct} unit="%" sub={`完成航点 ${task.waypointDone}/${task.waypointTotal}`} tone={task.coveragePct < 100 ? 'warning' : undefined} />
            <Stat label="飞行时长" value={fmtDuration(task.durationSec)} sub={`轨迹 ${task.trackLengthM.toFixed(0)} m · 均速 ${task.avgSpeedMs} m/s`} />
            <Stat label="处理状态" value="完成" sub={`处理耗时 ${task.volumeCalcSec}s · 数据包 ${fmtMb(packSizeOf(task))}`} />
          </div>

          <div className="grid mt-4" style={{ gridTemplateColumns: 'minmax(0, 1.6fr) minmax(320px, 1fr)', gap: 16 }}>
            <div>
              <Viewer3D task={task} route={route} height={380} selected={selected} onSelect={setSelected} />
              <div className="mt-1.5 flex items-center justify-between" style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                <span>稀疏点云（{fmtMb(atts[0].sizeMb)}）在线预览；完整点云见附件</span>
                <button className="pressable" style={{ color: 'var(--text-link)', cursor: 'pointer' }} onClick={() => setTab('model')}>放大查看</button>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <Section title="同步信息">
                <Card pad={0} style={{ overflow: 'hidden' }}>
                  {[
                    ['同步码', <span className="mono">{code}</span>],
                    ['来源设备', <span className="mono">{sync.deviceId}</span>],
                    ['同步时间', <span className="mono">{fmtDT(sync.syncedAt)}</span>],
                    ['数据包', <span className="mono">{fmtMb(sync.sizeMb)} · {atts.length} 个附件</span>],
                    ['完整性', sync.complete ? <span className="inline-flex items-center gap-1" style={{ color: 'var(--success)' }}><IconCheck size={12} />校验通过</span> : <span className="inline-flex items-center gap-1" style={{ color: 'var(--warning)' }}><IconWarn size={12} />缺 {sync.missing.length} 项</span>],
                  ].map(([k, v], i) => (
                    <div key={i} className="flex items-center gap-3" style={{ padding: '8px 14px', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none', fontSize: 12 }}>
                      <span style={{ width: 64, color: 'var(--text-tertiary)' }}>{k}</span><span className="flex-1 min-w-0">{v}</span>
                    </div>
                  ))}
                </Card>
              </Section>
            </div>
          </div>
        </div>
      )}

      {/* 三维成果 */}
      {tab === 'model' && (
        <div className="grid mt-5" style={{ gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 16 }}>
          <Viewer3D task={task} route={route} height={620} selected={selected} onSelect={setSelected} showRoute />
          <div className="flex flex-col gap-3">
            <Card pad={0} style={{ overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', fontSize: 12.5, fontWeight: 500, borderBottom: '1px solid var(--border-subtle)' }}>{unit} · 点击定位</div>
              {task.stacks.map((s, i) => (
                <button key={s.id} className="w-full text-left" style={{ padding: '10px 14px', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none', background: selected === i ? 'var(--brand-subtle-bg)' : 'transparent', cursor: 'pointer' }} onClick={() => setSelected(selected === i ? null : i)}>
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</span>
                    <span className="mono" style={{ fontSize: 13 }}>{s.volumeM3.toFixed(1)} m³</span>
                  </div>
                  <div className="mt-1" style={{ fontSize: 11, color: s.issue ? 'var(--warning)' : 'var(--text-tertiary)' }}>
                    {s.position} · 覆盖 {s.surfaceCoverPct}%{s.issue ? ` · ${ISSUE_TEXT[s.issue]}` : ''}
                  </div>
                </button>
              ))}
            </Card>
            <Card pad={14}>
              <div className="dlabel">数据质量</div>
              {[['轨迹完整度', `${task.trackCompletePct}%`], ['稀疏点云', fmtMb(atts[0].sizeMb)], ['完整点云', fmtMb(task.cloudSizeMb)]].map(([k, v]) => (
                <div key={k} className="flex justify-between mt-2" style={{ fontSize: 12 }}><span style={{ color: 'var(--text-tertiary)' }}>{k}</span><span className="mono">{v}</span></div>
              ))}
            </Card>
            <Button variant="secondary" icon={<IconDownload size={13} />} onClick={() => dl(['model'])}>下载点云 PCD</Button>
          </div>
        </div>
      )}

      {/* 飞行过程 */}
      {tab === 'process' && (
        <div className="mt-5">
          <div className="grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            <Stat label="起飞" value={fmtTime(task.startedAt)} sub={`现场确认 ${fmtTime(task.siteAckAt)}`} />
            <Stat label="降落" value={fmtTime(task.landedAt)} sub={`时长 ${fmtDuration(task.durationSec)}`} />
            <Stat label="航点" value={`${task.waypointDone}/${task.waypointTotal}`} sub={`拍照点 ${proc.waypoints.filter(w => w.photo).length} 个`} tone={task.waypointDone < task.waypointTotal ? 'warning' : undefined} />
            <Stat label="返航触发" value={RETURN_TEXT[task.returnTrigger]} sub={task.returnTrigger === 'route_complete' ? '沿原航线返航' : '任务提前结束'} tone={task.returnTrigger !== 'route_complete' ? 'warning' : undefined} />
            <Stat label="电量消耗" value={`${(proc.telemetry[0].battery - proc.telemetry[proc.telemetry.length - 1].battery).toFixed(0)}`} unit="%" sub={`${proc.telemetry[0].battery.toFixed(0)}% → ${proc.telemetry[proc.telemetry.length - 1].battery.toFixed(0)}%`} />
          </div>

          <div className="grid mt-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {([
              { name: '电量', unit: '%', key: 'battery' as const, color: '#4C6BC0', min: 0, max: 100 },
              { name: '速度', unit: ' m/s', key: 'speed' as const, color: '#E8792B', min: 0, max: undefined },
              { name: '高度', unit: ' m', key: 'alt' as const, color: '#1FA971', min: 0, max: undefined },
            ]).map(c => (
              <Card key={c.key} pad={14}>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{c.name}</div>
                <div className="mt-2">
                  <LineChart
                    series={[{ name: c.name, color: c.color, points: proc.telemetry.map(p => ({ x: p.t, y: p[c.key] })) }]}
                    height={170} yUnit={c.unit} yMin={c.min} yMax={c.max} area
                    xFmt={v => `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}`}
                    yFmt={v => c.key === 'battery' ? v.toFixed(0) : v.toFixed(1)}
                    markers={proc.events.filter(e => e.type === 'hover_obstacle' || e.type === 'return_start').map(e => {
                      const [h, m, s] = e.time.split(':').map(Number);
                      const [h0, m0, s0] = fmtTime(task.startedAt).split(':').map(Number);
                      return { x: (h * 3600 + m * 60 + s) - (h0 * 3600 + m0 * 60 + s0), label: e.type === 'hover_obstacle' ? '停障' : '返航', tone: e.type === 'hover_obstacle' ? 'warn' as const : 'info' as const };
                    })}
                  />
                </div>
              </Card>
            ))}
          </div>

          <div className="grid mt-4" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) 280px', gap: 16 }}>
            <Section title="航点时间线">
              <Card pad={0} style={{ overflow: 'hidden', maxHeight: 420, overflowY: 'auto' }}>
                <table className="dtable">
                  <thead><tr><th>航点</th><th>到达</th><th>拍照</th><th style={{ textAlign: 'right' }}>悬停</th></tr></thead>
                  <tbody>
                    {proc.waypoints.map(w => (
                      <tr key={w.idx}>
                        <td className="mono">{w.idx}</td>
                        <td className="mono">{w.time}</td>
                        <td>{w.photo ? <span className="inline-flex items-center gap-1" style={{ color: 'var(--brand-subtle-text)', fontSize: 11.5 }}><IconCamera size={12} />拍照</span> : <span style={{ color: 'var(--text-placeholder)', fontSize: 11.5 }}>—</span>}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{w.dwellS ? `${w.dwellS}s` : '—'}</td>
                      </tr>
                    ))}
                    {task.waypointDone < task.waypointTotal && (
                      <tr><td colSpan={4} style={{ color: 'var(--warning)', fontSize: 11.5 }}>航点 {task.waypointDone + 1}–{task.waypointTotal} 未执行（{RETURN_TEXT[task.returnTrigger]}）</td></tr>
                    )}
                  </tbody>
                </table>
              </Card>
            </Section>
            <Section title="飞行事件">
              <Card pad={0} style={{ overflow: 'hidden', maxHeight: 420, overflowY: 'auto' }}>
                {proc.events.map((e, i) => {
                  const warn = e.type === 'hover_obstacle' || e.type === 'hover_loc' || e.type === 'fault' || (e.type === 'return_start' && task.returnTrigger !== 'route_complete');
                  return (
                    <div key={i} className="flex items-start gap-3" style={{ padding: '8px 14px', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
                      <span className="mono shrink-0" style={{ fontSize: 11.5, color: 'var(--text-tertiary)', width: 58 }}>{e.time}</span>
                      <span className="rounded-full shrink-0" style={{ width: 6, height: 6, marginTop: 6, background: warn ? 'var(--warning)' : e.type === 'takeoff' || e.type === 'landed' ? 'var(--brand)' : 'var(--border-strong)' }} />
                      <span style={{ fontSize: 12.5, color: warn ? 'var(--warning)' : 'var(--text-primary)' }}>{e.label}</span>
                    </div>
                  );
                })}
              </Card>
            </Section>
            <Section title="机载数据处理">
              <Card pad={0} style={{ overflow: 'hidden' }}>
                {proc.stages.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-3" style={{ padding: '9px 14px', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
                    <span style={{ color: 'var(--success)', display: 'inline-flex' }}><IconCheck size={13} /></span>
                    <span className="flex-1" style={{ fontSize: 12.5 }}>{s.name}</span>
                    <span className="mono" style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>{s.sec}s</span>
                  </div>
                ))}
                <div style={{ padding: '9px 14px', borderTop: '1px solid var(--border-subtle)', fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                  合计 {task.volumeCalcSec}s · 处理结果状态：成功
                </div>
              </Card>
              <div className="mt-3 flex gap-2">
                <Button small variant="secondary" icon={<IconDownload size={12} />} onClick={() => dl(['telemetry'])}>遥测 CSV</Button>
                <Button small variant="secondary" icon={<IconDownload size={12} />} onClick={() => dl(['events'])}>事件 JSON</Button>
              </div>
            </Section>
          </div>
        </div>
      )}

      {/* 明细（并入概览页，行点击与三维联动） */}
      {tab === 'overview' && (
        <div className="mt-6">
          <div className="dlabel mb-2.5" style={{ fontSize: 11 }}>{unit}明细</div>
          {issues.length > 0 && (
            <div className="flex items-center gap-2 mb-3" style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--warning-bg)', color: 'var(--warning)', fontSize: 12.5 }}>
              <IconWarn size={14} />{issues.length} 个{unit}存在异常标注，相关体积结果建议复核后再用于账务。
            </div>
          )}
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <table className="dtable">
              <thead>
                <tr>
                  <th>{unit}</th><th>位置</th><th>类型</th>
                  <th style={{ textAlign: 'right' }}>体积 m³</th>
                  {stacked && <><th style={{ textAlign: 'right' }}>分层</th><th style={{ textAlign: 'right' }}>件数</th><th>标签识别</th></>}
                  <th style={{ textAlign: 'right' }}>表面覆盖</th><th>异常</th>
                </tr>
              </thead>
              <tbody>
                {task.stacks.map((s, i) => (
                  <tr key={s.id} className={`row-link ${selected === i ? 'row-on' : ''}`} onClick={() => setSelected(selected === i ? null : i)}>
                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                    <td>{s.position}</td>
                    <td>{s.cargoType === 'bulk' ? '散料堆体' : '规则码垛'}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{s.volumeM3.toFixed(1)}</td>
                    {stacked && <>
                      <td className="mono" style={{ textAlign: 'right' }}>{s.layerCount} × {s.perLayerCount}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 500 }}>{s.totalCount?.toLocaleString()}</td>
                      <td>{s.tagType ? (s.tagCode ? <span className="mono" style={{ fontSize: 11.5 }}>{TAG_NAME[s.tagType]} {s.tagCode}</span> : <span style={{ fontSize: 11.5, color: 'var(--warning)' }}>{TAG_NAME[s.tagType]}标签未识别</span>) : '—'}</td>
                    </>}
                    <td className="mono" style={{ textAlign: 'right' }}>{s.surfaceCoverPct}%</td>
                    <td>{s.issue ? <span className="inline-flex items-center gap-1" style={{ fontSize: 11.5, color: 'var(--warning)' }}><IconWarn size={12} />{ISSUE_TEXT[s.issue]}</span> : <span style={{ color: 'var(--text-placeholder)', fontSize: 11.5 }}>无</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="mt-3 flex gap-2">
            <Button small variant="secondary" icon={<IconDownload size={12} />} onClick={() => dl(['volume'])}>体积结果 JSON</Button>
            {stacked && <Button small variant="secondary" icon={<IconDownload size={12} />} onClick={() => dl(['inventory'])}>盘点汇总 JSON</Button>}
          </div>
        </div>
      )}

      {/* 报告 */}
      {tab === 'report' && (
        <div className="mt-5">
          <div className="no-print flex items-center justify-between mb-3">
            <span style={{ fontSize: 12.5, color: 'var(--text-tertiary)' }}>报告内容与手机端生成的 PDF 一致；打印时仅输出报告纸面</span>
            <div className="flex gap-2">
              <Button variant="secondary" icon={<IconPrint size={13} />} onClick={() => window.print()}>打印</Button>
              <Button icon={<IconDownload size={13} />} onClick={() => { dl(['report']); window.print(); }}>下载 PDF</Button>
            </div>
          </div>
          <div className="print-sheet" style={{ width: 794, margin: '0 auto', background: '#FFFFFF', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-card)', padding: '56px 64px', color: '#1B1F27' }}>
            <div className="flex items-start justify-between">
              <div>
                <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '.04em' }}>仓储无人机巡检报告</div>
                <div className="mono mt-1" style={{ fontSize: 11.5, color: '#737E90' }}>{task.id} · 同步码 {code}</div>
              </div>
              <div className="text-right" style={{ fontSize: 11, color: '#737E90' }}>
                <div>报告生成 {fmtDT(sync.syncedAt)}</div>
                <div>来源设备 {deviceOf(task)}</div>
              </div>
            </div>
            <div style={{ borderTop: '1.5px solid #1B1F27', margin: '18px 0 14px' }} />
            <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', columnGap: 32, rowGap: 6 }}>
              {[
                ['巡检时间', fmtDT(task.startedAt)], ['场景 / 航线', `${scene?.name} · ${task.routeName}`],
                ['任务状态', STATUS_TEXT[task.status]], ['操作员', task.operator],
                ['覆盖度', `${task.coveragePct}%（航点 ${task.waypointDone}/${task.waypointTotal}）`], ['飞行时长', fmtDuration(task.durationSec)],
                ['处理状态', '机载处理完成'], ['返航触发', RETURN_TEXT[task.returnTrigger]],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between" style={{ fontSize: 12, padding: '3px 0', borderBottom: '1px solid rgba(16,24,40,.07)' }}><span style={{ color: '#737E90' }}>{k}</span><span className="mono">{v}</span></div>
              ))}
            </div>

            <div className="mt-7" style={{ fontSize: 13.5, fontWeight: 600 }}>一、测算合计</div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="mono" style={{ fontSize: 36, lineHeight: 1 }}>{stacked ? totalCount(task).toLocaleString() : vol.toFixed(1)}</span>
              <span className="mono" style={{ fontSize: 13, color: '#5A6272' }}>{stacked ? '件' : 'm³'}</span>
              <span className="mono ml-4" style={{ fontSize: 13, color: '#5A6272' }}>{stacked ? `体积 ${vol.toFixed(1)} m³` : `按容重 ${DENSITY} t/m³ 折算 ${(vol * DENSITY).toFixed(1)} t`} · {task.stacks.length} 个{unit}</span>
            </div>

            <div className="mt-6" style={{ fontSize: 13.5, fontWeight: 600 }}>二、{unit}明细</div>
            <table className="mt-2" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead><tr style={{ borderBottom: '1px solid #1B1F27' }}>
                {[unit, '位置', '体积 m³', stacked ? '件数' : '覆盖', ...(stacked ? ['标签'] : []), '异常'].map(h => <th key={h} style={{ textAlign: 'left', padding: '5px 4px', fontWeight: 500 }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {task.stacks.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid rgba(16,24,40,.09)' }}>
                    <td style={{ padding: '6px 4px' }}>{s.name}</td>
                    <td style={{ padding: '6px 4px' }}>{s.position}</td>
                    <td className="mono" style={{ padding: '6px 4px' }}>{s.volumeM3.toFixed(1)}</td>
                    <td className="mono" style={{ padding: '6px 4px' }}>{stacked ? `${s.totalCount?.toLocaleString()}（${s.layerCount}×${s.perLayerCount}）` : `${s.surfaceCoverPct}%`}</td>
                    {stacked && (
                      <td className="mono" style={{ padding: '6px 4px', color: !s.tagCode ? '#B97A17' : undefined }}>{s.tagCode ? `${TAG_NAME[s.tagType!]} ${s.tagCode}` : '未识别'}</td>
                    )}
                    <td style={{ padding: '6px 4px', color: s.issue ? '#B97A17' : '#5A6272' }}>{s.issue ? ISSUE_TEXT[s.issue] : '无'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-6" style={{ fontSize: 13.5, fontWeight: 600 }}>三、飞行过程摘要</div>
            <div className="mt-2 leading-[1.8]" style={{ fontSize: 12, color: '#5A6272' }}>
              {fmtTime(task.startedAt)} 起飞，航线高度 {route?.altitudeM.toFixed(1)} m，完成 {task.waypointDone} 个航点，其中拍照点 {proc.waypoints.filter(w => w.photo).length} 个；
              {proc.events.some(e => e.type === 'hover_obstacle') ? '途中检测到障碍物悬停 18 秒后自动恢复；' : '全程无停障；'}
              {RETURN_TEXT[task.returnTrigger]}，{fmtTime(task.landedAt)} 降落。电量 {proc.telemetry[0].battery.toFixed(0)}% → {proc.telemetry[proc.telemetry.length - 1].battery.toFixed(0)}%。
            </div>

            <div className="mt-6" style={{ fontSize: 13.5, fontWeight: 600 }}>四、附件清单</div>
            <div className="mt-2">
              {atts.map(a => (
                <div key={a.key} className="flex justify-between" style={{ fontSize: 11.5, padding: '3px 0', borderBottom: '1px solid rgba(16,24,40,.07)' }}>
                  <span style={{ color: '#5A6272' }}>{a.desc.split('，')[0].split('：')[0]}{a.count ? `（${a.count} 张）` : ''}</span>
                  <span className="mono">{a.name} · {fmtMb(a.sizeMb)}{missing.has(a.name) ? ' · 缺失' : ''}</span>
                </div>
              ))}
            </div>
            <div className="mono mt-8 pt-3 flex justify-between" style={{ borderTop: '1px solid rgba(16,24,40,.12)', fontSize: 10, color: '#B0B7C3' }}>
              <span>完整数据包约 {fmtMb(packSizeOf(task))} · 由机载端生成，经同步码同步到网页端</span>
              <span>仓储无人机巡检 · 数据中心</span>
            </div>
          </div>
        </div>
      )}

      {/* 附件 */}
      {tab === 'files' && (
        <div className="mt-5">
          <Card pad={0} style={{ overflow: 'hidden' }}>
            <div className="flex items-center gap-3" style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-3)' }}>
              <Check on={pickedFiles.size === atts.length} indeterminate={pickedFiles.size > 0 && pickedFiles.size < atts.length} onChange={v => setPickedFiles(v ? new Set(atts.filter(a => !missing.has(a.name)).map(a => a.key)) : new Set())} />
              <span style={{ fontSize: 12.5 }}>{pickedFiles.size ? `已选 ${pickedFiles.size} 个文件` : `${atts.length} 个附件 · 合计 ${fmtMb(packSizeOf(task))}`}</span>
              <div className="ml-auto flex gap-2">
                <Button small variant="secondary" disabled={pickedFiles.size === 0} icon={<IconDownload size={12} />} onClick={() => { dl([...pickedFiles]); setPickedFiles(new Set()); }}>下载所选</Button>
                <Button small icon={<IconDownload size={12} />} onClick={() => dl('all')}>打包下载全部</Button>
              </div>
            </div>
            <table className="dtable">
              <thead><tr><th style={{ width: 36 }}></th><th>文件</th><th>说明</th><th style={{ textAlign: 'right' }}>大小</th><th>MD5</th><th>状态</th><th style={{ width: 100 }}></th></tr></thead>
              <tbody>
                {atts.map(a => {
                  const miss = missing.has(a.name);
                  const on = pickedFiles.has(a.key);
                  return (
                    <tr key={a.key} className={on ? 'row-on' : ''} style={{ opacity: miss ? .6 : 1 }}>
                      <td>{!miss && <Check on={on} onChange={v => setPickedFiles(p => { const n = new Set(p); v ? n.add(a.key) : n.delete(a.key); return n; })} />}</td>
                      <td><span className="inline-flex items-center gap-2"><span style={{ color: 'var(--text-tertiary)', display: 'inline-flex' }}>{KIND_ICON[a.kind]}</span><span className="mono">{a.name}</span><Tag>{a.kind.toUpperCase()}</Tag></span></td>
                      <td style={{ color: 'var(--text-secondary)' }}>{a.desc}{a.count ? `（${a.count} 张）` : ''}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtMb(a.sizeMb)}</td>
                      <td className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{a.md5.slice(0, 12)}…</td>
                      <td>{miss ? <span className="inline-flex items-center gap-1" style={{ fontSize: 11.5, color: 'var(--warning)' }}><IconWarn size={12} />缺失</span> : <span className="inline-flex items-center gap-1" style={{ fontSize: 11.5, color: 'var(--success)' }}><IconCheck size={12} />校验通过</span>}</td>
                      <td style={{ textAlign: 'right' }}>{!miss && <Button small variant="secondary" icon={<IconDownload size={12} />} onClick={() => dl([a.key])}>下载</Button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          {!sync.complete && (
            <div className="mt-3 flex items-center gap-2" style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--warning-bg)', color: 'var(--warning)', fontSize: 12.5 }}>
              <IconWarn size={14} />缺失 {sync.missing.join('、')}。请在手机端该任务的「结果报告」中重新生成同步码再同步一次，系统会补传缺失附件。
            </div>
          )}
          <div className="mt-3" style={{ fontSize: 11.5, color: 'var(--text-tertiary)' }}>
            点位图片共 {photoCountOf(task)} 张；PCD 可在 CloudCompare、MeshLab 等工具中打开；JSON 结构见设置页数据接口说明。
          </div>
        </div>
      )}
    </div>
  );
}
