// 8.3 点云生成规格 —— 比例和着色是调过的，不要随手改
// 场景档案：每张场景地图有独立的仓体尺寸与堆体布局，同一场景基底恒定
import * as THREE from 'three';

export interface Pile { x: number; z: number; r: number; h: number }
export interface SceneProfile { W: number; L: number; H: number; piles: Pile[] }

export const DEFAULT_PROFILE: SceneProfile = {
  W: 12.5, L: 16, H: 6.4,
  piles: [
    { x: -3.4, z: -4.6, r: 2.9, h: 4.1 },  // 堆体 A
    { x:  2.6, z:  0.4, r: 2.5, h: 3.4 },  // 堆体 B
    { x: -3.2, z:  5.2, r: 2.1, h: 2.6 },  // 堆体 C
  ],
};

export const SCENE_PROFILES: Record<string, SceneProfile> = {
  'M-01': DEFAULT_PROFILE,
  // 一号仓 B区：码垛区，堆矮而多
  'M-02': {
    W: 11, L: 13.5, H: 5.6,
    piles: [
      { x: -2.6, z: -3.6, r: 2.1, h: 2.8 },
      { x:  2.4, z: -0.4, r: 1.9, h: 2.4 },
      { x: -2.2, z:  3.6, r: 1.7, h: 2.1 },
      { x:  2.6, z:  4.2, r: 1.4, h: 1.8 },
    ],
  },
  // 二号仓 平房仓：更大更高
  'M-03': {
    W: 16, L: 21, H: 7.5,
    piles: [
      { x: -4.8, z: -6.4, r: 3.4, h: 4.8 },
      { x:  4.0, z: -4.4, r: 3.0, h: 4.2 },
      { x: -3.6, z:  3.6, r: 2.8, h: 3.6 },
      { x:  4.4, z:  6.0, r: 2.4, h: 3.0 },
    ],
  },
  // 三号仓 通廊仓：狭长纵深
  'M-04': {
    W: 9.5, L: 22, H: 5.8,
    piles: [
      { x: 0.2, z: -6.8, r: 2.6, h: 3.4 },
      { x: -0.3, z:  0, r: 2.8, h: 3.8 },
      { x: 0.4, z:  6.8, r: 2.4, h: 3.1 },
    ],
  },
  // 四号仓 方仓：方形对称五堆
  'M-05': {
    W: 13, L: 13, H: 6.8,
    piles: [
      { x: -3.2, z: -3.2, r: 2.4, h: 3.9 },
      { x:  3.4, z: -3.0, r: 2.2, h: 3.2 },
      { x: -3.0, z:  3.4, r: 2.1, h: 2.8 },
      { x:  3.2, z:  3.2, r: 2.3, h: 3.3 },
      { x:  0.1, z:  0.1, r: 1.5, h: 2.1 },
    ],
  },
};

export function profileOf(sceneId?: string | null): SceneProfile {
  return SCENE_PROFILES[sceneId ?? ''] ?? DEFAULT_PROFILE;
}

// 旧接口沿用：默认场景常量
export const W = DEFAULT_PROFILE.W;
export const L = DEFAULT_PROFILE.L;
export const H = DEFAULT_PROFILE.H;
export const PILES = DEFAULT_PROFILE.piles;

// 任意 (x,z) 处的堆高：取所有堆的最大值，用 smoothstep 让边缘自然
export function pileHeightP(prof: SceneProfile, x: number, z: number): number {
  let h = 0;
  for (const p of prof.piles) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < p.r) {
      const t = 1 - d / p.r;
      h = Math.max(h, p.h * t * t * (3 - 2 * t));   // smoothstep
    }
  }
  return h;
}
export function pileHeight(x: number, z: number): number {
  return pileHeightP(DEFAULT_PROFILE, x, z);
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function makePoints(positions: number[], colors: number[]): THREE.Points {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.036, sizeAttenuation: true, vertexColors: true,
  });
  return new THREE.Points(geo, mat);
}

export interface CloudGroup {
  group: THREE.Group;
  pilePoints: THREE.Points;   // 抽稀降级时只减粮堆
  pileFullCount: number;
}

