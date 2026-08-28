// 场景搭建：点云 + 航线 + 轨迹 + 飞机 + 包围框 + 标签
// 另含 layer 1 的实体网格场景：机头相机（实时画面）渲染用，带光照，接近真实回传
import * as THREE from 'three';
import { buildPointCloud, buildPileBoxes, buildPileHitboxes, buildPileLabels, pileHeightP, profileOf, type SceneProfile } from './pointcloud';
import { buildRoutePath, sampleTrack, posAt, waypointRows, type RoutePath } from './route';

// 拍照点位标记贴图：相机图标
let camTexCache: THREE.CanvasTexture | null = null;
function cameraTexture(): THREE.CanvasTexture {
  if (camTexCache) return camTexCache;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.beginPath();
  ctx.arc(32, 32, 28, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,.95)';
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = '#4C6BC0';
  ctx.stroke();
  // 相机机身：细线框
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.roundRect(17, 25, 30, 20, 4.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(25.5, 19.5, 13, 6.5, 2);
  ctx.stroke();
  // 镜头
  ctx.beginPath();
  ctx.arc(32, 35, 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(32, 35, 2.2, 0, Math.PI * 2);
  ctx.fillStyle = '#4C6BC0';
  ctx.fill();
  camTexCache = new THREE.CanvasTexture(c);
  return camTexCache;
}

const CAM_LAYER = 1;

// 场景基底：网格地面 + 四周网格立面（同一地图场景基底一致，点云与航线置于其中）
function buildSceneShell(prof: SceneProfile): THREE.Group {
  const { W, L, H } = prof;
  const g = new THREE.Group();
  const soft: number[] = [];   // 网格线
  const edge: number[] = [];   // 轮廓线
  const STEP = 2;

  // 地面网格
  for (let x = -W / 2; x <= W / 2 + 0.01; x += STEP) {
    soft.push(x, 0.012, -L / 2, x, 0.012, L / 2);
  }
  for (let z = -L / 2; z <= L / 2 + 0.01; z += STEP) {
    soft.push(-W / 2, 0.012, z, W / 2, 0.012, z);
  }

  // 四面立面网格：竖线 + 横线
  const wall = (ax: 'x' | 'z', fixed: number) => {
    const span = ax === 'x' ? L : W;
    for (let s = -span / 2; s <= span / 2 + 0.01; s += STEP) {
      if (ax === 'x') soft.push(fixed, 0, s, fixed, H, s);
      else soft.push(s, 0, fixed, s, H, fixed);
    }
    for (let y = STEP; y < H; y += STEP) {
      if (ax === 'x') soft.push(fixed, y, -span / 2, fixed, y, span / 2);
      else soft.push(-span / 2, y, fixed, span / 2, y, fixed);
    }
  };
  wall('x', -W / 2); wall('x', W / 2);
  wall('z', -L / 2); wall('z', L / 2);

  // 轮廓：地脚线 + 顶沿线 + 四角立柱线
  const corners: [number, number][] = [[-W / 2, -L / 2], [W / 2, -L / 2], [W / 2, L / 2], [-W / 2, L / 2]];
  for (let i = 0; i < 4; i++) {
    const [x1, z1] = corners[i], [x2, z2] = corners[(i + 1) % 4];
    edge.push(x1, 0.012, z1, x2, 0.012, z2);
    edge.push(x1, H, z1, x2, H, z2);
    edge.push(x1, 0, z1, x1, H, z1);
  }

  const mk = (arr: number[], color: string, opacity: number) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      color, transparent: true, opacity,
    }));
  };
  g.add(mk(soft, '#C2CBDB', 0.38));
  g.add(mk(edge, '#9FACC4', 0.75));
  return g;
}

