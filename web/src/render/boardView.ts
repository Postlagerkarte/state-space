// 3D rendering of a puzzle board: walls, floor tiles, goal markers and the
// colored pieces (a nod to the crate textures of the original WPF app).
// The view is layout-driven so it can render both the classic 8x8 board and
// the larger glide boards with interior walls.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Minimal placement shape shared by classic and glide states. */
export interface ViewPlacement {
  piece: string;
  index: number;
}

export type ViewState = ViewPlacement[]; // element 0 is the hero

export interface BoardLayout {
  width: number;
  height: number;
  walls: number[];
  goalCells: number[];
  cells(p: ViewPlacement): number[];
  color(p: ViewPlacement): number;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

interface SlideTween {
  group: THREE.Group;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  t: number;
  dur: number;
  glide: boolean; // accelerate into the impact instead of easing out
  ghostClock: number;
  onDone?: () => void;
}

interface ScaleTween {
  group: THREE.Group;
  from: number;
  to: number;
  t: number;
  dur: number;
  onDone?: () => void;
}

export interface BoardViewOptions {
  interactive?: boolean;
  onPieceClick?: (pieceIdx: number | null) => void;
}

export class BoardView {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls | null = null;
  private observer: ResizeObserver;

  private cubeGeo = new RoundedBoxGeometry(0.92, 0.72, 0.92, 3, 0.1);
  private wallGeo = new RoundedBoxGeometry(0.98, 0.9, 0.98, 3, 0.08);

  private pieceGroups: THREE.Group[] = [];
  private goalMaterials: THREE.MeshStandardMaterial[] = [];
  private state: ViewState | null = null;

  private slides: SlideTween[] = [];
  private scales: ScaleTween[] = [];
  private shakes: { group: THREE.Group; t: number }[] = [];
  private punches: { group: THREE.Group; axis: 'x' | 'z'; t: number }[] = [];
  private hint: { arrow: THREE.ArrowHelper; baseY: number; t: number } | null = null;
  private ghosts: { group: THREE.Group; mat: THREE.MeshBasicMaterial; t: number }[] = [];
  private dusts: { points: THREE.Points; vels: Float32Array; mat: THREE.PointsMaterial; t: number }[] = [];
  private confettiSys: {
    mesh: THREE.InstancedMesh;
    pos: Float32Array;
    vel: Float32Array;
    spin: Float32Array;
    t: number;
  } | null = null;
  private camShake = 0;
  private selected = -1;
  private time = 0;
  private celebrateT = -1;

  private downAt: { x: number; y: number; t: number } | null = null;

  constructor(
    private container: HTMLElement,
    private layout: BoardLayout,
    private opts: BoardViewOptions = {},
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    const fit = Math.max(layout.width, layout.height);
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    this.camera.position.set(0, 1.16 * fit + 0.5, 0.88 * fit + 0.5);
    this.camera.lookAt(0, 0, 0.2);

    if (opts.interactive) {
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.enablePan = false;
      this.controls.minDistance = fit * 0.8;
      this.controls.maxDistance = fit * 2.2;
      this.controls.maxPolarAngle = Math.PI * 0.42;
      this.controls.target.set(0, 0, 0.2);
    }

    this.buildStaticBoard();
    this.buildLights(fit);

    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      this.downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    this.renderer.domElement.addEventListener('pointerup', (e) => {
      if (!this.opts.onPieceClick || !this.downAt) return;
      const moved = Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y);
      const elapsed = performance.now() - this.downAt.t;
      this.downAt = null;
      if (moved > 6 || elapsed > 500) return; // it was an orbit drag
      this.opts.onPieceClick(this.pickAt(e.clientX, e.clientY));
    });

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
  }