export function buildPointCloud(prof: SceneProfile = DEFAULT_PROFILE): CloudGroup {
  const group = new THREE.Group();
  const { W, L, H } = prof;
  const area = (W * L) / (DEFAULT_PROFILE.W * DEFAULT_PROFILE.L);
  const maxPileH = Math.max(...prof.piles.map(p => p.h));

  // 地面 9000：pileHeight > 0.05 的丢弃（浅底：结构用浅灰蓝）
  {
    const pos: number[] = [], col: number[] = [];
    const base = new THREE.Color('#A9B3C0');
    let n = 0;
    while (n < Math.round(6000 * area)) {
      const x = rand(-W / 2, W / 2), z = rand(-L / 2, L / 2);
      if (pileHeightP(prof, x, z) > 0.05) continue;
      pos.push(x, Math.random() * 0.016, z);
      const b = rand(0.985, 1.015);
      col.push(base.r * b, base.g * b, base.b * b);
      n++;
    }
    group.add(makePoints(pos, col));
  }

  // 墙面 5200：越高越浅，向背景淡出
  {
    const pos: number[] = [], col: number[] = [];
    const base = new THREE.Color('#B4BdC9'.toLowerCase());
    for (let i = 0; i < Math.round(5200 * Math.sqrt(area)); i++) {
      const wall = Math.floor(Math.random() * 4);
      const y = Math.random() * H;
      const j = rand(-0.014, 0.014);
      let x = 0, z = 0;
      if (wall === 0) { x = -W / 2 + j; z = rand(-L / 2, L / 2); }
      else if (wall === 1) { x = W / 2 + j; z = rand(-L / 2, L / 2); }
      else if (wall === 2) { z = -L / 2 + j; x = rand(-W / 2, W / 2); }
      else { z = L / 2 + j; x = rand(-W / 2, W / 2); }
      pos.push(x, y, z);
      const b = 0.99 + y / 80;
      col.push(Math.min(1, base.r * b), Math.min(1, base.g * b), Math.min(1, base.b * b));
    }
    group.add(makePoints(pos, col));
  }

  // 立柱 900：圆柱，中心 (−W/2+1.5, L/2−2.2)，半径 0.26，高 6.4
  {
    const pos: number[] = [], col: number[] = [];
    const base = new THREE.Color('#8794A6');
    const cx = -W / 2 + 1.5, cz = L / 2 - 2.2;
    for (let i = 0; i < 900; i++) {
      const a = Math.random() * Math.PI * 2;
      pos.push(cx + Math.cos(a) * 0.26, Math.random() * H, cz + Math.sin(a) * 0.26);
      col.push(base.r, base.g, base.b);
    }
    group.add(makePoints(pos, col));
  }

  // 粮堆 26000：按高度插值，中性灰阶（低处深、顶部浅），把彩色留给标注
  let pilePoints: THREE.Points;
  let pileFullCount = 0;
  {
    const pos: number[] = [], col: number[] = [];
    const dark = new THREE.Color('#6F7480'), light = new THREE.Color('#CDD1D8');
    let n = 0;
    while (n < Math.round(26000 * area)) {
      const x = rand(-W / 2, W / 2), z = rand(-L / 2, L / 2);
      const h = pileHeightP(prof, x, z);
      if (h < 0.06) continue;
      pos.push(x, h + rand(-0.012, 0.012), z);
      const t = h / maxPileH;
      const k = t * t * 0.92 + 0.08;
      const c = dark.clone().lerp(light, Math.min(1, k));
      const b = rand(0.975, 1.025);
      col.push(c.r * b, c.g * b, c.b * b);
      n++;
    }
    pilePoints = makePoints(pos, col);
    pileFullCount = n;
    group.add(pilePoints);
  }

  return { group, pilePoints, pileFullCount };
}

// 堆体包围框：橙色线框
export function buildPileBoxes(prof: SceneProfile = DEFAULT_PROFILE): THREE.Group {
  const g = new THREE.Group();
  prof.piles.forEach((p, i) => {
    const box = new THREE.Box3(
      new THREE.Vector3(p.x - p.r, 0, p.z - p.r),
      new THREE.Vector3(p.x + p.r, p.h + 0.15, p.z + p.r),
    );
    const size = new THREE.Vector3(), center = new THREE.Vector3();
    box.getSize(size); box.getCenter(center);
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z));
    const line = new THREE.LineSegments(
      edges, new THREE.LineBasicMaterial({ color: '#E8792B', transparent: true, opacity: 0.9 }),
    );
    line.position.copy(center);
    line.userData.pileIdx = i;
    g.add(line);
  });
  return g;
}

// 点选用的不可见碰撞盒
export function buildPileHitboxes(prof: SceneProfile = DEFAULT_PROFILE): THREE.Group {
  const g = new THREE.Group();
  prof.piles.forEach((p, i) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(p.r * 2, p.h + 0.15, p.r * 2),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    mesh.position.set(p.x, (p.h + 0.15) / 2, p.z);
    mesh.userData.pileIdx = i;
    g.add(mesh);
  });
  return g;
}

// 堆体标签（sprite），默认关
export function buildPileLabels(names: string[], prof: SceneProfile = DEFAULT_PROFILE): THREE.Group {
  const g = new THREE.Group();
  prof.piles.forEach((p, i) => {
    const name = names[i] ?? `堆体 ${String.fromCharCode(65 + i)}`;
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 80;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fillRect(48, 8, 160, 52);
    ctx.strokeStyle = '#E8792B';
    ctx.strokeRect(48, 8, 160, 52);
    ctx.fillStyle = '#1B1F27';
    ctx.font = '30px -apple-system, "PingFang SC", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(name, 128, 35);
    const tex = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    sprite.scale.set(2.6, 0.8, 1);
    sprite.position.set(p.x, p.h + 0.8, p.z);
    g.add(sprite);
  });
  return g;
}
