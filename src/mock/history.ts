// 任务目录：手机端的 4 条任务 + 按航线生成的历史巡检，用于库存趋势与检索
import type { Task, Stack } from '../types';
import { TASKS } from './tasks';
import { ROUTES, routeDisplayName } from './routes';

// 确定性伪随机：同一任务每次生成的数据一致
export function seeded(key: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
  return () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    return h / 4294967296;
  };
}

interface StackTmpl { id: string; name: string; position: string; base: number; drift: number; stacked?: { layers: number; per: number } }

// 各航线的堆体 / 货位模板：base 为基准体积，drift 为每次巡检的趋势（负值 = 持续出库）
const TEMPLATES: Record<string, StackTmpl[]> = {
  'R-03': [
    { id: 'S-A', name: '堆体 A', position: '东侧靠门', base: 88.2, drift: -1.2 },
    { id: 'S-B', name: '堆体 B', position: '中部', base: 49.6, drift: 0.9 },
    { id: 'S-C', name: '堆体 C', position: '西南角', base: 32.4, drift: -0.2 },
  ],
  'R-07': [
    { id: 'S-A', name: '堆体 A', position: '南侧', base: 121.4, drift: -3.8 },
    { id: 'S-B', name: '堆体 B', position: '中部偏南', base: 96.2, drift: -2.1 },
    { id: 'S-C', name: '堆体 C', position: '中部偏北', base: 74.8, drift: 0.4 },
    { id: 'S-D', name: '堆体 D', position: '北侧', base: 58.1, drift: 6.5 },
  ],
  'R-08': [
    { id: 'S-A', name: '堆体 A', position: '东南', base: 118.6, drift: 0 },
    { id: 'S-B', name: '堆体 B', position: '东北', base: 92.9, drift: 0 },
  ],
  'R-09': [
    { id: 'S-A', name: '堆体 A', position: '通廊南段', base: 66.3, drift: -0.8 },
    { id: 'S-B', name: '堆体 B', position: '通廊北段', base: 41.7, drift: 2.3 },
  ],
  'R-06': [
    { id: 'K-P1', name: '货位 P1', position: '靠墙东列', base: 38.4, drift: 0, stacked: { layers: 5, per: 48 } },
    { id: 'K-P2', name: '货位 P2', position: '靠墙西列', base: 36.9, drift: 0, stacked: { layers: 5, per: 48 } },
    { id: 'K-P3', name: '货位 P3', position: '中列', base: 22.1, drift: 0, stacked: { layers: 3, per: 48 } },
  ],
};

// 历史巡检日期（手机端已有的 07-12 / 07-19 / 07-24 / 07-27 不重复生成）
const RUNS: Record<string, { date: string; time: string; k: number; device: string; operator: string }[]> = {
  'R-03': [
    { date: '2026-07-03', time: '09:32:10', k: 0, device: 'UAV-A31C', operator: '操作员·张' },
    { date: '2026-07-10', time: '09:38:44', k: 1, device: 'UAV-A31C', operator: '操作员·张' },
    { date: '2026-07-17', time: '10:02:19', k: 2, device: 'UAV-A31C', operator: '操作员·王' },
  ],
  'R-07': [
    { date: '2026-07-11', time: '14:10:05', k: 0, device: 'UAV-B12', operator: '操作员·王' },
    { date: '2026-07-18', time: '14:21:37', k: 1, device: 'UAV-B12', operator: '操作员·王' },
    { date: '2026-07-25', time: '13:58:52', k: 2, device: 'UAV-B12', operator: '操作员·王' },
  ],
  'R-08': [
    { date: '2026-07-16', time: '16:05:30', k: 0, device: 'UAV-B12', operator: '操作员·王' },
  ],
  'R-09': [
    { date: '2026-07-12', time: '11:20:14', k: 0, device: 'UAV-C08', operator: '操作员·李' },
    { date: '2026-07-19', time: '11:15:48', k: 1, device: 'UAV-C08', operator: '操作员·李' },
    { date: '2026-07-26', time: '11:31:02', k: 2, device: 'UAV-C08', operator: '操作员·李' },
  ],
  'R-06': [
    { date: '2026-07-21', time: '10:44:23', k: 0, device: 'UAV-A31C', operator: '操作员·张' },
  ],
};

function pad(n: number) { return String(n).padStart(2, '0'); }

