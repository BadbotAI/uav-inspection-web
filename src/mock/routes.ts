import type { Route, Scene } from '../types';

// 可选扫描方式标签
export const SCAN_TAGS = ['全覆盖', '高空扫', '低空扫', '分层扫', '补扫'];

// 场景（点云地图）：先建图，后示教；一个场景下多条航线
export const SCENES: Scene[] = [
  { id: 'M-01', name: '一号仓 A区', version: 2, builtAt: '2026-07-02', cloudSizeMb: 8.6 },
  { id: 'M-02', name: '一号仓 B区', version: 1, builtAt: '2026-07-05', cloudSizeMb: 6.2 },
  { id: 'M-03', name: '二号仓 平房仓', version: 1, builtAt: '2026-07-10', cloudSizeMb: 11.4 },
  { id: 'M-04', name: '三号仓 通廊仓', version: 1, builtAt: '2026-07-14', cloudSizeMb: 7.8 },
  { id: 'M-05', name: '四号仓 方仓', version: 1, builtAt: '2026-07-18', cloudSizeMb: 9.1 },
];

export const ROUTES: Route[] = [
  { id:'R-03', sceneId:'M-01', version:3, name:'A区', scanTags:['全覆盖', '高空扫'], recordedAt:'2026-07-15', recordedBy:'运维·李',
    note:'从东侧门起飞，贴顶棚下方 5.2m 高度往返扫。西南角有立柱，航线已绕开。适用于 A 区三个堆位。',
    waypointCount:24, etaMin:7, minClearanceM:6.5, altitudeM:5.2,
    lastRunAt:'2026-07-24', lastRunStatus:'success', runs:9, successRuns:8 },

  { id:'R-02', sceneId:'M-01', version:2, name:'A区西侧', scanTags:['补扫'], recordedAt:'2026-07-03', recordedBy:'运维·李',
    note:'只覆盖西侧两个堆位。离堆较近，堆高变化后需重录。',
    waypointCount:11, etaMin:3, minClearanceM:0.9, altitudeM:4.0,
    lastRunAt:'2026-07-19', lastRunStatus:'aborted', runs:4, successRuns:2 },

  { id:'R-04', sceneId:'M-02', version:1, name:'B区码垛区', scanTags:['分层扫'], recordedAt:'2026-07-07', recordedBy:'运维·李',
    note:'B 区四个货位，逐排低速扫。码垛较整齐，可出分层计数。货位间通道窄。',
    waypointCount:16, etaMin:5, minClearanceM:3.2, altitudeM:4.4,
    lastRunAt:'2026-07-12', lastRunStatus:'success', runs:3, successRuns:3 },

  { id:'R-06', sceneId:'M-02', version:1, name:'B区托盘区', scanTags:['低空扫'], recordedAt:'2026-07-18', recordedBy:'运维·李',
    note:'托盘区低空慢扫，重点覆盖靠墙两列。',
    waypointCount:14, etaMin:4, minClearanceM:2.8, altitudeM:4.2,
    lastRunAt:'2026-07-21', lastRunStatus:'success', runs:2, successRuns:2 },

  { id:'R-07', sceneId:'M-03', version:2, name:'二号仓全景', scanTags:['全覆盖'], recordedAt:'2026-07-11', recordedBy:'运维·王',
    note:'平房仓整仓覆盖，仓体较高，按 6.4m 高度扫。',
    waypointCount:28, etaMin:9, minClearanceM:1.6, altitudeM:6.4,
    lastRunAt:'2026-07-25', lastRunStatus:'success', runs:6, successRuns:5 },

  { id:'R-08', sceneId:'M-03', version:1, name:'二号仓东半区', scanTags:['高空扫'], recordedAt:'2026-07-16', recordedBy:'运维·王',
    note:'只覆盖东半区两个大堆，适合日常快检。',
    waypointCount:15, etaMin:5, minClearanceM:2.2, altitudeM:6.8,
    lastRunAt:'2026-07-16', lastRunStatus:'success', runs:1, successRuns:1 },

  { id:'R-09', sceneId:'M-04', version:3, name:'通廊纵扫', scanTags:['全覆盖', '低空扫'], recordedAt:'2026-07-15', recordedBy:'运维·李',
    note:'狭长通廊沿中线往返，注意两侧墙距较近。',
    waypointCount:20, etaMin:6, minClearanceM:1.2, altitudeM:4.6,
    lastRunAt:'2026-07-26', lastRunStatus:'success', runs:7, successRuns:7 },

  { id:'R-10', sceneId:'M-05', version:1, name:'方仓环扫', scanTags:['全覆盖'], recordedAt:'2026-07-22', recordedBy:'运维·王',
    note:'五个堆位环形覆盖，中央小堆最后补扫。',
    waypointCount:22, etaMin:7, minClearanceM:1.8, altitudeM:5.4,
    lastRunAt:null, lastRunStatus:null, runs:0, successRuns:0 },
];

// 同步时"发现"的新航线（仅首次同步出现）
export const NEW_ROUTE: Route = {
  id:'R-05', sceneId:'M-01', version:1, name:'A区东侧', scanTags:['低空扫'], recordedAt:'2026-07-27', recordedBy:'运维·李',
  note:'',
  waypointCount:18, etaMin:5, minClearanceM:4.1, altitudeM:4.8,
  lastRunAt:null, lastRunStatus:null, runs:0, successRuns:0,
};

export const NEW_ROUTE_RECORDED_AT_TEXT = '2026-07-27 14:22';

// 展示名：区域 + 扫描方式
export function routeDisplayName(r: Pick<Route, 'name' | 'scanTags'>): string {
  const base = r.name || '未命名航线';
  return r.scanTags.length ? `${base} · ${r.scanTags.join('/')}` : base;
}
