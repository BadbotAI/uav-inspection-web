// 单 renderer 双视口渲染（主视图 + 画中画），停障时主副互换
import * as THREE from 'three';
import { buildScene, type SceneBundle } from './scene';
import { OrbitControl, DEFAULT_VIEW, TOP_VIEW } from './orbit';
import { profileOf, DEFAULT_PROFILE } from './pointcloud';
import { posAt } from './route';

export type ViewPreset = 'top' | 'iso' | 'follow';

export interface EngineOpts {
  waypointCount: number;
  altitudeM: number;
  sceneId?: string;
  highlightMinClearance?: boolean;
  pip?: boolean;                       // 是否渲染画中画（执行态）
  pipCanvas?: HTMLCanvasElement;       // 画中画独立画布（CSS 圆角可真实裁剪）
  labelNames?: string[];
  onSelectPile?: (idx: number | null) => void;
  onDegrade?: () => void;              // 帧率降级回调
  onUserOrbit?: () => void;            // 用户手动操作（退出跟随）
}

export class Engine {
  static SCENE_BG = '#E9ECF1';
  static CAM_BG = '#10131A';
  bundle: SceneBundle;
  orbit: OrbitControl;
  preset: ViewPreset = 'iso';
  swapped = false;                     // 停障：画中画与主视图互换
  private renderer: THREE.WebGLRenderer;
  private pipRenderer: THREE.WebGLRenderer | null = null;
  private mainCam: THREE.PerspectiveCamera;
  private pipCam: THREE.PerspectiveCamera;
  private canvas: HTMLCanvasElement;
  private opts: EngineOpts;
  private raf = 0;
  private droneProg = 0;
  private raycaster = new THREE.Raycaster();
  private lowFpsSince: number | null = null;
  private degraded = false;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, opts: EngineOpts) {
    this.canvas = canvas;
    this.opts = opts;
    this.bundle = buildScene({
      waypointCount: opts.waypointCount,
      altitudeM: opts.altitudeM,
      highlightMinClearance: !!opts.highlightMinClearance,
      labelNames: opts.labelNames,
      sceneId: opts.sceneId,
    });
    // 大场景按比例拉远默认视距
    const prof = profileOf(opts.sceneId);
    this.viewScale = Math.max(prof.W / DEFAULT_PROFILE.W, prof.L / DEFAULT_PROFILE.L, 1);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    if (opts.pip && opts.pipCanvas) {
      this.pipRenderer = new THREE.WebGLRenderer({ canvas: opts.pipCanvas, antialias: true });
      this.pipRenderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    }
    this.mainCam = new THREE.PerspectiveCamera(52, 1, 0.1, 200);
    this.pipCam = new THREE.PerspectiveCamera(62, 1.4, 0.05, 200);
    // 机头相机只看实体网格场景（layer 1）：实时画面呈现 3D 渲染观感
    this.pipCam.layers.set(1);
    this.orbit = new OrbitControl(canvas);
    this.orbit.onInteract = () => {
      if (this.preset === 'follow') { this.preset = 'iso'; opts.onUserOrbit?.(); }
    };
    this.orbit.onTap = (x, y) => this.pick(x, y);
    this.resize();
    this.loop(performance.now());
  }

  private viewScale = 1;

  setPreset(p: ViewPreset) {
    this.preset = p;
    if (p === 'top') this.orbit.setView({ ...TOP_VIEW, dist: TOP_VIEW.dist * this.viewScale });
    if (p === 'iso') this.orbit.setView({ ...DEFAULT_VIEW, dist: DEFAULT_VIEW.dist * this.viewScale });
  }

  setLayers(l: { cloud?: boolean; route?: boolean; track?: boolean; boxes?: boolean; labels?: boolean }) {
    const b = this.bundle;
    if (l.cloud !== undefined) b.cloud.visible = l.cloud;
    if (l.route !== undefined) b.routeGroup.visible = l.route;
    if (l.track !== undefined) b.trackLine.visible = l.track;
    if (l.boxes !== undefined) b.boxes.visible = l.boxes;
    if (l.labels !== undefined) b.labels.visible = l.labels;
  }

  setFlight(prog: number, droneVisible: boolean, liftT = 1) {
    this.droneProg = prog;
    this.bundle.setTrackProg(liftT < 1 ? 0 : prog);
    this.bundle.setDrone(prog);
    if (liftT < 1) {
      // 起飞爬升：从起降点垂直升到航线高度
      const home = this.bundle.path.pts[0].clone();
      const e = liftT * liftT * (3 - 2 * liftT);
      home.y = 0.25 + (home.y - 0.25) * e;
      this.bundle.setDronePosition(home);
    }
    this.bundle.setDroneVisible(droneVisible);
  }

  setReturnPath(fromProg: number) {
    const { pos } = posAt(this.bundle.path, fromProg);
    const home = this.bundle.path.pts[0];
    const geo = this.bundle.returnLine.geometry;
    geo.setFromPoints([pos, home.clone()]);
    (this.bundle.returnLine as THREE.Line).computeLineDistances();
    this.bundle.returnLine.visible = true;
  }

  // 返航中：沿原航线回溯到起点，末段降高（航线闭环，终点即起点）
  setReturnPose(fromProg: number, t: number) {
    const k = Math.max(0, Math.min(1, t));
    const p = fromProg * (1 - k);
    const { pos } = posAt(this.bundle.path, p);
    const target = pos.clone();
    if (k > 0.85) target.y = pos.y * (1 - (k - 0.85) / 0.15 * 0.92);
    this.bundle.setDronePosition(target);
    // 轨迹随回溯收缩
    this.bundle.setTrackProg(p);
  }

  hideReturnPath() { this.bundle.returnLine.visible = false; }

  setSwapped(s: boolean) { this.swapped = s; }

  selectPile(idx: number | null) { this.bundle.selectPile(idx); }

  private pick(cx: number, cy: number) {
    if (!this.opts.onSelectPile) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = ((cx - rect.left) / rect.width) * 2 - 1;
    const y = -((cy - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.mainCam);
    const hits = this.raycaster.intersectObjects(this.bundle.hitboxes.children, false);
    this.opts.onSelectPile(hits.length ? (hits[0].object.userData.pileIdx as number) : null);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    this.renderer.setSize(rect.width, rect.height, false);
    this.mainCam.aspect = rect.width / rect.height;
    this.mainCam.updateProjectionMatrix();
    if (this.pipRenderer && this.opts.pipCanvas) {
      const pr = this.opts.pipCanvas.getBoundingClientRect();
      if (pr.width > 0 && pr.height > 0) {
        this.pipRenderer.setSize(pr.width, pr.height, false);
        this.pipCam.aspect = pr.width / pr.height;
        this.pipCam.updateProjectionMatrix();
      }
    }
  }

  private updateCams() {
    // 跟随相机：位于飞机后上方
    if (this.preset === 'follow') {
      const { dir } = posAt(this.bundle.path, this.droneProg);
      const pos = this.bundle.drone.position;
      const back = dir.clone().multiplyScalar(-4.2);
      this.mainCam.position.copy(pos).add(back).add(new THREE.Vector3(0, 2.4, 0));
      this.mainCam.lookAt(pos);
    } else {
      this.orbit.applyTo(this.mainCam);
    }
    // 画中画相机：放在飞机位置、朝飞行方向前下方看（模拟机头相机）
    const { dir } = posAt(this.bundle.path, this.droneProg);
    const pos = this.bundle.drone.position;
    this.pipCam.position.copy(pos);
    const look = pos.clone().add(dir.clone().multiplyScalar(3)).add(new THREE.Vector3(0, -2.1, 0));
    this.pipCam.lookAt(look);
  }

  private loop = (t: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const w = this.canvas.width / this.renderer.getPixelRatio();
    const h = this.canvas.height / this.renderer.getPixelRatio();
    if (w === 0 || h === 0) return;

    this.updateCams();

    // 机头相机（实时画面）用深色底，模拟相机观感；点云视图用浅色底
    const setBg = (dark: boolean) => {
      const c = dark ? Engine.CAM_BG : Engine.SCENE_BG;
      (this.bundle.scene.background as THREE.Color).set(c);
      this.bundle.scene.fog?.color.set(c);
    };

    // 主画布与画中画画布各渲染一台相机；停障/手动互换时对调
    const mainCamNow = this.swapped ? this.pipCam : this.mainCam;
    const pipCamNow = this.swapped ? this.mainCam : this.pipCam;

    setBg(mainCamNow === this.pipCam);
    mainCamNow.aspect = w / h;
    mainCamNow.updateProjectionMatrix();
    this.renderer.render(this.bundle.scene, mainCamNow);

    if (this.pipRenderer && this.opts.pipCanvas) {
      const pr = this.opts.pipCanvas;
      const pw2 = pr.clientWidth, ph2 = pr.clientHeight;
      if (pw2 > 0 && ph2 > 0) {
        setBg(pipCamNow === this.pipCam);
        pipCamNow.aspect = pw2 / ph2;
        pipCamNow.updateProjectionMatrix();
        this.pipRenderer.render(this.bundle.scene, pipCamNow);
      }
    }
    setBg(false);

    // 帧率监控：<20 FPS 持续 2s → 抽稀粮堆点
    const dt = t - (this.lastT || t);
    this.lastT = t;
    if (dt > 0) {
      const fps = 1000 / dt;
      if (fps < 20) {
        if (this.lowFpsSince === null) this.lowFpsSince = t;
        else if (t - this.lowFpsSince > 2000 && !this.degraded) {
          this.degraded = true;
          this.bundle.pilePoints.geometry.setDrawRange(0, Math.round(this.bundle.pileFullCount * 0.55));
          this.opts.onDegrade?.();
        }
      } else {
        this.lowFpsSince = null;
      }
    }
  };
  private lastT = 0;

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.orbit.dispose();
    this.bundle.scene.traverse(o => {
      const any = o as THREE.Mesh;
      if (any.geometry) any.geometry.dispose();
      const mat = (any as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach(m => m.dispose());
      else mat?.dispose();
    });
    this.renderer.dispose();
    this.pipRenderer?.dispose();
  }
}
