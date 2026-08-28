// 同步码：由任务编号确定性派生，手机端与网页端使用同一算法
// 形如 UAV-K3M9-Q2AF；字符集去掉 0/O/1/I 避免抄录混淆
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function syncCodeOf(taskId: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < taskId.length; i++) {
    const c = taskId.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c, 2246822519) >>> 0;
  }
  let out = '';
  for (let i = 0; i < 8; i++) {
    const v = i < 4 ? (h1 >>> (i * 5)) & 31 : (h2 >>> ((i - 4) * 5)) & 31;
    out += ALPHABET[v];
  }
  return `UAV-${out.slice(0, 4)}-${out.slice(4)}`;
}

// 规范化用户输入：大小写 / 全角连字符 / 空格 / 缺失前缀都容错
export function normalizeCode(raw: string): string {
  const s = raw.trim().toUpperCase().replace(/[－—–\s]/g, '-').replace(/[^A-Z0-9-]/g, '');
  const body = s.replace(/^UAV-?/, '').replace(/-/g, '');
  if (body.length !== 8) return s;
  return `UAV-${body.slice(0, 4)}-${body.slice(4)}`;
}

export const CODE_RE = /^UAV-[A-Z2-9]{4}-[A-Z2-9]{4}$/;

// 同步码有效期（天）：手机端生成后 7 天内可接入
export const CODE_TTL_DAYS = 7;
