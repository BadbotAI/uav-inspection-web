export type Freshness = 'fresh' | 'aging' | 'stale';        // 较新 / 偏旧 / 过期
export type Confidence = 'high' | 'medium' | 'low';         // 高 / 中 / 低
export type LocQuality = 'good' | 'fair' | 'poor' | 'lost'; // 良好 / 一般 / 差 / 丢失
export type CargoType  = 'bulk' | 'stacked';                // 散料堆体 / 规则码垛
export type TaskStatus = 'success' | 'aborted' | 'failed';

// 航点：示教录制时逐点记录
export interface Waypoint {
  x: number;
  y: number;
  z: number;
  yawDeg: number;        // 机头朝向
  isPhoto: boolean;      // 该航点是否拍照
  vel: number;           // 该段飞行速度 m/s
}

// 场景：先建图得到的点云地图，一个场景下有多条航线（两级目录）
export interface Scene {
  id: string;            // 'M-01'
  name: string;          // '一号仓 A区'
  version: number;
  builtAt: string;       // 建图日期
  cloudSizeMb: number;   // 稀疏点云大小
}

export interface Route {
  id: string;            // 'R-03'
  sceneId: string;       // 所属场景
  version: number;       // 版本号，重新示教录制后递增
  name: string;          // 区域名，未命名时为 ''
  scanTags: string[];    // 扫描方式标签：全覆盖 / 高空扫 / 分层扫 …
  recordedAt: string;    // ISO date
  recordedBy: string;    // '运维·李'
  note: string;          // 示教备注
  waypointCount: number;
  etaMin: number;
  minClearanceM: number; // 最小离堆距离
  altitudeM: number;     // 航线高度（示教录入）
  lastRunAt: string | null;
  lastRunStatus: TaskStatus | null;
  runs: number;
  successRuns: number;
}

// 明细异常情况：识别不清晰 / 部分遮挡 / 未覆盖 / 变化异常
export type StackIssue = 'unclear' | 'occluded' | 'uncovered' | 'changed';

// 货物绑定标签形式：二维码 / 条码 / RFID（具体形式设计阶段确认）
export type CargoTagType = 'qr' | 'barcode' | 'rfid';

export interface Stack {
  id: string;
  name: string;          // '堆体 A' | '货位 B1'
  position: string;      // '东侧靠门'
  cargoType: CargoType;
  volumeM3: number;
  volumeConfidence: Confidence;
  surfaceCoverPct: number;
  occlusionNote: string; // 遮挡说明，medium/low 必填
  issue?: StackIssue | null; // 异常情况标注
  // 货物绑定标签：识别到时记录形式与编码；tagCode 为 null 表示标签存在但未识别到
  tagType?: CargoTagType | null;
  tagCode?: string | null;
  // 仅 stacked 有值
  layerCount: number | null;
  perLayerCount: number | null;
  totalCount: number | null;
  countConfidence: Confidence | null;
}

export interface Task {
  id: string;            // 'T-20260727-01'
  routeId: string;
  routeName: string;
  startedAt: string;
  landedAt: string;
  durationSec: number;
  coveragePct: number;
  status: TaskStatus;
  operator: string;
  siteAckAt: string;     // 现场确认时间
  waypointDone: number;
  waypointTotal: number;
  trackLengthM: number;
  avgSpeedMs: number;
  maxSpeedMs: number;
  returnTrigger: 'user' | 'route_complete' | 'auto_timeout' | 'safety' | 'rc_override';
  locP95Cm: number;
  cloudCompletePct: number;
  trackCompletePct: number;
  volumeCalcSec: number;
  volumeErrPct: number;  // 本次体积测算估计误差 ±%（规格上限 5%）
  cloudSharePath: string;
  cloudSizeMb: number;
  stacks: Stack[];
}

export interface DeviceState {
  id: string;            // 'UAV-A31C'
  connected: boolean;
  batteryPct: number;
  storageFreeGb: number;
  locQuality: LocQuality;
  locP95Cm: number;
  rttMs: number;
  lossPct: number;
  sensorsOk: boolean;
  charging: boolean;     // 停机充电中
  locationDesc: string;  // 无人机所在区域（定位 + 位置描述）
}

export type MissionState =
  | 'IDLE' | 'PREFLIGHT' | 'PREFLIGHT_FAIL' | 'COUNTDOWN' | 'FLYING'
  | 'HOVERING' | 'RETURNING' | 'LANDED' | 'PROCESSING' | 'DONE'
  | 'PROCESS_FAIL' | 'FAULT';

export type FlightEventType =
  | 'takeoff' | 'waypoint_reached' | 'hover_manual' | 'hover_obstacle'
  | 'hover_loc' | 'resume' | 'return_start' | 'landed' | 'fault';

export interface FlightEvent {
  time: string;          // 'HH:MM:SS'
  type: FlightEventType;
  label: string;
}

export interface CheckResult {
  key: string;
  title: string;
  passed: boolean;
  detail: string;        // 通过时说明或失败原因
}

// ============================================================
// Web 数据中心补充类型
// ============================================================

// 同步记录：手机端复制同步码 → 网页端接入后的一次数据包拉取
export interface SyncRecord {
  code: string;          // 'UAV-K3M9-Q2AF'
  taskId: string;
  deviceId: string;      // 数据包来源设备
  syncedAt: string;      // ISO
  sizeMb: number;        // 数据包总量
  complete: boolean;     // 附件是否齐全
  missing: string[];     // 缺失附件名
  expiresAt: string;     // 同步码有效期（手机端生成后 7 天）
}

export type AttachmentKind = 'pcd' | 'json' | 'pdf' | 'mp4' | 'zip' | 'csv';

export interface Attachment {
  key: string;           // model / volume / inventory / report / video / photos / telemetry / events
  name: string;          // 文件名
  kind: AttachmentKind;
  sizeMb: number;
  md5: string;
  desc: string;          // 一句话说明
  count?: number;        // 图片张数等
}

export interface TelemetryPoint {
  t: number;             // 秒
  battery: number;       // %
  speed: number;         // m/s
  alt: number;           // m
  rtt: number;           // ms
}

export interface WaypointLog {
  idx: number;           // 1 起
  t: number;             // 到达秒
  time: string;          // HH:MM:SS
  photo: boolean;
  dwellS: number;        // 悬停拍照时长
}

export interface ProcessStage {
  name: string;
  sec: number;
  ok: boolean;
}

export interface ProcessData {
  telemetry: TelemetryPoint[];
  waypoints: WaypointLog[];
  events: FlightEvent[];
  stages: ProcessStage[];
}

export type DownloadState = 'queued' | 'running' | 'done';

export interface DownloadRecord {
  id: string;
  taskId: string;
  name: string;
  sizeMb: number;
  startedAt: string;
  progress: number;      // 0–100
  state: DownloadState;
  by: string;            // 下载人
}
