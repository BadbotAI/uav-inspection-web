// 档案：设备 / 航线 / 场景 —— 从已接入任务中汇总
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { ROUTES, SCENES } from '../mock/routes';
import { deviceOf } from '../mock/history';
import { Card, Tag, IconDrone, fmtDate, fmtMb, totalVolume } from '../components/ui';

const MODEL = 'CX-350 巡检版';

export function Archive() {
  const navigate = useNavigate();
  const tasks = useStore(s => s.libraryTasks());
  const syncs = useStore(s => s.syncs);
  const [tab, setTab] = useState<'device' | 'route' | 'scene'>('device');

  const devices = [...new Set(tasks.map(deviceOf))].map(id => {
    const list = tasks.filter(t => deviceOf(t) === id).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return { id, list, last: list[0], flightSec: list.reduce((a, t) => a + t.durationSec, 0), dataMb: syncs.filter(s => s.deviceId === id).reduce((a, s) => a + s.sizeMb, 0) };
  });

  return (
    <div>
      <div className="flex" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        {([['device', '设备'], ['route', '航线'], ['scene', '场景']] as const).map(([k, n]) => (
          <button key={k} className={`ptab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{n}</button>
        ))}
      </div>

      {tab === 'device' && (
        <div className="grid mt-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {devices.map(d => (
            <Card key={d.id}>
              <div className="flex items-center gap-2.5">
                <span style={{ color: 'var(--brand)', display: 'inline-flex' }}><IconDrone size={18} /></span>
                <div>
                  <div className="mono" style={{ fontSize: 14, fontWeight: 600 }}>{d.id}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{MODEL}</div>
                </div>
              </div>
              <div className="grid mt-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[['巡检次数', `${d.list.length}`], ['累计飞行', `${Math.round(d.flightSec / 60)} 分`], ['数据量', fmtMb(d.dataMb)]].map(([k, v]) => (
                  <div key={k}><div className="dlabel">{k}</div><div className="mono mt-0.5" style={{ fontSize: 14 }}>{v}</div></div>
                ))}
              </div>
              <div className="mt-3 pt-2.5 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-subtle)', fontSize: 11.5, color: 'var(--text-tertiary)' }}>
                <span>最近 {fmtDate(d.last.startedAt)} · {d.last.routeName}</span>
                <button className="pressable" style={{ color: 'var(--text-link)', cursor: 'pointer' }} onClick={() => navigate(`/tasks/${d.last.id}`)}>查看</button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'route' && (
        <Card pad={0} style={{ marginTop: 16, overflow: 'hidden' }}>
          <table className="dtable">
            <thead><tr><th>航线</th><th>场景</th><th>扫描方式</th><th style={{ textAlign: 'right' }}>航点</th><th style={{ textAlign: 'right' }}>高度</th><th style={{ textAlign: 'right' }}>离堆</th><th>录制</th><th style={{ textAlign: 'right' }}>已接入巡检</th><th style={{ textAlign: 'right' }}>最近体积</th><th>备注</th></tr></thead>
            <tbody>
              {ROUTES.map(r => {
                const list = tasks.filter(t => t.routeId === r.id).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
                return (
                  <tr key={r.id} className={list.length ? 'row-link' : ''} onClick={() => list.length && navigate(`/tasks/${list[0].id}`)}>
                    <td><div style={{ fontWeight: 500 }}>{r.name}</div><div className="mono" style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{r.id} · v{r.version}</div></td>
                    <td>{SCENES.find(s => s.id === r.sceneId)?.name}</td>
                    <td><span className="inline-flex gap-1">{r.scanTags.map(t => <Tag key={t} tone="info">{t}</Tag>)}</span></td>
                    <td className="mono" style={{ textAlign: 'right' }}>{r.waypointCount}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{r.altitudeM.toFixed(1)}m</td>
                    <td className="mono" style={{ textAlign: 'right', color: r.minClearanceM < 1.5 ? 'var(--warning)' : undefined }}>{r.minClearanceM.toFixed(1)}m</td>
                    <td><div className="mono" style={{ fontSize: 11.5 }}>{r.recordedAt}</div><div style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{r.recordedBy}</div></td>
                    <td className="mono" style={{ textAlign: 'right' }}>{list.length ? `${list.length} 次` : <span style={{ color: 'var(--text-placeholder)' }}>无</span>}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{list[0] ? `${totalVolume(list[0]).toFixed(1)} m³` : '—'}</td>
                    <td style={{ maxWidth: 260, fontSize: 11.5, color: 'var(--text-secondary)' }} className="truncate">{r.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'scene' && (
        <div className="grid mt-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {SCENES.map(sc => {
            const rs = ROUTES.filter(r => r.sceneId === sc.id);
            const list = tasks.filter(t => rs.some(r => r.id === t.routeId));
            return (
              <Card key={sc.id}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{sc.name}</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{sc.id} · 点云地图 v{sc.version} · 建图 {sc.builtAt} · {sc.cloudSizeMb} MB</div>
                <div className="grid mt-3" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  <div><div className="dlabel">航线</div><div className="mono mt-0.5" style={{ fontSize: 14 }}>{rs.length} 条</div></div>
                  <div><div className="dlabel">已接入巡检</div><div className="mono mt-0.5" style={{ fontSize: 14 }}>{list.length} 次</div></div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">{rs.map(r => <Tag key={r.id}>{r.name}</Tag>)}</div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
