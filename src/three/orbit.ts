// 手写轨道控制（不用 OrbitControls）
// 约束：俯仰角 5°–83°；距离 9m–46m；平移限制在场景包围盒 ×1.5 内；双击复位
import * as THREE from 'three';
import { W, L, H } from './pointcloud';

const DEG = Math.PI / 180;
const PITCH_MIN = 5 * DEG, PITCH_MAX = 83 * DEG;
const DIST_MIN = 9, DIST_MAX = 46;
const PAN_X = (W / 2) * 1.5, PAN_Z = (L / 2) * 1.5;

export const DEFAULT_VIEW = { yaw: 45 * DEG, pitch: 42 * DEG, dist: 23, tx: 0, ty: 1.4, tz: 0 };
export const TOP_VIEW = { yaw: 45 * DEG, pitch: 83 * DEG, dist: 26, tx: 0, ty: 0, tz: 0 };

export class OrbitControl {
  yaw = DEFAULT_VIEW.yaw;
  pitch = DEFAULT_VIEW.pitch;
  dist = DEFAULT_VIEW.dist;
  target = new THREE.Vector3(DEFAULT_VIEW.tx, DEFAULT_VIEW.ty, DEFAULT_VIEW.tz);
  enabled = true;
  onInteract: (() => void) | null = null;   // 用户手动操作时通知（退出跟随模式）
  onTap: ((x: number, y: number) => void) | null = null;
  onDoubleTap: (() => void) | null = null;

  private el: HTMLElement;
  private pointers = new Map<number, { x: number; y: number }>();
  private lastPinch = 0;
  private downAt = 0;
  private downPos = { x: 0, y: 0 };
  private moved = false;
  private lastTapAt = 0;

  constructor(el: HTMLElement) {
    this.el = el;
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    el.addEventListener('wheel', this.onWheel, { passive: false });
  }

  dispose() {
    this.el.removeEventListener('pointerdown', this.onDown);
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerup', this.onUp);
    this.el.removeEventListener('pointercancel', this.onUp);
    this.el.removeEventListener('wheel', this.onWheel);
  }

  reset() {
    this.yaw = DEFAULT_VIEW.yaw; this.pitch = DEFAULT_VIEW.pitch; this.dist = DEFAULT_VIEW.dist;
    this.target.set(DEFAULT_VIEW.tx, DEFAULT_VIEW.ty, DEFAULT_VIEW.tz);
  }

  setView(v: { yaw: number; pitch: number; dist: number; tx: number; ty: number; tz: number }) {
    this.yaw = v.yaw; this.pitch = v.pitch; this.dist = v.dist;
    this.target.set(v.tx, v.ty, v.tz);
  }

  applyTo(cam: THREE.PerspectiveCamera) {
    const x = this.target.x + this.dist * Math.cos(this.pitch) * Math.sin(this.yaw);
    const y = this.target.y + this.dist * Math.sin(this.pitch);
    const z = this.target.z + this.dist * Math.cos(this.pitch) * Math.cos(this.yaw);
    cam.position.set(x, y, z);
    cam.lookAt(this.target);
  }

  private clamp() {
    this.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, this.pitch));
    this.dist = Math.max(DIST_MIN, Math.min(DIST_MAX, this.dist));
    this.target.x = Math.max(-PAN_X, Math.min(PAN_X, this.target.x));
    this.target.z = Math.max(-PAN_Z, Math.min(PAN_Z, this.target.z));
    this.target.y = Math.max(0, Math.min(H, this.target.y));
  }

  private onDown = (e: PointerEvent) => {
    if (!this.enabled) return;
    this.el.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) {
      this.downAt = performance.now();
      this.downPos = { x: e.clientX, y: e.clientY };
      this.moved = false;
    }
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.lastPinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };

  private onMove = (e: PointerEvent) => {
    if (!this.enabled || !this.pointers.has(e.pointerId)) return;
    const prev = this.pointers.get(e.pointerId)!;
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (Math.hypot(e.clientX - this.downPos.x, e.clientY - this.downPos.y) > 7) this.moved = true;

    if (this.pointers.size === 1) {
      // 单指拖拽：绕场景中心轨道旋转
      this.yaw -= dx * 0.0075;
      this.pitch += dy * 0.006;
      this.clamp();
      if (this.moved) this.onInteract?.();
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const pinch = Math.hypot(a.x - b.x, a.y - b.y);
      const dPinch = pinch - this.lastPinch;
      if (Math.abs(dPinch) > 2) {
        // 双指捏合：缩放
        this.dist *= 1 - dPinch * 0.006;
        this.lastPinch = pinch;
      } else {
        // 双指拖拽：平移视点
        const k = this.dist * 0.0011;
        const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
        const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
        this.target.addScaledVector(right, -dx * k);
        this.target.addScaledVector(fwd, -dy * k);
      }
      this.clamp();
      this.onInteract?.();
    }
  };

  private onUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0 && !this.moved && performance.now() - this.downAt < 350) {
      const now = performance.now();
      if (now - this.lastTapAt < 300) {
        // 双击空白：复位默认视角
        this.reset();
        this.onDoubleTap?.();
        this.lastTapAt = 0;
      } else {
        this.lastTapAt = now;
        this.onTap?.(e.clientX, e.clientY);
      }
    }
  };

  private onWheel = (e: WheelEvent) => {
    if (!this.enabled) return;
    e.preventDefault();
    this.dist *= 1 + e.deltaY * 0.0012;
    this.clamp();
    this.onInteract?.();
  };
}
