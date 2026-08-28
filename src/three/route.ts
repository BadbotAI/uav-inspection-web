// 航线生成：少量示教航点（x/y/z/yaw/is_photo/vel）+ Catmull-Rom 平滑曲线
// 航点之间不是直线段，而是手飞示教的自然弯曲轨迹
import * as THREE from 'three';
import { DEFAULT_PROFILE, pileHeightP, type SceneProfile } from './pointcloud';

export interface RoutePath {
  pts: THREE.Vector3[];      // 曲线密集采样点（渲染与插值用）
  waypoints: THREE.Vector3[]; // 示教航点本体
  wpFracs: number[];          // 各航点在全程弧长中的占比 0–1
  segLens: number[];
  totalLen: number;
  minClearIdx: number;   // 离堆最近的采样段索引
  minClearM: number;     // 最小离堆距离（由航线高度与堆高算出，不写死）
}

// 确定性伪随机（不用 Math.random，保证 sim 与场景一致）
function jitter(seed: number): number {
  return Math.sin(seed * 12.9898 + 78.233) % 1;
}

export function buildRoutePath(
  waypointCount: number, altitudeM: number, prof: SceneProfile = DEFAULT_PROFILE,
): RoutePath {
  const { W, L } = prof;
  // 示教航点：大体呈往返扫，但每个点位带明显手飞漂移，数量即 waypointCount
  const lanes = Math.max(2, Math.round(waypointCount / 6));
  const perLane = Math.ceil(waypointCount / lanes);
  const wps: THREE.Vector3[] = [];
  let k = 0;
  for (let i = 0; i < lanes && k < waypointCount; i++) {
    const xBase = -W / 2 + 1.6 + (W - 3.2) * (lanes === 1 ? 0.5 : i / (lanes - 1));
    const fwd = i % 2 === 0;
    for (let j = 0; j < perLane && k < waypointCount; j++, k++) {
      const t = perLane === 1 ? 0.5 : j / (perLane - 1);
      const z = (fwd ? -1 : 1) * (L / 2 - 1.6) * (1 - 2 * t);
      // 手飞不规则：横向漂移大、纵向微偏、高度小幅起伏
      const jx = jitter(k * 3.1 + i) * 0.7;
      const jz = jitter(k * 5.7 + 2.3) * 0.45;
      const jy = jitter(k * 2.3 + 0.6) * 0.22;
      wps.push(new THREE.Vector3(xBase + jx, altitudeM + jy, z + jz));
    }
  }

  // 航点间平滑插值：centripetal Catmull-Rom，避免尖角与直线感
  const curve = new THREE.CatmullRomCurve3(wps, false, 'centripetal', 0.5);
  const pts = curve.getPoints(Math.max(120, waypointCount * 10));

  const segLens: number[] = [];
  let totalLen = 0;
  let minClearIdx = 0, minClearM = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const len = pts[i].distanceTo(pts[i + 1]);
    segLens.push(len);
    totalLen += len;
    const mid = pts[i].clone().add(pts[i + 1]).multiplyScalar(0.5);
    const clear = mid.y - pileHeightP(prof, mid.x, mid.z);
    if (clear < minClearM) { minClearM = clear; minClearIdx = i; }
  }
  // 各航点的弧长占比：取距该航点最近的采样点的累计长度
  const cum: number[] = [0];
  for (let i = 0; i < segLens.length; i++) cum.push(cum[i] + segLens[i]);
  const wpFracs = wps.map(wp => {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = pts[i].distanceToSquared(wp);
      if (d < bestD) { bestD = d; best = i; }
    }
    return totalLen === 0 ? 0 : cum[best] / totalLen;
  });
  return { pts, waypoints: wps, wpFracs, segLens, totalLen, minClearIdx, minClearM };
}

// 按进度 0–1 求飞机位置与航向
export function posAt(path: RoutePath, prog: number): { pos: THREE.Vector3; dir: THREE.Vector3 } {
  const target = Math.max(0, Math.min(1, prog)) * path.totalLen;
  let acc = 0;
  for (let i = 0; i < path.segLens.length; i++) {
    if (acc + path.segLens[i] >= target || i === path.segLens.length - 1) {
      const t = path.segLens[i] === 0 ? 0 : (target - acc) / path.segLens[i];
      const pos = path.pts[i].clone().lerp(path.pts[i + 1], Math.max(0, Math.min(1, t)));
      const dir = path.pts[i + 1].clone().sub(path.pts[i]).normalize();
      return { pos, dir };
    }
    acc += path.segLens[i];
  }
  return { pos: path.pts[0].clone(), dir: new THREE.Vector3(0, 0, 1) };
}

// 航点表：示教录制的逐点数据（x/y/z/yaw/是否拍照/速度）
export interface WaypointRow {
  x: number; y: number; z: number;
  yawDeg: number;
  isPhoto: boolean;
  vel: number;
}

export function waypointRows(path: RoutePath, waypointCount: number): WaypointRow[] {
  const wps = path.waypoints;
  const rows: WaypointRow[] = [];
  let prevYaw: number | null = null;
  for (let i = 0; i < Math.min(waypointCount, wps.length); i++) {
    const p = wps[i];
    const next = wps[Math.min(i + 1, wps.length - 1)];
    const prev = wps[Math.max(0, i - 1)];
    const dir = next.clone().sub(prev);
    const yaw = (Math.atan2(dir.x, dir.z) * 180 / Math.PI + 360) % 360;
    // 转弯航点降速、不拍照；直线扫描航点拍照
    const dYaw = prevYaw === null ? 0 : Math.abs(((yaw - prevYaw + 540) % 360) - 180);
    const turning = dYaw > 45;
    rows.push({
      x: Math.round(p.x * 100) / 100,
      y: Math.round(p.y * 100) / 100,
      z: Math.round(p.z * 100) / 100,
      yawDeg: Math.round(yaw),
      isPhoto: i > 0 && !turning,
      vel: Math.round((turning ? 0.8 : 1.2 + Math.abs(jitter(i * 1.7)) * 0.5) * 10) / 10,
    });
    prevYaw = yaw;
  }
  return rows;
}

// 轨迹采样 300 点（drawRange 控制生长）
export function sampleTrack(path: RoutePath, n = 300): Float32Array {
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const { pos } = posAt(path, i / (n - 1));
    arr[i * 3] = pos.x; arr[i * 3 + 1] = pos.y - 0.06; arr[i * 3 + 2] = pos.z;
  }
  return arr;
}
