// 场景实景快照：离屏渲染实体网格场景一次，供历史卡片缩略图使用
import * as THREE from 'three';
import { buildCameraMeshes } from './scene';
import { DEFAULT_PROFILE } from './pointcloud';

let cache: string | null = null;

export function sceneSnapshot(): string {
  if (cache) return cache;
  try {
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(280, 210);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#171B23');

    const meshes = buildCameraMeshes(DEFAULT_PROFILE);
    // 快照用默认图层渲染
    meshes.traverse(o => o.layers.set(0));
    scene.add(meshes);

    const cam = new THREE.PerspectiveCamera(46, 280 / 210, 0.1, 100);
    cam.position.set(8.5, 6.5, 10.5);
    cam.lookAt(-0.5, 0.6, 0);
    cam.layers.set(0);

    renderer.render(scene, cam);
    cache = renderer.domElement.toDataURL('image/jpeg', 0.85);

    scene.traverse(o => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach(x => x.dispose());
      else mat?.dispose();
    });
    renderer.dispose();
  } catch {
    cache = '';
  }
  return cache;
}