// 机头相机可见的实体场景：地面网格 + 堆体高度场 + 墙体 + 立柱
export function buildCameraMeshes(prof: SceneProfile): THREE.Group {
  const { W, L, H } = prof;
  const g = new THREE.Group();

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(W, L),
    new THREE.MeshStandardMaterial({ color: '#232830', roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  g.add(ground);

  const grid = new THREE.GridHelper(Math.max(W, L), 16, '#3A424F', '#2A303A');
  grid.position.y = 0.02;
  g.add(grid);

  // 堆体高度场
  const pileGeo = new THREE.PlaneGeometry(W, L, 90, 110);
  pileGeo.rotateX(-Math.PI / 2);
  {
    const pos = pileGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, pileHeightP(prof, x, z) + 0.015);
    }
    pileGeo.computeVertexNormals();
  }
  g.add(new THREE.Mesh(
    pileGeo,
    new THREE.MeshStandardMaterial({ color: '#8A8171', roughness: 0.95 }),
  ));

  // 墙体
  const wallMat = new THREE.MeshStandardMaterial({ color: '#2A303B', roughness: 0.9 });
  const mkWall = (w: number, d: number, x: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), wallMat);
    m.position.set(x, H / 2, z);
    g.add(m);
  };
  mkWall(0.12, L, -W / 2, 0);
  mkWall(0.12, L, W / 2, 0);
  mkWall(W, 0.12, 0, -L / 2);
  mkWall(W, 0.12, 0, L / 2);

  const col = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.26, H, 18),
    new THREE.MeshStandardMaterial({ color: '#3A414E', roughness: 0.8 }),
  );
  col.position.set(-W / 2 + 1.5, H / 2, L / 2 - 2.2);
  g.add(col);

  // 光照（同时照亮 layer 1）
  const hemi = new THREE.HemisphereLight('#9FB0CB', '#171B22', 1.0);
  const key = new THREE.DirectionalLight('#DCE4F5', 1.2);
  key.position.set(5, 9, 3);
  hemi.layers.enable(CAM_LAYER);
  key.layers.enable(CAM_LAYER);
  g.add(hemi, key);

  g.traverse(o => o.layers.set(CAM_LAYER));
  return g;
}

export interface SceneBundle {
  scene: THREE.Scene;
  cloud: THREE.Group;
  pilePoints: THREE.Points;
  pileFullCount: number;
  routeGroup: THREE.Group;
  trackLine: THREE.Line;
  trackCount: number;
  drone: THREE.Group;
  boxes: THREE.Group;
  hitboxes: THREE.Group;
  labels: THREE.Group;
  path: RoutePath;
  returnLine: THREE.Line;
  setTrackProg(prog: number): void;
  setDrone(prog: number): void;
  setDronePosition(pos: THREE.Vector3): void;
  setDroneVisible(v: boolean): void;
  selectPile(idx: number | null): void;
}

