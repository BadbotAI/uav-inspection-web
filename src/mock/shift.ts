// 演示数据时间平移：示例数据写死在 2026-07，这里把它整体搬到"今天"附近 ——
// 锚点 2026-07-27（最新示例任务日）对齐到今天，所有日期保持相对关系，
// 7 天保留期 / 「今天」「n 天前」等相对时间语义因此长期成立。
// 任务编号保持不变（网页端同步码由编号派生，两端仍然互认）。
import type { Task, Route } from '../types';

const ANCHOR = new Date('2026-07-27T00:00:00');
const p = (n: number) => String(n).padStart(2, '0');
const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
export const SHIFT_MS = sod(new Date()) - sod(ANCHOR);

export function shiftDate(s: string): string {
  if (!s) return s;
  const hasTime = s.includes('T');
  const d = new Date(hasTime ? s : `${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return s;
  const nd = new Date(d.getTime() + SHIFT_MS);
  const date = `${nd.getFullYear()}-${p(nd.getMonth() + 1)}-${p(nd.getDate())}`;
  return hasTime ? `${date}T${p(nd.getHours())}:${p(nd.getMinutes())}:${p(nd.getSeconds())}` : date;
}

// 任务：时间字段平移，机载共享路径的时间戳同步重算（保持与巡检时间可对账）
export function shiftTask(t: Task): Task {
  const startedAt = shiftDate(t.startedAt);
  const dev = t.cloudSharePath.match(/\\\\([A-Z0-9-]+)\\/i)?.[1] ?? 'UAV-A31C';
  const stamp = `${startedAt.slice(0, 10).replace(/-/g, '')}_${startedAt.slice(11, 16).replace(':', '')}`;
  return {
    ...t, startedAt,
    landedAt: shiftDate(t.landedAt),
    siteAckAt: shiftDate(t.siteAckAt),
    cloudSharePath: `\\\\${dev}\\scans\\${stamp}\\`,
  };
}

export function shiftRoute(r: Route): Route {
  return { ...r, recordedAt: shiftDate(r.recordedAt), lastRunAt: r.lastRunAt ? shiftDate(r.lastRunAt) : null };
}