  get domElement(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  private cellX(cell: number): number {
    return (cell % this.layout.width) - (this.layout.width - 1) / 2;
  }

  private cellZ(cell: number): number {
    return ((cell / this.layout.width) | 0) - (this.layout.height - 1) / 2;
  }

  private buildLights(fit: number): void {
    this.scene.add(new THREE.HemisphereLight(0xbdd4ff, 0x232838, 1.1));
    const sun = new THREE.DirectionalLight(0xfff2dd, 2.2);
    sun.position.set(0.55 * fit, 1.25 * fit, 0.45 * fit);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const bound = fit * 0.85;
    sun.shadow.camera.left = -bound;
    sun.shadow.camera.right = bound;
    sun.shadow.camera.top = bound;
    sun.shadow.camera.bottom = -bound;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
  }

  private buildStaticBoard(): void {
    const { width, height, walls, goalCells } = this.layout;
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.7, 0.4, height + 0.7),
      new THREE.MeshStandardMaterial({ color: 0x11151f, roughness: 1 }),
    );
    base.position.y = -0.21;
    base.receiveShadow = true;
    this.scene.add(base);

    const wallSet = new Set(walls);
    const goalSet = new Set(goalCells);
    const tileGeo = new THREE.BoxGeometry(0.94, 0.1, 0.94);
    const tileMat = new THREE.MeshStandardMaterial({ color: 0x1b2233, roughness: 0.95 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x39415a, roughness: 0.9 });

