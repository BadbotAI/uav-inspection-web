// 三维成果查看器：复用手机端引擎（点云 + 航线 + 轨迹 + 堆体包围框 + 标签），桌面交互
import { useEffect, useRef, useState } from 'react';
import { Engine, type ViewPreset } from '../three/renderer';
import { IconExpand, IconCompress, IconLayers } from './ui';
import type { Task, Route } from '../types';

interface Layers { cloud: boolean; route: boolean; track: boolean; boxes: boolean; labels: boolean }

// 堆体 id → 场景中的 pile 序号（与手机端一致：S-A/S-B/S-C 对应 0/1/2）
export function pileIdxOf(task: Task, stackIdx: number): number {
  const id = task.stacks[stackIdx]?.id ?? '';
  if (id === 'S-A') return 0;
  if (id === 'S-B') return 1;
  if (id === 'S-C') return 2;
  return Math.min(stackIdx, 2);
}

const chip = (active: boolean): React.CSSProperties => ({
  height: 26, padding: '0 10px', borderRadius: 999, fontSize: 11.5, cursor: 'pointer',
  background: active ? 'var(--brand)' : 'rgba(255,255,255,.88)',
  color: active ? '#FFFFFF' : 'var(--text-secondary)',
  border: `1px solid ${active ? 'var(--brand)' : 'var(--border-default)'}`,
  backdropFilter: 'blur(6px)', boxShadow: 'var(--shadow-card)', whiteSpace: 'nowrap',
});

export function Viewer3D({
  task, route, height = 420, selected, onSelect, initialLayers, showRoute = false,
}: {
  task: Task; route?: Route; height?: number;
  selected?: number | null;            // stack index
  onSelect?: (stackIdx: number | null) => void;
  initialLayers?: Partial<Layers>;
  showRoute?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [preset, setPreset] = useState<ViewPreset>('iso');
  const [layers, setLayers] = useState<Layers>({ cloud: true, route: showRoute, track: true, boxes: true, labels: true, ...initialLayers });
  const [panel, setPanel] = useState(false);
  const [full, setFull] = useState(false);
  const [loadMs, setLoadMs] = useState<number | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const t0 = performance.now();
    const engine = new Engine(canvas, {
      waypointCount: task.waypointTotal, altitudeM: route?.altitudeM ?? 5.2, sceneId: route?.sceneId,
      labelNames: task.stacks.map(s => s.name),
      onSelectPile: idx => {
        if (!onSelect) return;
        if (idx === null) { onSelect(null); return; }
        const si = task.stacks.findIndex((_, i) => pileIdxOf(task, i) === idx);
        onSelect(si >= 0 ? si : null);
      },
      onDegrade: () => setDegraded(true),
      onUserOrbit: () => setPreset('iso'),
    });
    engineRef.current = engine;
    engine.setLayers(layers);
    engine.setPreset('iso');
    engine.setFlight(task.coveragePct / 100, false);
    requestAnimationFrame(() => setLoadMs(Math.round(performance.now() - t0)));
    const ro = new ResizeObserver(() => engine.resize());
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => { ro.disconnect(); engine.dispose(); engineRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  useEffect(() => { engineRef.current?.setLayers(layers); }, [layers]);
  useEffect(() => {
    engineRef.current?.selectPile(selected == null ? null : pileIdxOf(task, selected));
  }, [selected, task]);

  // 帧率实测（规格：加载 ≤10s、≥30FPS）
  useEffect(() => {
    let raf = 0, frames = 0, last = performance.now();
    const tick = (now: number) => {
      frames += 1;
      if (now - last >= 1000) { setFps(Math.round((frames * 1000) / (now - last))); frames = 0; last = now; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [full]);

  const choose = (p: ViewPreset) => { setPreset(p); engineRef.current?.setPreset(p); };

  return (
    <div
      ref={wrapRef}
      className={full ? 'fixed inset-0 z-50' : 'relative'}
      style={{ height: full ? '100vh' : height, borderRadius: full ? 0 : 10, overflow: 'hidden', background: 'var(--canvas)', border: full ? 'none' : '1px solid var(--card-stroke)' }}
    >
      <canvas ref={canvasRef} className="w-full h-full block" style={{ touchAction: 'none' }} />

      <div className="absolute flex items-center gap-1.5" style={{ left: 12, top: 12 }}>
        {(['top', 'iso'] as ViewPreset[]).map(p => (
          <button key={p} className="mono pressable" style={chip(preset === p)} onClick={() => choose(p)}>{p === 'top' ? '顶视' : '全景'}</button>
        ))}
        <button className="flex items-center justify-center" style={{ ...chip(panel), width: 28, padding: 0 }} onClick={() => setPanel(v => !v)} aria-label="图层"><IconLayers size={14} /></button>
        {panel && (
          <div className="absolute flex flex-col gap-1" style={{ left: 0, top: 32, width: 120, padding: 6, borderRadius: 9, background: 'var(--glass-bg)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-popover)', zIndex: 5 }}>
            {([['cloud', '场景点云'], ['route', '规划航线'], ['track', '飞行轨迹'], ['boxes', '堆体包围框'], ['labels', '堆体标签']] as [keyof Layers, string][]).map(([k, name]) => (
              <button key={k} className="w-full text-center" style={{ padding: '6px 0', borderRadius: 6, fontSize: 11.5, background: layers[k] ? 'var(--brand)' : 'var(--fill-quiet)', color: layers[k] ? '#FFFFFF' : 'var(--text-tertiary)', cursor: 'pointer' }} onClick={() => setLayers(v => ({ ...v, [k]: !v[k] }))}>{name}</button>
            ))}
          </div>
        )}
      </div>

      <button className="absolute flex items-center justify-center" style={{ ...chip(false), width: 28, padding: 0, right: 12, top: 12 }} onClick={() => setFull(v => !v)} aria-label={full ? '退出全屏' : '全屏'}>
        {full ? <IconCompress size={13} /> : <IconExpand size={13} />}
      </button>

      {degraded && (
        <div className="absolute mono" style={{ right: 12, top: 46, fontSize: 10.5, padding: '3px 8px', borderRadius: 5, background: 'var(--warning-bg)', border: '1px solid var(--warning)', color: 'var(--warning)' }}>已降低渲染精度</div>
      )}

      <div className="absolute mono pointer-events-none" style={{ left: 12, bottom: 10, fontSize: 10.5, color: 'var(--text-tertiary)' }}>
        拖拽旋转 · 滚轮缩放 · 点击堆体查看明细
      </div>
      {loadMs != null && (
        <div className="absolute mono pointer-events-none" style={{ right: 12, bottom: 10, fontSize: 10, letterSpacing: '.04em', color: 'var(--text-tertiary)' }}>
          加载 {loadMs < 1000 ? `${loadMs}ms` : `${(loadMs / 1000).toFixed(1)}s`} · {fps ?? '--'} FPS
        </div>
      )}
    </div>
  );
}