function addSec(dateTime: string, sec: number): string {
  const d = new Date(dateTime);
  d.setSeconds(d.getSeconds() + sec);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function buildTask(routeId: string, run: { date: string; time: string; k: number; device: string; operator: string }, seq: number): Task {
  const route = ROUTES.find(r => r.id === routeId)!;
  const id = `T-${run.date.replace(/-/g, '')}-${pad(seq)}`;
  const rnd = seeded(id);
  const startedAt = `${run.date}T${run.time}`;
  const durationSec = Math.round(route.etaMin * 60 * (0.94 + rnd() * 0.12));
  const tmpl = TEMPLATES[routeId];
  const stacks: Stack[] = tmpl.map((t, i) => {
    const jitter = (rnd() - 0.5) * 1.6;
    const vol = Math.round((t.base + t.drift * run.k + jitter) * 10) / 10;
    const cover = Math.round(86 + rnd() * 12);
    const conf = cover >= 94 ? 'high' : cover >= 88 ? 'medium' : 'low';
    const s: Stack = {
      id: t.id, name: t.name, position: t.position,
      cargoType: t.stacked ? 'stacked' : 'bulk',
      volumeM3: vol, volumeConfidence: conf, surfaceCoverPct: cover,
      occlusionNote: conf === 'high' ? '四面完整可见，顶面点云密度充足。'
        : conf === 'medium' ? '一侧贴墙，该侧壁面由地面基准延伸推算。'
        : '两侧受立柱与设备遮挡，堆脚不可见，体积部分由推算得出。',
      issue: conf === 'low' ? 'occluded' : null,
      layerCount: null, perLayerCount: null, totalCount: null, countConfidence: null,
    };
    if (t.stacked) {
      s.layerCount = t.stacked.layers;
      s.perLayerCount = t.stacked.per;
      s.totalCount = t.stacked.layers * t.stacked.per;
      s.countConfidence = conf === 'low' ? 'medium' : 'high';
      s.tagType = i === 2 ? 'rfid' : 'qr';
      s.tagCode = i === 2 ? `RF-00${(seq * 37 + i).toString(16).toUpperCase().padStart(4, '0')}` : `PLT-${t.id.slice(2)}-0${300 + seq * 7 + i}`;
    }
    return s;
  });
  const stamp = `${run.date.replace(/-/g, '')}_${run.time.slice(0, 5).replace(':', '')}`;
  return {
    id, routeId, routeName: routeDisplayName(route),
    startedAt, landedAt: addSec(startedAt, durationSec), durationSec,
    coveragePct: 100, status: 'success', operator: run.operator, siteAckAt: addSec(startedAt, -14),
    waypointDone: route.waypointCount, waypointTotal: route.waypointCount,
    trackLengthM: Math.round(route.waypointCount * 7.6 * (0.95 + rnd() * 0.1) * 10) / 10,
    avgSpeedMs: 1.4, maxSpeedMs: 1.9, returnTrigger: 'route_complete',
    locP95Cm: Math.round((5.4 + rnd() * 1.8) * 10) / 10,
    cloudCompletePct: Math.round((97 + rnd() * 2) * 10) / 10,
    trackCompletePct: Math.round((99 + rnd() * 0.8) * 10) / 10,
    volumeCalcSec: Math.round(40 + rnd() * 30),
    volumeErrPct: Math.round((2 + rnd() * 1.4) * 10) / 10,
    cloudSharePath: `\\\\${run.device}\\scans\\${stamp}\\`,
    cloudSizeMb: Math.round(480 + rnd() * 400),
    stacks,
  };
}

function buildHistory(): Task[] {
  const out: Task[] = [];
  let seq = 3;
  for (const [routeId, runs] of Object.entries(RUNS)) {
    for (const run of runs) out.push(buildTask(routeId, run, seq++));
  }
  return out;
}

// 完整任务目录（含手机端 4 条），按时间倒序
export const CATALOG: Task[] = [...TASKS, ...buildHistory()]
  .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

// 初始已接入网页端的任务：今天这条（T-20260727-01）留给演示「手机复制同步码 → 网页接入」
export const INITIAL_LIBRARY_IDS: string[] = CATALOG.map(t => t.id).filter(id => id !== 'T-20260727-01');

// 来源设备：从共享路径解析
export function deviceOf(task: Task): string {
  const m = task.cloudSharePath.match(/\\\\([A-Z0-9-]+)\\/i);
  return m ? m[1] : 'UAV-A31C';
}
