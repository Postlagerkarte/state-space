// The state-space visualization: every search node is an instanced glowing sphere,
// every parent->child discovery an edge. Depth maps to distance from the center,
// so a breadth-first search literally expands as a growing sphere of light.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const KIND_FRONTIER = 0;
export const KIND_EXPLORED = 1;
export const KIND_GOAL = 2;
export const KIND_PATH = 3;

const KIND_COLORS = [
  new THREE.Color(0x59e3ff), // frontier: bright cyan
  new THREE.Color(0x2d3c76), // explored: dim indigo
  new THREE.Color(0xffd166), // goal: gold
  new THREE.Color(0xffb703), // path: amber
];
const KIND_SCALES = [1, 1, 2.4, 1.7];
const FLASH_COLOR = new THREE.Color(0xff4d6d);

const RADIUS_STEP = 1.6;
const SPAWN_DUR = 0.25;
const FLASH_DUR = 0.45;

export interface GraphViewOptions {
  maxNodes?: number;
  bloom?: boolean;
}

export class GraphView {
  readonly capacity: number;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private observer: ResizeObserver;

  private mesh: THREE.InstancedMesh;
  private positions: Float32Array;
  private dirs: Float32Array;
  private kinds: Uint8Array;
  private count = 0;

  private edgeGeo = new THREE.BufferGeometry();
  private edgePos: Float32Array;
  private edgeCount = 0;
  private pathLine: THREE.Line | null = null;

  private spawns: { id: number; t: number }[] = [];
  private flashes: { id: number; t: number }[] = [];
  private maxRadius = 0;
  private lastInteract = -10;
  private time = 0;

  private dummy = new THREE.Matrix4();
  private tmpColor = new THREE.Color();