    for (let cell = 0; cell < width * height; cell++) {
      if (wallSet.has(cell)) {
        const wall = new THREE.Mesh(this.wallGeo, wallMat);
        // tiny deterministic height variance so the wall ring reads as hand-built
        const h = 0.86 + (((cell * 2654435761) >>> 28) / 15) * 0.12;
        wall.scale.y = h;
        wall.position.set(this.cellX(cell), 0.45 * h, this.cellZ(cell));
        wall.castShadow = true;
        wall.receiveShadow = true;
        this.scene.add(wall);
      } else {
        const isGoal = goalSet.has(cell);
        const mat = isGoal
          ? new THREE.MeshStandardMaterial({
              color: 0x4a3a14,
              roughness: 0.6,
              emissive: 0xffb703,
              emissiveIntensity: 0.35,
            })
          : tileMat;
        const tile = new THREE.Mesh(tileGeo, mat);
        tile.position.set(this.cellX(cell), 0.0, this.cellZ(cell));
        tile.receiveShadow = true;
        this.scene.add(tile);
        if (isGoal) this.goalMaterials.push(mat as THREE.MeshStandardMaterial);
      }
    }
  }

  private buildPieceMeshes(group: THREE.Group, p: ViewPlacement, pieceIdx: number): void {
    const mat = group.userData.material as THREE.MeshStandardMaterial;
    const { width } = this.layout;
    const aR = (p.index / width) | 0;
    const aC = p.index % width;
    for (const cell of this.layout.cells(p)) {
      const dr = ((cell / width) | 0) - aR;
      const dc = (cell % width) - aC;
      const mesh = new THREE.Mesh(this.cubeGeo, mat);
      mesh.position.set(dc, 0.46, dr);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.pieceIdx = pieceIdx;
      group.add(mesh);
    }
  }

  private buildPieceGroup(p: ViewPlacement, pieceIdx: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(this.cellX(p.index), 0, this.cellZ(p.index));
    group.userData.pieceIdx = pieceIdx;

    const color = this.layout.color(p);
    const hero = pieceIdx === 0;
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.42,
      metalness: 0.08,
      emissive: color,
      emissiveIntensity: hero ? 0.3 : 0.07,
    });
    group.userData.material = mat;
    group.userData.baseEmissive = mat.emissiveIntensity;
    this.buildPieceMeshes(group, p, pieceIdx);
    return group;
  }

  /** Replace the whole level: rebuild every piece. */
  setLevel(state: ViewState): void {
    for (const g of this.pieceGroups) {
      this.scene.remove(g);
      (g.userData.material as THREE.Material).dispose();
    }
    this.pieceGroups = [];
    this.slides = [];
    this.scales = [];
    this.shakes = [];
    this.punches = [];
    for (const g of this.ghosts) {
      this.scene.remove(g.group);
      g.mat.dispose();
    }
    this.ghosts = [];
    for (const d of this.dusts) {
      this.scene.remove(d.points);
      d.points.geometry.dispose();
      d.mat.dispose();
    }
    this.dusts = [];
    this.disposeConfetti();
    this.camShake = 0;
    this.clearHint();
    this.selected = -1;
    this.celebrateT = -1;

    state.forEach((p, i) => {
      const group = this.buildPieceGroup(p, i);
      this.pieceGroups.push(group);
      this.scene.add(group);
    });
    this.state = state.map((p) => ({ ...p }));
  }

  /**
   * Animate from the current state to a new one (slide / glide / rotation pop).
   * Returns the longest animation duration in seconds (0 when nothing moved).
   */
  applyState(state: ViewState, animate = true): number {
    if (!this.state || this.state.length !== state.length) {
      this.setLevel(state);
      return 0;
    }
    let maxDur = 0;
    state.forEach((p, i) => {
      const prev = this.state![i];
      const group = this.pieceGroups[i];
      if (p.piece === prev.piece && p.index === prev.index) return;

      if (p.piece !== prev.piece) {
        // Rotation (classic rules only): pop down, swap cell meshes, pop back up.
        const rebuild = () => {
          group.clear();
          this.buildPieceMeshes(group, p, i);
          group.position.set(this.cellX(p.index), group.position.y, this.cellZ(p.index));
        };
        if (animate) {
          this.scales.push({
            group,
            from: 1,
            to: 0.01,
            t: 0,
            dur: 0.1,
            onDone: () => {
              rebuild();
              this.scales.push({ group, from: 0.01, to: 1, t: 0, dur: 0.14 });
            },
          });
          maxDur = Math.max(maxDur, 0.24);
        } else {
          rebuild();
          group.scale.setScalar(1);
        }
      } else if (animate) {
        const toX = this.cellX(p.index);
        const toZ = this.cellZ(p.index);
        const dx = toX - group.position.x;
        const dz = toZ - group.position.z;
        const dist = Math.max(Math.abs(dx), Math.abs(dz));
        const glide = dist >= 1.5;
        const dur = glide ? Math.min(0.5, 0.08 + dist * 0.05) : 0.16;
        const axis: 'x' | 'z' = Math.abs(dx) > Math.abs(dz) ? 'x' : 'z';
        const dirX = Math.sign(dx);
        const dirZ = Math.sign(dz);
        this.slides.push({
          group,
          fromX: group.position.x,
          fromZ: group.position.z,
          toX,
          toZ,
          t: 0,
          dur,
          glide,
          ghostClock: 0,
          onDone: glide
            ? () => {
                this.punches.push({ group, axis, t: 0 });
                this.spawnDust(toX + dirX * 0.7, toZ + dirZ * 0.7);
                if (dist >= 4) this.camShake = Math.min(0.3, 0.05 * dist);
              }
            : undefined,
        });
        maxDur = Math.max(maxDur, dur);
      } else {
        group.position.x = this.cellX(p.index);
        group.position.z = this.cellZ(p.index);
      }
    });
    this.state = state.map((p) => ({ ...p }));
    return maxDur;
  }

  setSelected(pieceIdx: number): void {
    this.selected = pieceIdx;
    this.pieceGroups.forEach((g, i) => {
      const mat = g.userData.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = i === pieceIdx ? 0.55 : (g.userData.baseEmissive as number);
    });
  }

  pulseInvalid(pieceIdx: number): void {
    const group = this.pieceGroups[pieceIdx];
    if (group) this.shakes.push({ group, t: 0 });
  }

  celebrate(): void {
    this.celebrateT = 0;
    this.spawnConfetti();
  }

  /** Translucent afterimage of a gliding piece (motion trail). */
  private spawnGhost(group: THREE.Group): void {
    const srcMat = group.userData.material as THREE.MeshStandardMaterial;
    const mat = new THREE.MeshBasicMaterial({
      color: srcMat.color,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
    });
    const ghost = new THREE.Group();
    ghost.position.copy(group.position);
    for (const child of group.children) {
      const mesh = new THREE.Mesh(this.cubeGeo, mat);
      mesh.position.copy((child as THREE.Mesh).position);
      ghost.add(mesh);
    }
    this.scene.add(ghost);
    this.ghosts.push({ group: ghost, mat, t: 0 });
  }

  /** Small dust puff at the impact face. */
  private spawnDust(x: number, z: number): void {
    const count = 12;
    const positions = new Float32Array(count * 3);
    const vels = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = x + (Math.random() - 0.5) * 0.5;
      positions[i * 3 + 1] = 0.3 + Math.random() * 0.4;
      positions[i * 3 + 2] = z + (Math.random() - 0.5) * 0.5;
      vels[i * 3] = (Math.random() - 0.5) * 2.4;
      vels[i * 3 + 1] = 1 + Math.random() * 2;
      vels[i * 3 + 2] = (Math.random() - 0.5) * 2.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xcfd6e6,
      size: 0.09,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.scene.add(points);
    this.dusts.push({ points, vels, mat, t: 0 });
  }

  /** Confetti burst from the goal pad. */
  private spawnConfetti(): void {
    this.disposeConfetti();
    const cells = this.layout.goalCells;
    let cx = 0;
    let cz = 0;
    for (const cell of cells) {
      cx += this.cellX(cell);
      cz += this.cellZ(cell);
    }
    cx /= cells.length;
    cz /= cells.length;

    const count = 140;
    const colors = [0xffb703, 0x59e3ff, 0x4d7cfe, 0x9b5de5, 0x6fbf4a, 0xe05263, 0xffffff];
    const geo = new THREE.BoxGeometry(0.14, 0.14, 0.03);
    const mat = new THREE.MeshBasicMaterial();
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const spin = new Float32Array(count * 4); // axis xyz + speed
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      pos[i * 3] = cx + (Math.random() - 0.5) * 1.4;
      pos[i * 3 + 1] = 0.3;
      pos[i * 3 + 2] = cz + (Math.random() - 0.5) * 1.4;
      vel[i * 3] = (Math.random() - 0.5) * 4.5;
      vel[i * 3 + 1] = 3.5 + Math.random() * 4.5;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 4.5;
      const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      spin[i * 4] = axis.x;
      spin[i * 4 + 1] = axis.y;
      spin[i * 4 + 2] = axis.z;
      spin[i * 4 + 3] = 4 + Math.random() * 9;
      mesh.setColorAt(i, color.setHex(colors[(Math.random() * colors.length) | 0]));
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.scene.add(mesh);
    this.confettiSys = { mesh, pos, vel, spin, t: 0 };
  }

  private disposeConfetti(): void {
    if (!this.confettiSys) return;
    this.scene.remove(this.confettiSys.mesh);
    this.confettiSys.mesh.geometry.dispose();
    (this.confettiSys.mesh.material as THREE.Material).dispose();
    this.confettiSys = null;
  }

  /** Float a golden arrow over a piece pointing in board direction (dr, dc). */
  showHint(pieceIdx: number, dr: number, dc: number): void {
    this.clearHint();
    const group = this.pieceGroups[pieceIdx];
    if (!group || !this.state) return;
    const cells = this.layout.cells(this.state[pieceIdx]);
    let cx = 0;
    let cz = 0;
    for (const cell of cells) {
      cx += this.cellX(cell);
      cz += this.cellZ(cell);
    }
    cx /= cells.length;
    cz /= cells.length;
    const dir = new THREE.Vector3(dc, 0, dr).normalize();
    const baseY = 1.35;
    const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(cx, baseY, cz), 1.5, 0xffc933, 0.55, 0.34);
    this.scene.add(arrow);
    this.hint = { arrow, baseY, t: 0 };
  }

  clearHint(): void {
    if (this.hint) {
      this.scene.remove(this.hint.arrow);
      this.hint.arrow.dispose();
      this.hint = null;
    }
  }

  /** Which piece is under the pointer? Returns its index in the state, or null. */
  pickAt(clientX: number, clientY: number): number | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hits = ray.intersectObjects(this.pieceGroups, true);
    if (hits.length === 0) return null;
    const idx = hits[0].object.userData.pieceIdx;
    return typeof idx === 'number' ? idx : null;
  }

  /** Screen-space direction (in pixels) of the board's +x and +z axes. */
  screenAxes(): { x: { x: number; y: number }; z: { x: number; y: number } } {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const toScreen = (v: THREE.Vector3) => {
      const p = v.clone().project(this.camera);
      return { x: ((p.x + 1) / 2) * rect.width, y: ((1 - p.y) / 2) * rect.height };
    };
    const o = toScreen(new THREE.Vector3(0, 0, 0));
    const px = toScreen(new THREE.Vector3(1, 0, 0));
    const pz = toScreen(new THREE.Vector3(0, 0, 1));
    return {
      x: { x: px.x - o.x, y: px.y - o.y },
      z: { x: pz.x - o.x, y: pz.y - o.y },
    };
  }

  setOrbitEnabled(enabled: boolean): void {
    if (this.controls) this.controls.enabled = enabled;
  }

  frame(dt: number): void {
    this.time += dt;

    for (let i = this.slides.length - 1; i >= 0; i--) {
      const tw = this.slides[i];
      tw.t += dt;
      const raw = Math.min(1, tw.t / tw.dur);
      // glides accelerate into the impact; short slides ease out gently
      const k = tw.glide ? raw * raw : easeOutCubic(raw);
      tw.group.position.x = tw.fromX + (tw.toX - tw.fromX) * k;
      tw.group.position.z = tw.fromZ + (tw.toZ - tw.fromZ) * k;
      if (tw.glide) {
        tw.ghostClock += dt;
        if (tw.ghostClock > 0.045 && raw < 0.95) {
          tw.ghostClock = 0;
          this.spawnGhost(tw.group);
        }
      }
      if (tw.t >= tw.dur) {
        this.slides.splice(i, 1);
        tw.onDone?.();
      }
    }

    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i];
      g.t += dt;
      const k = g.t / 0.28;
      if (k >= 1) {
        this.scene.remove(g.group);
        g.mat.dispose();
        this.ghosts.splice(i, 1);
      } else {
        g.mat.opacity = 0.2 * (1 - k);
      }
    }

    for (let i = this.dusts.length - 1; i >= 0; i--) {
      const d = this.dusts[i];
      d.t += dt;
      if (d.t >= 0.45) {
        this.scene.remove(d.points);
        d.points.geometry.dispose();
        d.mat.dispose();
        this.dusts.splice(i, 1);
        continue;
      }
      const arr = d.points.geometry.attributes.position.array as Float32Array;
      for (let p = 0; p < arr.length / 3; p++) {
        arr[p * 3] += d.vels[p * 3] * dt;
        arr[p * 3 + 1] += d.vels[p * 3 + 1] * dt;
        arr[p * 3 + 2] += d.vels[p * 3 + 2] * dt;
        d.vels[p * 3 + 1] -= 5 * dt;
      }
      d.points.geometry.attributes.position.needsUpdate = true;
      d.mat.opacity = 0.8 * (1 - d.t / 0.45);
    }

    if (this.confettiSys) {
      const sys = this.confettiSys;
      sys.t += dt;
      if (sys.t >= 2.4) {
        this.disposeConfetti();
      } else {
        const m = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        const axis = new THREE.Vector3();
        const fade = sys.t > 1.9 ? Math.max(0.01, 1 - (sys.t - 1.9) / 0.5) : 1;
        const n = sys.mesh.count;
        for (let i = 0; i < n; i++) {
          sys.pos[i * 3] += sys.vel[i * 3] * dt;
          sys.pos[i * 3 + 1] += sys.vel[i * 3 + 1] * dt;
          sys.pos[i * 3 + 2] += sys.vel[i * 3 + 2] * dt;
          sys.vel[i * 3 + 1] -= 7.5 * dt;
          // bounce softly off the board
          if (sys.pos[i * 3 + 1] < 0.08 && sys.vel[i * 3 + 1] < 0) {
            sys.pos[i * 3 + 1] = 0.08;
            sys.vel[i * 3 + 1] *= -0.35;
            sys.vel[i * 3] *= 0.7;
            sys.vel[i * 3 + 2] *= 0.7;
          }
          axis.set(sys.spin[i * 4], sys.spin[i * 4 + 1], sys.spin[i * 4 + 2]);
          q.setFromAxisAngle(axis, sys.spin[i * 4 + 3] * sys.t);
          m.makeRotationFromQuaternion(q);
          m.scale(new THREE.Vector3(fade, fade, fade));
          m.setPosition(sys.pos[i * 3], sys.pos[i * 3 + 1], sys.pos[i * 3 + 2]);
          sys.mesh.setMatrixAt(i, m);
        }
        sys.mesh.instanceMatrix.needsUpdate = true;
      }
    }

    for (let i = this.scales.length - 1; i >= 0; i--) {
      const tw = this.scales[i];
      tw.t += dt;
      const k = easeOutCubic(Math.min(1, tw.t / tw.dur));
      tw.group.scale.setScalar(tw.from + (tw.to - tw.from) * k);
      if (tw.t >= tw.dur) {
        this.scales.splice(i, 1);
        tw.onDone?.();
      }
    }

    for (let i = this.punches.length - 1; i >= 0; i--) {
      const p = this.punches[i];
      p.t += dt;
      const k = Math.min(1, p.t / 0.2);
      const s = Math.sin(k * Math.PI);
      const along = 1 - 0.16 * s;
      const across = 1 + 0.1 * s;
      if (p.axis === 'x') {
        p.group.scale.set(along, 1, across);
      } else {
        p.group.scale.set(across, 1, along);
      }
      if (k >= 1) {
        p.group.scale.set(1, 1, 1);
        this.punches.splice(i, 1);
      }
    }

    for (let i = this.shakes.length - 1; i >= 0; i--) {
      const s = this.shakes[i];
      s.t += dt;
      const decay = Math.max(0, 1 - s.t / 0.3);
      s.group.rotation.y = Math.sin(s.t * 45) * 0.06 * decay;
      if (decay === 0) {
        s.group.rotation.y = 0;
        this.shakes.splice(i, 1);
      }
    }

    if (this.hint) {
      this.hint.t += dt;
      this.hint.arrow.position.y = this.hint.baseY + Math.sin(this.hint.t * 4.5) * 0.1;
      if (this.hint.t > 2.6) this.clearHint();
    }

    // selected piece gently floats
    this.pieceGroups.forEach((g, i) => {
      const targetY = i === this.selected ? 0.1 + Math.sin(this.time * 5) * 0.04 : 0;
      g.position.y += (targetY - g.position.y) * Math.min(1, dt * 12);
    });

    // goal tiles pulse; brighter while celebrating
    let glow = 0.3 + Math.sin(this.time * 2.5) * 0.15;
    if (this.celebrateT >= 0) {
      this.celebrateT += dt;
      glow += Math.max(0, 1.6 - this.celebrateT);
      if (this.celebrateT > 2.5) this.celebrateT = -1;
    }
    for (const m of this.goalMaterials) m.emissiveIntensity = glow;

    this.controls?.update();
    if (this.camShake > 0.004) {
      // temporary per-frame jitter; restored after render so OrbitControls is unaffected
      const ox = (Math.random() * 2 - 1) * this.camShake;
      const oy = (Math.random() * 2 - 1) * this.camShake;
      const oz = (Math.random() * 2 - 1) * this.camShake;
      this.camera.position.x += ox;
      this.camera.position.y += oy;
      this.camera.position.z += oz;
      this.renderer.render(this.scene, this.camera);
      this.camera.position.x -= ox;
      this.camera.position.y -= oy;
      this.camera.position.z -= oz;
      this.camShake *= Math.exp(-dt * 7);
    } else {
      this.camShake = 0;
      this.renderer.render(this.scene, this.camera);
    }
  }

  private resize(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.observer.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
