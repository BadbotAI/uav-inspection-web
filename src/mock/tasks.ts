import type { Task } from '../types';
import { shiftTask } from './shift';

const RAW_TASKS: Task[] = [
// T1 今天，主展示任务
{ id:'T-20260727-01', routeId:'R-03', routeName:'A区全覆盖 · 高空扫',
  startedAt:'2026-07-27T09:41:02', landedAt:'2026-07-27T09:47:54', durationSec:412,
  coveragePct:100, status:'success', operator:'操作员·张', siteAckAt:'2026-07-27T09:40:51',
  waypointDone:24, waypointTotal:24, trackLengthM:186.4, avgSpeedMs:1.4, maxSpeedMs:1.9,
  returnTrigger:'route_complete', locP95Cm:6.2, cloudCompletePct:97.8, trackCompletePct:99.4,
  volumeCalcSec:63, volumeErrPct:2.8, cloudSharePath:'\\\\UAV-A31C\\scans\\20260727_0941\\', cloudSizeMb:742,
  stacks:[
    { id:'S-A', name:'堆体 A', position:'东侧靠门', cargoType:'bulk', volumeM3:84.6,
      volumeConfidence:'high', surfaceCoverPct:98,
      occlusionNote:'四面完整可见，顶面点云密度充足。',
      layerCount:null, perLayerCount:null, totalCount:null, countConfidence:null },
    { id:'S-B', name:'堆体 B', position:'中部', cargoType:'bulk', volumeM3:52.3,
      volumeConfidence:'medium', surfaceCoverPct:91,
      occlusionNote:'北侧紧贴墙面，该侧壁面由地面基准延伸推算，未直接扫描。',
      layerCount:null, perLayerCount:null, totalCount:null, countConfidence:null },
    { id:'S-C', name:'堆体 C', position:'西南角', cargoType:'bulk', volumeM3:31.8,
      volumeConfidence:'low', surfaceCoverPct:64,
      occlusionNote:'西侧贴墙、南侧被立柱与输送设备遮挡，堆脚不可见。体积中约 3 成由推算得出。',
      issue:'occluded',
      layerCount:null, perLayerCount:null, totalCount:null, countConfidence:null },
  ]},

// T2 三天前，用于 H-00「上次巡检」与 R-01 的点云底图来源
{ id:'T-20260724-01', routeId:'R-03', routeName:'A区全覆盖 · 高空扫',
  startedAt:'2026-07-24T10:05:11', landedAt:'2026-07-24T10:12:07', durationSec:416,
  coveragePct:100, status:'success', operator:'操作员·张', siteAckAt:'2026-07-24T10:04:58',
  waypointDone:24, waypointTotal:24, trackLengthM:186.1, avgSpeedMs:1.4, maxSpeedMs:1.9,
  returnTrigger:'route_complete', locP95Cm:5.9, cloudCompletePct:98.2, trackCompletePct:99.6,
  volumeCalcSec:58, volumeErrPct:2.6, cloudSharePath:'\\\\UAV-A31C\\scans\\20260724_1005\\', cloudSizeMb:735,
  stacks:[
    { id:'S-A', name:'堆体 A', position:'东侧靠门', cargoType:'bulk', volumeM3:83.1,
      volumeConfidence:'high', surfaceCoverPct:97, occlusionNote:'四面完整可见。',
      layerCount:null, perLayerCount:null, totalCount:null, countConfidence:null },
    { id:'S-B', name:'堆体 B', position:'中部', cargoType:'bulk', volumeM3:51.4,
      volumeConfidence:'medium', surfaceCoverPct:90,
      occlusionNote:'北侧紧贴墙面，该侧壁面由推算得出。',
      layerCount:null, perLayerCount:null, totalCount:null, countConfidence:null },
    { id:'S-C', name:'堆体 C', position:'西南角', cargoType:'bulk', volumeM3:31.7,
      volumeConfidence:'low', surfaceCoverPct:62,
      occlusionNote:'西侧贴墙、南侧被立柱遮挡，堆脚不可见。',
      layerCount:null, perLayerCount:null, totalCount:null, countConfidence:null },
  ]},

// T3 中断任务，用于验证「部分覆盖」全链路标注
{ id:'T-20260719-02', routeId:'R-02', routeName:'A区西侧 · 补扫',
  startedAt:'2026-07-19T15:30:44', landedAt:'2026-07-19T15:32:08', durationSec:84,
  coveragePct:43, status:'aborted', operator:'操作员·王', siteAckAt:'2026-07-19T15:30:20',
  waypointDone:5, waypointTotal:11, trackLengthM:38.2, avgSpeedMs:1.3, maxSpeedMs:1.6,
  returnTrigger:'user', locP95Cm:8.4, cloudCompletePct:94.1, trackCompletePct:96.0,
  volumeCalcSec:31, volumeErrPct:4.9, cloudSharePath:'\\\\UAV-A31C\\scans\\20260719_1530\\', cloudSizeMb:288,
  stacks:[
    { id:'S-B', name:'堆体 B', position:'中部', cargoType:'bulk', volumeM3:44.1,
      volumeConfidence:'low', surfaceCoverPct:58,
      occlusionNote:'任务中断，顶面仅扫到约六成，东侧完全缺失。',
      layerCount:null, perLayerCount:null, totalCount:null, countConfidence:null },
    { id:'S-C', name:'堆体 C', position:'西南角', cargoType:'bulk', volumeM3:17.3,
      volumeConfidence:'low', surfaceCoverPct:41,
      occlusionNote:'任务中断，仅扫到北侧坡面。体积不可用于账务。',
      issue:'uncovered',
      layerCount:null, perLayerCount:null, totalCount:null, countConfidence:null },
  ]},

// T4 规则码垛任务，用于验证 S-02 分层计数
{ id:'T-20260712-01', routeId:'R-04', routeName:'B区码垛区 · 分层扫',
  startedAt:'2026-07-12T09:12:30', landedAt:'2026-07-12T09:17:08', durationSec:278,
  coveragePct:100, status:'success', operator:'操作员·张', siteAckAt:'2026-07-12T09:12:14',
  waypointDone:16, waypointTotal:16, trackLengthM:121.7, avgSpeedMs:1.1, maxSpeedMs:1.4,
  returnTrigger:'route_complete', locP95Cm:6.8, cloudCompletePct:98.6, trackCompletePct:99.1,
  volumeCalcSec:47, volumeErrPct:2.1, cloudSharePath:'\\\\UAV-A31C\\scans\\20260712_0912\\', cloudSizeMb:512,
  stacks:[
    { id:'K-B1', name:'货位 B1', position:'中部', cargoType:'stacked', volumeM3:62.4,
      volumeConfidence:'high', surfaceCoverPct:96, occlusionNote:'四面可见，层间断面清晰。',
      tagType:'qr', tagCode:'PLT-B1-0421',
      layerCount:6, perLayerCount:70, totalCount:420, countConfidence:'high' },
    { id:'K-B2', name:'货位 B2', position:'中部偏东', cargoType:'stacked', volumeM3:53.6,
      volumeConfidence:'high', surfaceCoverPct:95, occlusionNote:'四面可见。',
      tagType:'qr', tagCode:'PLT-B2-0388',
      layerCount:6, perLayerCount:60, totalCount:360, countConfidence:'high' },
    { id:'K-B3', name:'货位 B3', position:'西侧', cargoType:'stacked', volumeM3:41.2,
      volumeConfidence:'medium', surfaceCoverPct:88, occlusionNote:'西侧贴墙，该侧由推算得出。',
      tagType:'rfid', tagCode:'RF-0007A2',
      layerCount:4, perLayerCount:70, totalCount:280, countConfidence:'medium' },
    { id:'K-B4', name:'货位 B4', position:'北侧', cargoType:'stacked', volumeM3:26.8,
      volumeConfidence:'medium', surfaceCoverPct:85,
      occlusionNote:'顶层码放不齐，最上层计数存在偏差。',
      issue:'unclear',
      tagType:'qr', tagCode:null,
      layerCount:3, perLayerCount:60, totalCount:180, countConfidence:'medium' },
  ]},
];

// 时间平移后的任务数据（详见 shift.ts）
export const TASKS: Task[] = RAW_TASKS.map(shiftTask);