  constructor(
    private container: HTMLElement,
    opts: GraphViewOptions = {},
  ) {
    this.capacity = opts.maxNodes ?? 60_000;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x0a0e1a);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 4000);
    this.camera.position.set(0, 4, 16);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.7;
    this.controls.addEventListener('start', () => (this.lastInteract = this.time));
    this.controls.addEventListener('end', () => (this.lastInteract = this.time));

    const nodeGeo = new THREE.IcosahedronGeometry(0.16, 1);
    const nodeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(nodeGeo, nodeMat, this.capacity);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(this.capacity * 3),
      3,
    );
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.mesh);

    this.positions = new Float32Array(this.capacity * 3);
    this.dirs = new Float32Array(this.capacity * 3);
    this.kinds = new Uint8Array(this.capacity);

    this.edgePos = new Float32Array(this.capacity * 6);
    this.edgeGeo.setAttribute('position', new THREE.BufferAttribute(this.edgePos, 3));
    this.edgeGeo.setDrawRange(0, 0);
    const edges = new THREE.LineSegments(
      this.edgeGeo,
      new THREE.LineBasicMaterial({ color: 0x33406e, transparent: true, opacity: 0.38 }),
    );
    edges.frustumCulled = false;
    this.scene.add(edges);

    if (opts.bloom !== false) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.95, 0.6, 0.12);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
    }

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
  }

  get full(): boolean {
    return this.count >= this.capacity;
  }

  get nodeCount(): number {
    return this.count;
  }

  /** Node ids must arrive in sequential order (they are solver node ids). */
  addNode(id: number, parentId: number, depth: number): void {
    if (id >= this.capacity) return;

    let x = 0;
    let y = 0;
    let z = 0;
    if (parentId >= 0) {
      // Direction: parent's direction, perturbed - children fan outward organically.
      let dx: number;
      let dy: number;
      let dz: number;
      if (parentId === 0) {
        dx = Math.random() * 2 - 1;
        dy = Math.random() * 2 - 1;
        dz = Math.random() * 2 - 1;
      } else {
        const spread = 0.45;
        dx = this.dirs[parentId * 3] + (Math.random() * 2 - 1) * spread;
        dy = this.dirs[parentId * 3 + 1] + (Math.random() * 2 - 1) * spread;
        dz = this.dirs[parentId * 3 + 2] + (Math.random() * 2 - 1) * spread;
      }
      const len = Math.hypot(dx, dy, dz) || 1;
      dx /= len;
      dy /= len;
      dz /= len;
      this.dirs[id * 3] = dx;
      this.dirs[id * 3 + 1] = dy;
      this.dirs[id * 3 + 2] = dz;

      const r = depth * RADIUS_STEP + (Math.random() - 0.5) * 0.5;
      x = dx * r;
      y = dy * r;
      z = dz * r;
      if (r > this.maxRadius) this.maxRadius = r;
    }
    this.positions[id * 3] = x;
    this.positions[id * 3 + 1] = y;
    this.positions[id * 3 + 2] = z;
    this.kinds[id] = KIND_FRONTIER;

    this.dummy.makeScale(0.01, 0.01, 0.01);
    this.dummy.setPosition(x, y, z);
    this.mesh.setMatrixAt(id, this.dummy);
    this.mesh.setColorAt(id, KIND_COLORS[KIND_FRONTIER]);
    this.count = Math.max(this.count, id + 1);
    this.mesh.count = this.count;
    this.spawns.push({ id, t: 0 });

    if (parentId >= 0) {
      const e = this.edgeCount * 6;
      this.edgePos[e] = this.positions[parentId * 3];
      this.edgePos[e + 1] = this.positions[parentId * 3 + 1];
      this.edgePos[e + 2] = this.positions[parentId * 3 + 2];
      this.edgePos[e + 3] = x;
      this.edgePos[e + 4] = y;
      this.edgePos[e + 5] = z;
      this.edgeCount++;
      this.edgeGeo.setDrawRange(0, this.edgeCount * 2);
      this.edgeGeo.attributes.position.needsUpdate = true;
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  setKind(id: number, kind: number): void {
    if (id >= this.count) return;
    // never downgrade goal/path markings
    if ((this.kinds[id] === KIND_GOAL || this.kinds[id] === KIND_PATH) && kind === KIND_EXPLORED) {
      return;
    }
    this.kinds[id] = kind;
    this.mesh.setColorAt(id, KIND_COLORS[kind]);
    const s = KIND_SCALES[kind];
    this.dummy.makeScale(s, s, s);
    this.dummy.setPosition(
      this.positions[id * 3],
      this.positions[id * 3 + 1],
      this.positions[id * 3 + 2],
    );
    this.mesh.setMatrixAt(id, this.dummy);
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  markExpanded(id: number): void {
    this.setKind(id, KIND_EXPLORED);
  }

  flash(id: number): void {
    if (id >= this.count) return;
    this.flashes.push({ id, t: 0 });
    this.mesh.setColorAt(id, FLASH_COLOR);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /** Highlight the root-to-goal chain in gold and draw the solution polyline. */
  tracePath(ids: number[]): void {
    for (const id of ids) this.setKind(id, KIND_PATH);
    const goal = ids[ids.length - 1];
    if (goal !== undefined) this.setKind(goal, KIND_GOAL);

    const pts: THREE.Vector3[] = ids
      .filter((id) => id < this.count)
      .map(
        (id) =>
          new THREE.Vector3(
            this.positions[id * 3],
            this.positions[id * 3 + 1],
            this.positions[id * 3 + 2],
          ),
      );
    if (this.pathLine) this.scene.remove(this.pathLine);
    this.pathLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0xffc933, transparent: true, opacity: 0.95 }),
    );
    this.pathLine.frustumCulled = false;
    this.scene.add(this.pathLine);
  }

  /** Raycast a node under the pointer; returns its id or null. */
  pick(clientX: number, clientY: number): number | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hits = ray.intersectObject(this.mesh);
    for (const hit of hits) {
      if (hit.instanceId !== undefined && hit.instanceId < this.count) return hit.instanceId;
    }
    return null;
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  reset(): void {
    this.count = 0;
    this.mesh.count = 0;
    this.edgeCount = 0;
    this.edgeGeo.setDrawRange(0, 0);
    if (this.pathLine) {
      this.scene.remove(this.pathLine);
      this.pathLine = null;
    }
    this.spawns = [];
    this.flashes = [];
    this.maxRadius = 0;
  }

  frame(dt: number): void {
    this.time += dt;

    if (this.spawns.length > 0) {
      for (let i = this.spawns.length - 1; i >= 0; i--) {
        const s = this.spawns[i];
        s.t += dt;
        const k = Math.min(1, s.t / SPAWN_DUR);
        const base = KIND_SCALES[this.kinds[s.id]];
        const sc = Math.max(0.01, base * (k * k * (3 - 2 * k)));
        this.dummy.makeScale(sc, sc, sc);
        this.dummy.setPosition(
          this.positions[s.id * 3],
          this.positions[s.id * 3 + 1],
          this.positions[s.id * 3 + 2],
        );
        this.mesh.setMatrixAt(s.id, this.dummy);
        if (k >= 1) this.spawns.splice(i, 1);
      }
      this.mesh.instanceMatrix.needsUpdate = true;
    }

    if (this.flashes.length > 0) {
      for (let i = this.flashes.length - 1; i >= 0; i--) {
        const f = this.flashes[i];
        f.t += dt;
        const k = Math.min(1, f.t / FLASH_DUR);
        this.tmpColor.copy(FLASH_COLOR).lerp(KIND_COLORS[this.kinds[f.id]], k);
        this.mesh.setColorAt(f.id, this.tmpColor);
        if (k >= 1) this.flashes.splice(i, 1);
      }
      if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }

    // gently zoom out as the galaxy grows (paused while the user is orbiting)
    if (this.time - this.lastInteract > 3) {
      const desired = Math.max(15, this.maxRadius * 2.3);
      const len = this.camera.position.length();
      const next = len + (desired - len) * Math.min(1, dt * 1.4);
      this.camera.position.setLength(next);
    }

    this.controls.update();
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.bloomPass?.resolution.set(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.observer.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
