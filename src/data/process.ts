// 过程数据 / 附件清单：由任务与航线确定性生成（机载端记录的遥测、航点、事件、处理阶段）
import type { Task, Route, ProcessData, TelemetryPoint, WaypointLog, FlightEvent, Attachment, ProcessStage } from '../types';
import { seeded } from '../mock/history';

function hms(base: string, sec: number): string {
  const d = new Date(base);
  d.setSeconds(d.getSeconds() + sec);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

const cache = new Map<string, ProcessData>();

export function processOf(task: Task, route?: Route): ProcessData {
  const hit = cache.get(task.id);
  if (hit) return hit;
  const rnd = seeded(`${task.id}-proc`);
  const alt = route?.altitudeM ?? 5.2;
  const dur = task.durationSec;
  const nWp = task.waypointDone;
  const aborted = task.status !== 'success';
  // 航点到达时刻：起飞爬升 12s 后等距分布；拍照点每隔一个航点，悬停 5–7s
  const liftS = 12;
  const flyS = dur - liftS - (aborted ? 8 : 26);
  const waypoints: WaypointLog[] = [];
  for (let i = 1; i <= nWp; i++) {
    const t = Math.round(liftS + (flyS * i) / nWp);
    const photo = i % 2 === 0;
    waypoints.push({ idx: i, t, time: hms(task.startedAt, t), photo, dwellS: photo ? Math.round(5 + rnd() * 2) : 0 });
  }
  // 停障：主展示任务在第 9 航点后遇障悬停 18s
  const obstacleAt = task.id === 'T-20260727-01' ? waypoints[8]?.t + 6 : null;

  const telemetry: TelemetryPoint[] = [];
  const b0 = 82 + rnd() * 6;
  for (let t = 0; t <= dur; t += 5) {
    const prog = t / dur;
    let speed = t < liftS ? 0.4 : task.avgSpeedMs + Math.sin(t / 7) * 0.25 + (rnd() - 0.5) * 0.15;
    const nearWp = waypoints.find(w => w.photo && t >= w.t && t < w.t + w.dwellS);
    if (nearWp) speed = 0.05 + rnd() * 0.08;
    if (obstacleAt !== null && t >= obstacleAt && t < obstacleAt + 18) speed = 0;
    if (t > dur - 20) speed = Math.max(0.2, task.avgSpeedMs * ((dur - t) / 20));
    const altNow = t < liftS ? 0.3 + (alt - 0.3) * (t / liftS) : t > dur - 14 ? alt * Math.max(0.05, (dur - t) / 14) : alt + Math.sin(t / 11) * 0.06;
    telemetry.push({
      t,
      battery: Math.round((b0 - prog * (dur / 60) * 3.1 - (rnd() * 0.3)) * 10) / 10,
      speed: Math.round(Math.max(0, speed) * 100) / 100,
      alt: Math.round(altNow * 100) / 100,
      rtt: Math.round(18 + rnd() * 14 + (t % 60 < 5 ? 40 : 0)),
    });
  }

  const events: FlightEvent[] = [{ time: hms(task.startedAt, 0), type: 'takeoff', label: '起飞，目标高度 ' + alt.toFixed(1) + 'm' }];
  for (const w of waypoints) {
    events.push({ time: w.time, type: 'waypoint_reached', label: `到达航点 ${w.idx}${w.photo ? '，悬停拍照' : ''}` });
    if (obstacleAt !== null && w.idx === 9) {
      events.push({ time: hms(task.startedAt, obstacleAt), type: 'hover_obstacle', label: '前方 2.1m 检测到障碍物，已悬停' });
      events.push({ time: hms(task.startedAt, obstacleAt + 18), type: 'resume', label: '障碍物离开，继续飞行' });
    }
  }
  const returnLabel: Record<Task['returnTrigger'], string> = {
    route_complete: '航线执行完成，沿原航线返航',
    user: '操作员长按返航，任务中断',
    auto_timeout: '悬停超时，自动返航',
    safety: '定位质量不足，安全返航',
    rc_override: '遥控器接管，任务中断',
  };
  events.push({ time: hms(task.startedAt, dur - (aborted ? 8 : 26)), type: 'return_start', label: returnLabel[task.returnTrigger] });
  events.push({ time: hms(task.startedAt, dur), type: 'landed', label: '降落，起降点误差 ' + (3 + Math.round(rnd() * 5)) + 'cm' });

  const stages: ProcessStage[] = [
    { name: '点云配准', sec: Math.round(task.volumeCalcSec * 0.22), ok: true },
    { name: '去噪与抽稀', sec: Math.round(task.volumeCalcSec * 0.14), ok: true },
    { name: '地面基准拟合', sec: Math.round(task.volumeCalcSec * 0.1), ok: true },
    { name: '堆体分割', sec: Math.round(task.volumeCalcSec * 0.2), ok: true },
    { name: '体积计算', sec: Math.round(task.volumeCalcSec * 0.24), ok: true },
    { name: '报告生成', sec: Math.round(task.volumeCalcSec * 0.1), ok: true },
  ];

  const data = { telemetry, waypoints, events, stages };
  cache.set(task.id, data);
  return data;
}

export function photoCountOf(task: Task): number {
  return Math.max(6, task.waypointDone - 2);
}

function md5Of(key: string): string {
  const rnd = seeded(`${key}-md5`);
  let s = '';
  for (let i = 0; i < 32; i++) s += '0123456789abcdef'[Math.floor(rnd() * 16)];
  return s;
}

export function attachmentsOf(task: Task): Attachment[] {
  const photos = photoCountOf(task);
  const mk = (key: string, name: string, kind: Attachment['kind'], sizeMb: number, desc: string, count?: number): Attachment => ({
    key, name, kind, sizeMb: Math.round(sizeMb * 100) / 100, md5: md5Of(`${task.id}-${key}`), desc, count,
  });
  return [
    mk('model', `${task.id}_cloud_sparse.pcd`, 'pcd', task.cloudSizeMb * 0.18, '稀疏点云三维模型，可在 CloudCompare 等工具中打开'),
    mk('volume', `${task.id}_volume.json`, 'json', 0.02, '各堆体体积、置信度、覆盖度与遮挡说明'),
    mk('inventory', `${task.id}_inventory.json`, 'json', 0.01, '盘点汇总：货位、标签编码、分层计数'),
    mk('report', `report_${task.id}.pdf`, 'pdf', 1.2, '巡检报告（与网页端在线预览一致）'),
    mk('telemetry', `${task.id}_telemetry.csv`, 'csv', 0.3, '飞行遥测：电量、速度、高度、链路时延（5 秒采样）'),
    mk('events', `${task.id}_events.json`, 'json', 0.01, '飞行事件日志：起飞、航点、悬停、返航、降落'),
    mk('video', `${task.id}_video.mp4`, 'mp4', task.durationSec * 1.1, '机头相机全程录像'),
    mk('photos', `${task.id}_photos.zip`, 'zip', photos * 2.4, '拍照航点实景图片', photos),
  ];
}

export function packSizeOf(task: Task): number {
  return Math.round(attachmentsOf(task).reduce((a, x) => a + x.sizeMb, 0));
}
