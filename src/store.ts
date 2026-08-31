import { create } from 'zustand';
import type { Task, SyncRecord, DownloadRecord } from './types';
import { CATALOG, INITIAL_LIBRARY_IDS, deviceOf } from './mock/history';
import { syncCodeOf, normalizeCode, CODE_RE, CODE_TTL_DAYS } from './data/sync';
import { packSizeOf, attachmentsOf } from './data/process';

export const ACCOUNT = { name: '张', role: '管理员', org: '示范粮库' };

function addDays(iso: string, d: number): string {
  const x = new Date(iso);
  x.setDate(x.getDate() + d);
  return x.toISOString();
}

// 初始同步记录：历史任务按其巡检当天同步
function initialSyncs(): SyncRecord[] {
  return INITIAL_LIBRARY_IDS.map(id => {
    const t = CATALOG.find(x => x.id === id)!;
    const syncedAt = addDays(t.landedAt, 0);
    // 演示数据完整性：中断任务缺少视频附件
    const missing = t.status === 'aborted' ? [`${t.id}_video.mp4`] : [];
    return {
      code: syncCodeOf(id), taskId: id, deviceId: deviceOf(t),
      syncedAt, sizeMb: packSizeOf(t), complete: missing.length === 0, missing,
      expiresAt: addDays(syncedAt, CODE_TTL_DAYS),
    };
  }).sort((a, b) => b.syncedAt.localeCompare(a.syncedAt));
}

export type SyncOutcome =
  | { ok: true; task: Task; record: SyncRecord; already: boolean }
  | { ok: false; code: string; reason: string };

interface WebState {
  syncs: SyncRecord[];
  downloads: DownloadRecord[];
  toast: string | null;
  syncModalOpen: boolean;
  syncPrefill: string;

  libraryTasks: () => Task[];
  taskById: (id: string) => Task | undefined;
  syncOf: (taskId: string) => SyncRecord | undefined;

  // 接入同步码：校验 → 拉取（模拟耗时）→ 入库
  ingest: (raw: string) => Promise<SyncOutcome>;
  // 全量同步：拉取手机端 / 机载端尚未同步到网页端的全部任务
  pendingTasks: () => Task[];
  ingestAll: () => Promise<number>;
  enqueueDownload: (task: Task, keys: string[] | 'all') => DownloadRecord[];
  showToast: (msg: string) => void;
  set: (p: Partial<WebState>) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
let dlSeq = 1;

export const useStore = create<WebState>((set, get) => ({
  syncs: initialSyncs(),
  downloads: [],
  toast: null,
  syncModalOpen: false,
  syncPrefill: '',

  libraryTasks: () => {
    const ids = new Set(get().syncs.map(s => s.taskId));
    return CATALOG.filter(t => ids.has(t.id));
  },
  taskById: id => {
    const ids = new Set(get().syncs.map(s => s.taskId));
    return ids.has(id) ? CATALOG.find(t => t.id === id) : undefined;
  },
  syncOf: taskId => get().syncs.find(s => s.taskId === taskId),

  ingest: async raw => {
    const code = normalizeCode(raw);
    if (!CODE_RE.test(code)) return { ok: false, code: raw.trim() || '（空）', reason: '格式不正确，同步码形如 UAV-XXXX-XXXX' };
    const task = CATALOG.find(t => syncCodeOf(t.id) === code);
    if (!task) return { ok: false, code, reason: '同步码无效或已过期（有效期 7 天）' };
    const existing = get().syncs.find(s => s.taskId === task.id);
    if (existing) return { ok: true, task, record: existing, already: true };
    // 模拟从手机端 / 机载端拉取数据包
    await new Promise(r => setTimeout(r, 900 + Math.random() * 600));
    const now = new Date().toISOString();
    const record: SyncRecord = {
      code, taskId: task.id, deviceId: deviceOf(task), syncedAt: now,
      sizeMb: packSizeOf(task), complete: true, missing: [], expiresAt: addDays(now, CODE_TTL_DAYS),
    };
    set(s => ({ syncs: [record, ...s.syncs] }));
    return { ok: true, task, record, already: false };
  },

  pendingTasks: () => {
    const ids = new Set(get().syncs.map(s => s.taskId));
    return CATALOG.filter(t => !ids.has(t.id));
  },
  ingestAll: async () => {
    const list = get().pendingTasks();
    for (const t of list) {
      await get().ingest(syncCodeOf(t.id));
    }
    return list.length;
  },

  enqueueDownload: (task, keys) => {
    const atts = attachmentsOf(task);
    const picked = keys === 'all' ? atts : atts.filter(a => keys.includes(a.key));
    const now = new Date().toISOString();
    const recs: DownloadRecord[] = keys === 'all' || picked.length > 1
      ? [{ id: `D-${dlSeq++}`, taskId: task.id, name: `${task.id}_package.zip`, sizeMb: Math.round(picked.reduce((a, x) => a + x.sizeMb, 0)), startedAt: now, progress: 0, state: 'queued', by: ACCOUNT.name }]
      : picked.map(a => ({ id: `D-${dlSeq++}`, taskId: task.id, name: a.name, sizeMb: a.sizeMb, startedAt: now, progress: 0, state: 'queued' as const, by: ACCOUNT.name }));
    set(s => ({ downloads: [...recs, ...s.downloads] }));
    // 模拟打包与下载进度
    recs.forEach((r, i) => {
      const total = 1400 + Math.min(4000, r.sizeMb * 2.2);
      const t0 = performance.now() + i * 300;
      const tick = () => {
        const p = Math.min(100, Math.round(((performance.now() - t0) / total) * 100));
        set(s => ({
          downloads: s.downloads.map(d => d.id === r.id
            ? { ...d, progress: Math.max(0, p), state: p >= 100 ? 'done' : p > 0 ? 'running' : 'queued' }
            : d),
        }));
        if (p < 100) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    return recs;
  },

  showToast: msg => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = setTimeout(() => set({ toast: null }), 2400);
  },
  set: p => set(p),
}));
