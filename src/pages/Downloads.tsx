// 下载中心：打包进度与下载记录（谁在何时下载了什么，可审计）
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { CATALOG } from '../mock/history';
import { Card, Section, EmptyState, Button, IconDownload, IconCheck, IconSync, fmtDT, fmtMb } from '../components/ui';

export function Downloads() {
  const navigate = useNavigate();
  const downloads = useStore(s => s.downloads);
  const showToast = useStore(s => s.showToast);
  const active = downloads.filter(d => d.state !== 'done');
  const done = downloads.filter(d => d.state === 'done');

  const saveAgain = (name: string) => {
    // 演示：JSON 类附件生成真实文件，其余提示浏览器下载已开始
    if (name.endsWith('.json')) {
      const id = name.split('_')[0].replace('report', '').replace('.json', '') || name;
      const task = CATALOG.find(t => name.includes(t.id));
      const blob = new Blob([JSON.stringify(task ?? { id }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
    }
    showToast(`已开始下载 ${name}`);
  };

  if (downloads.length === 0) {
    return <EmptyState icon={<IconDownload size={22} />} text="下载队列为空" sub="在任务库勾选任务打包下载，或在任务详情的「附件」中选择文件" actionText="去任务库" onAction={() => navigate('/tasks')} />;
  }

  return (
    <div>
      <Section title={`进行中 · ${active.length}`}>
        <Card pad={0} style={{ overflow: 'hidden' }}>
          {active.length === 0 ? (
            <div style={{ padding: '18px 16px', fontSize: 12.5, color: 'var(--text-tertiary)' }}>没有进行中的打包或下载</div>
          ) : active.map((d, i) => {
            const t = CATALOG.find(x => x.id === d.taskId);
            return (
              <div key={d.id} style={{ padding: '12px 16px', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
                <div className="flex items-center gap-3">
                  <span style={{ color: 'var(--brand)', display: 'inline-flex' }}><IconSync size={14} spinning /></span>
                  <div className="flex-1 min-w-0">
                    <div className="mono truncate" style={{ fontSize: 13 }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t?.routeName} · {fmtMb(d.sizeMb)} · {d.state === 'queued' ? '排队中' : d.progress < 60 ? '机载端打包中' : '下载中'}</div>
                  </div>
                  <span className="mono" style={{ fontSize: 12, width: 44, textAlign: 'right' }}>{d.progress}%</span>
                </div>
                <div className="rounded-full overflow-hidden mt-2" style={{ height: 4, background: 'var(--surface-3)' }}>
                  <div className="h-full fill-anim rounded-full" style={{ width: `${d.progress}%`, background: 'var(--brand)' }} />
                </div>
              </div>
            );
          })}
        </Card>
      </Section>

      <Section title={`下载记录 · ${done.length}`} style={{ marginTop: 20 }}>
        <Card pad={0} style={{ overflow: 'hidden' }}>
          {done.length === 0 ? (
            <div style={{ padding: '18px 16px', fontSize: 12.5, color: 'var(--text-tertiary)' }}>暂无已完成的下载</div>
          ) : (
            <table className="dtable">
              <thead><tr><th>文件</th><th>任务</th><th style={{ textAlign: 'right' }}>大小</th><th>下载人</th><th>时间</th><th style={{ width: 120 }}></th></tr></thead>
              <tbody>
                {done.map(d => {
                  const t = CATALOG.find(x => x.id === d.taskId);
                  return (
                    <tr key={d.id}>
                      <td><span className="inline-flex items-center gap-2 mono"><span style={{ color: 'var(--success)', display: 'inline-flex' }}><IconCheck size={13} /></span>{d.name}</span></td>
                      <td><button className="pressable" style={{ color: 'var(--text-link)', cursor: 'pointer' }} onClick={() => navigate(`/tasks/${d.taskId}`)}>{t?.routeName}</button></td>
                      <td className="mono" style={{ textAlign: 'right' }}>{fmtMb(d.sizeMb)}</td>
                      <td>{d.by}</td>
                      <td className="mono">{fmtDT(d.startedAt)}</td>
                      <td style={{ textAlign: 'right' }}><Button small variant="secondary" icon={<IconDownload size={12} />} onClick={() => saveAgain(d.name)}>再次下载</Button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
        <div className="mt-2" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>下载记录保留 180 天，用于数据流转审计；打包文件在服务端缓存 24 小时。</div>
      </Section>
    </div>
  );
}
