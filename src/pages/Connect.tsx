// 接入同步码：网页端的入口页 —— 从手机端复制同步码，粘贴接入后即可检索、查看、下载
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { CATALOG } from '../mock/history';
import { syncCodeOf } from '../data/sync';
import { Button, Card, Section, IconLink, IconPhone, IconDoc, IconDownload, IconChevronRight, IconCheck, IconWarn, CodeChip, fmtDT, fmtMb, IconSync } from '../components/ui';

export function Connect() {
  const navigate = useNavigate();
  const ingest = useStore(s => s.ingest);
  const set = useStore(s => s.set);
  const syncs = useStore(s => s.syncs);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pending = CATALOG.filter(t => !syncs.some(s => s.taskId === t.id));

  const submit = async () => {
    if (busy || !code.trim()) return;
    setBusy(true); setErr('');
    const r = await ingest(code);
    setBusy(false);
    if (r.ok) navigate(`/tasks/${r.task.id}`);
    else setErr(r.reason);
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(300px, 1fr)', gap: 24 }}>
      <div>
        {/* 主输入区 */}
        <Card pad={28}>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '.02em' }}>接入巡检数据</div>
          <div className="mt-1.5 leading-[1.7]" style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            手机端在局域网内完成巡检后，会为每次任务生成一个同步码。把同步码粘贴到这里，网页端即可拉取该次巡检的过程数据、成果与报告，并长期归档。
          </div>
          <div className="flex items-center gap-2 mt-5">
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
              {busy ? '拉取中' : '接入'}
            </Button>
          </div>
          <div className="mt-2 flex items-center justify-between" style={{ fontSize: 11.5 }}>
            <span style={{ color: err ? 'var(--danger)' : 'var(--text-tertiary)' }} className="inline-flex items-center gap-1">
              {err && <IconWarn size={12} />}{err || '同步码不区分大小写；一次接入多个请用右上角「接入同步码」'}
            </span>
            <button className="pressable" style={{ color: 'var(--text-link)', cursor: 'pointer' }} onClick={() => set({ syncModalOpen: true })}>批量接入</button>
          </div>
        </Card>

        {/* 三步说明 */}
        <Section title="如何获取同步码" style={{ marginTop: 24 }}>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { icon: <IconPhone size={18} />, t: '手机端复制', d: '巡检结果 → 结果报告 → 「同步到网页端」，复制该次任务的同步码。' },
              { icon: <IconLink size={18} />, t: '网页端接入', d: '粘贴同步码，系统校验后从机载端拉取数据包（约 0.5–1.2 GB）。' },
              { icon: <IconDownload size={18} />, t: '查看与下载', d: '三维成果、飞行过程、明细与报告在线查看；附件可单个或打包下载。' },
            ].map((s, i) => (
              <Card key={s.t} pad={16}>
                <div className="flex items-center gap-2.5">
                  <span className="flex items-center justify-center shrink-0" style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--brand-subtle-bg)', color: 'var(--brand)' }}>{s.icon}</span>
                  <div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '.08em' }}>STEP {i + 1}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{s.t}</div>
                  </div>
                </div>
                <div className="mt-2.5 leading-[1.65]" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.d}</div>
              </Card>
            ))}
          </div>
        </Section>

        {/* 演示提示：手机端尚未接入的任务 */}
        {pending.length > 0 && (
          <Section title="手机端尚未接入网页端的任务（演示用）" style={{ marginTop: 24 }}>
            <Card pad={0} style={{ overflow: 'hidden' }}>
              {pending.map((t, i) => (
                <div key={t.id} className="flex items-center gap-3" style={{ padding: '12px 16px', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <span style={{ color: 'var(--text-tertiary)', display: 'inline-flex' }}><IconDoc size={15} /></span>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{t.routeName}</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{t.id} · {fmtDT(t.startedAt)}</div>
                  </div>
                  <CodeChip code={syncCodeOf(t.id)} />
                  <Button small variant="secondary" onClick={() => setCode(syncCodeOf(t.id))}>填入</Button>
                </div>
              ))}
            </Card>
            <div className="mt-2" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              正式环境中同步码只在手机端显示；此处列出仅为演示「复制 → 接入」的闭环。
            </div>
          </Section>
        )}
      </div>

      {/* 最近接入 */}
      <div>
        <Section title="最近接入" right={<button className="pressable" style={{ fontSize: 12, color: 'var(--text-link)', cursor: 'pointer' }} onClick={() => navigate('/tasks')}>任务库</button>}>
          <Card pad={0} style={{ overflow: 'hidden' }}>
            {syncs.slice(0, 8).map((s, i) => {
              const t = CATALOG.find(x => x.id === s.taskId)!;
              return (
                <button key={s.code} className="w-full flex items-center gap-3 text-left pressable" style={{ padding: '11px 14px', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none', cursor: 'pointer' }} onClick={() => navigate(`/tasks/${t.id}`)}>
                  <span style={{ color: s.complete ? 'var(--success)' : 'var(--warning)', display: 'inline-flex' }}>{s.complete ? <IconCheck size={14} /> : <IconWarn size={14} />}</span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate" style={{ fontSize: 12.5, fontWeight: 500 }}>{t.routeName}</div>
                    <div className="mono truncate" style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{s.code} · {s.deviceId} · {fmtMb(s.sizeMb)}</div>
                  </div>
                  <span className="mono shrink-0" style={{ fontSize: 10.5, color: 'var(--text-tertiary)' }}>{fmtDT(s.syncedAt).slice(5)}</span>
                  <span style={{ color: 'var(--text-placeholder)', display: 'inline-flex' }}><IconChevronRight size={12} /></span>
                </button>
              );
            })}
          </Card>
        </Section>

        <Section title="同步机制" style={{ marginTop: 24 }}>
          <Card pad={16}>
            {[
              ['同步码', '每次巡检一个，任务完成后由手机端生成，有效期 7 天'],
              ['数据来源', '手机端本机缓存 + 机载端完整数据包（同一局域网或经手机中转）'],
              ['完整性校验', '按附件清单逐项校验 MD5，缺失项会在任务详情中标出'],
              ['保留策略', '网页端归档 90 天，可导出后长期保存；手机端仅保留 7 天'],
              ['权限', '管理员可接入、下载、删除；查看者仅可查看与下载报告'],
            ].map(([k, v], i) => (
              <div key={k} className="flex gap-3" style={{ padding: '7px 0', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none' }}>
                <span className="shrink-0" style={{ width: 72, fontSize: 12, color: 'var(--text-tertiary)' }}>{k}</span>
                <span className="leading-[1.55]" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v}</span>
              </div>
            ))}
          </Card>
        </Section>
      </div>
    </div>
  );
}