export function buildScene(opts: {
  waypointCount: number;
  altitudeM: number;
  highlightMinClearance: boolean;
  labelNames?: string[];
  sceneId?: string;
}): SceneBundle {
  const prof = profileOf(opts.sceneId);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#E9ECF1');
  scene.fog = new THREE.Fog('#E9ECF1', 42, 95);

  // 场景基底（网格立面）：同一场景地图基底恒定
  scene.add(buildSceneShell(prof));

  const { group: cloud, pilePoints, pileFullCount } = buildPointCloud(prof);
  scene.add(cloud);

  // 机头相机专用实体场景（layer 1，主视图不可见）
  scene.add(buildCameraMeshes(prof));

  const path = buildRoutePath(opts.waypointCount, opts.altitudeM, prof);

  // 航线：虚线
  const routeGroup = new THREE.Group();
  {
    const geo = new THREE.BufferGeometry().setFromPoints(path.pts);
    const line = new THREE.Line(geo, new THREE.LineDashedMaterial({
      color: '#5F7CC8', dashSize: 0.28, gapSize: 0.18, transparent: true, opacity: 0.85,
    }));
    line.computeLineDistances();
    routeGroup.add(line);

    // 航点小点：只标示教航点本体，航点间是平滑曲线
    const wpGeo = new THREE.BufferGeometry().setFromPoints(path.waypoints);
    routeGroup.add(new THREE.Points(wpGeo, new THREE.PointsMaterial({
      color: '#4C6BC0', size: 0.13, sizeAttenuation: true,
    })));

    // 拍照点位标记：悬浮在拍照航点上方的相机图标
    {
      const tex = cameraTexture();
      waypointRows(path, opts.waypointCount)
        .filter(w => w.isPhoto)
        .forEach(w => {
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true }));
          sprite.scale.set(0.44, 0.44, 1);
          sprite.position.set(w.x, w.y + 0.42, w.z);
          routeGroup.add(sprite);
        });
    }

    if (opts.highlightMinClearance) {
      // 橙色高亮航段 = 离堆顶最近的那一段
      const a = path.pts[path.minClearIdx], b = path.pts[path.minClearIdx + 1];
      const dir = b.clone().sub(a);
      const len = dir.length();
      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, len, 6),
        new THREE.MeshBasicMaterial({ color: '#E8792B' }),
      );
      cyl.position.copy(a.clone().add(b).multiplyScalar(0.5));
      cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      routeGroup.add(cyl);
    }
  }
  scene.add(routeGroup);

  // 已飞轨迹：深蓝实线（与计划航线的浅蓝虚线区分），drawRange 生长
  const trackCount = 300;
  const trackGeo = new THREE.BufferGeometry();
  trackGeo.setAttribute('position', new THREE.BufferAttribute(sampleTrack(path, trackCount), 3));
  trackGeo.setDrawRange(0, 0);
  const trackLine = new THREE.Line(trackGeo, new THREE.LineBasicMaterial({ color: '#33487E' }));
  scene.add(trackLine);

  // 返航路径：灰色虚线，仅返航态可见
  const returnGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(), new THREE.Vector3(),
  ]);
  const returnLine = new THREE.Line(returnGeo, new THREE.LineDashedMaterial({
    color: '#8A93A3', dashSize: 0.3, gapSize: 0.2, transparent: true, opacity: 0.9,
  }));
  returnLine.visible = false;
  scene.add(returnLine);

  // 飞机标记：迷你四旋翼（深灰机身 + 蓝色旋翼环）
  const drone = new THREE.Group();
  {
    const bodyMat = new THREE.MeshBasicMaterial({ color: '#3E4656' });
    const ringMat = new THREE.MeshBasicMaterial({ color: '#4C6BC0' });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.28), bodyMat);
    drone.add(body);
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sz]) => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.025, 0.035), bodyMat);
      arm.position.set(sx * 0.17, 0.02, sz * 0.2);
      arm.rotation.y = -Math.atan2(sz, sx);
      drone.add(arm);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.014, 6, 22), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(sx * 0.26, 0.045, sz * 0.3);
      drone.add(ring);
    });
    // 位置投影线（对地）
    const beam = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -8, 0)]),
      new THREE.LineBasicMaterial({ color: '#4C6BC0', transparent: true, opacity: 0.22 }),
    );
    drone.add(beam);
  }
  drone.visible = false;
  scene.add(drone);

  const boxes = buildPileBoxes(prof);
  boxes.visible = true;
  scene.add(boxes);

  const hitboxes = buildPileHitboxes(prof);
  scene.add(hitboxes);

  const labels = buildPileLabels(opts.labelNames ?? ['堆体 A', '堆体 B', '堆体 C'], prof);
  labels.visible = false;
  scene.add(labels);

  return {
    scene, cloud, pilePoints, pileFullCount, routeGroup, trackLine, trackCount,
    drone, boxes, hitboxes, labels, path, returnLine,
    setTrackProg(prog: number) {
      trackGeo.setDrawRange(0, Math.max(0, Math.min(trackCount, Math.round(prog * trackCount))));
    },
    setDrone(prog: number) {
      const { pos, dir } = posAt(path, prog);
      drone.position.copy(pos);
      drone.rotation.y = Math.atan2(dir.x, dir.z);
    },
    setDronePosition(pos: THREE.Vector3) {
      drone.position.copy(pos);
    },
    setDroneVisible(v: boolean) { drone.visible = v; },
    selectPile(idx: number | null) {
      boxes.children.forEach((c, i) => {
        c.visible = idx === null ? true : i === idx;
        (c as THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>)
          .material.opacity = idx === i ? 1 : 0.9;
      });
    },
  };
}
