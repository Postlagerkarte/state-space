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

// Soft radial glow sprite for the firework particles (generated once).
let glowTexture: THREE.Texture | null = null;
function getGlowTexture(): THREE.Texture {
  if (!glowTexture) {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    glowTexture = new THREE.CanvasTexture(canvas);
  }
  return glowTexture;
}

const FIREWORK_COLORS = [0xffd166, 0x59e3ff, 0xff5da2, 0x9b5de5, 0xffffff];

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
  private ghosts: { group: THREE.Group; mat: THREE.MeshBasicMaterial; t: number }[] = [];
  private dusts: { points: THREE.Points; vels: Float32Array; mat: THREE.PointsMaterial; t: number }[] = [];
  private fireworks: {
    points: THREE.Points;
    vels: Float32Array;
    base: Float32Array;
    mat: THREE.PointsMaterial;
    t: number;
    life: number;
  }[] = [];
  private ringsFx: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; t: number }[] = [];
  private celebrateEvents: { at: number; fn: () => void }[] = [];
  private spins: { group: THREE.Group; t: number }[] = [];
  private presses: { group: THREE.Group; dirX: number; dirZ: number; t: number }[] = [];
  private previews: { group: THREE.Group; mat: THREE.MeshBasicMaterial; onGoal: boolean }[] = [];
  private previewStrips: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }[] = [];
  private hintRun: {
    group: THREE.Group;
    mat: THREE.MeshBasicMaterial;
    fromX: number;
    fromZ: number;
    toX: number;
    toZ: number;
    t: number;
    runs: number;
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
    this.clearCelebrationFx();
    this.clearPreviews();
    this.clearHintRun();
    this.presses = [];
    this.camShake = 0;
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

  /** Blocked move: lean the piece into the wall it pressed against. */
  pulseInvalid(pieceIdx: number, dr = 0, dc = 0): void {
    const group = this.pieceGroups[pieceIdx];
    if (!group) return;
    if (dr === 0 && dc === 0) {
      this.shakes.push({ group, t: 0 });
    } else {
      this.presses.push({ group, dirX: dc, dirZ: dr, t: 0 });
    }
  }

  celebrate(): void {
    this.celebrateT = 0;
    const [cx, cz] = this.goalCenter();
    this.spawnRing(cx, cz);
    this.spawnFirework(cx, cz, 170, 7, 1.6);
    this.celebrateEvents = [
      { at: 0.22, fn: () => this.spawnFirework(cx, cz, 90, 5, 1.3) },
      { at: 0.5, fn: () => { this.spawnRing(cx, cz); this.spawnFirework(cx, cz, 70, 4, 1.1); } },
    ];
    if (this.pieceGroups[0]) this.spins.push({ group: this.pieceGroups[0], t: 0 });
  }

  private goalCenter(): [number, number] {
    const cells = this.layout.goalCells;
    let cx = 0;
    let cz = 0;
    for (const cell of cells) {
      cx += this.cellX(cell);
      cz += this.cellZ(cell);
    }
    return [cx / cells.length, cz / cells.length];
  }

  /** Expanding additive shockwave ring on the board surface. */
  private spawnRing(cx: number, cz: number): void {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd166,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 48), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(cx, 0.14, cz);
    this.scene.add(mesh);
    this.ringsFx.push({ mesh, mat, t: 0 });
  }

  /** Additive glow-particle burst — neon fireworks rather than paper confetti. */
  private spawnFirework(cx: number, cz: number, count: number, speed: number, life: number): void {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const base = new Float32Array(count * 3);
    const vels = new Float32Array(count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      positions[i * 3] = cx + (Math.random() - 0.5) * 0.8;
      positions[i * 3 + 1] = 0.35;
      positions[i * 3 + 2] = cz + (Math.random() - 0.5) * 0.8;
      const angle = Math.random() * Math.PI * 2;
      const radial = Math.random() * speed * 0.55;
      vels[i * 3] = Math.cos(angle) * radial;
      vels[i * 3 + 1] = speed * (0.45 + Math.random() * 0.8);
      vels[i * 3 + 2] = Math.sin(angle) * radial;
      c.setHex(FIREWORK_COLORS[(Math.random() * FIREWORK_COLORS.length) | 0]);
      base[i * 3] = c.r;
      base[i * 3 + 1] = c.g;
      base[i * 3 + 2] = c.b;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.34,
      map: getGlowTexture(),
      transparent: true,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.scene.add(points);
    this.fireworks.push({ points, vels, base, mat, t: 0, life });
  }

  private clearCelebrationFx(): void {
    for (const f of this.fireworks) {
      this.scene.remove(f.points);
      f.points.geometry.dispose();
      f.mat.dispose();
    }
    this.fireworks = [];
    for (const r of this.ringsFx) {
      this.scene.remove(r.mesh);
      r.mesh.geometry.dispose();
      r.mat.dispose();
    }
    this.ringsFx = [];
    this.celebrateEvents = [];
    this.spins = [];
  }

  // -- landing previews -------------------------------------------------------

  /**
   * Ghost copies of a piece at each position it could glide to. Hovering or
   * selecting a piece calls this — the board explains itself. Ghost meshes
   * carry the move in userData so they are directly clickable.
   */
  showPreviews(
    specs: { placement: ViewPlacement; pieceIdx: number; dr: number; dc: number; onGoal: boolean }[],
    fromIndex: number,
  ): void {
    this.clearPreviews();
    const { width } = this.layout;
    for (const spec of specs) {
      const color = spec.onGoal ? 0xffd166 : this.layout.color(spec.placement);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: spec.onGoal ? 0.42 : 0.15,
        depthWrite: false,
      });
      const group = new THREE.Group();
      group.position.set(this.cellX(spec.placement.index), 0, this.cellZ(spec.placement.index));
      const aR = (spec.placement.index / width) | 0;
      const aC = spec.placement.index % width;
      for (const cell of this.layout.cells(spec.placement)) {
        const mesh = new THREE.Mesh(this.cubeGeo, mat);
        mesh.position.set((cell % width) - aC, 0.46, ((cell / width) | 0) - aR);
        mesh.userData.previewMove = { pieceIdx: spec.pieceIdx, dr: spec.dr, dc: spec.dc };
        group.add(mesh);
      }
      this.scene.add(group);
      this.previews.push({ group, mat, onGoal: spec.onGoal });

      // faint path strip from the piece to the landing spot
      const fromX = this.cellX(fromIndex);
      const fromZ = this.cellZ(fromIndex);
      const toX = this.cellX(spec.placement.index);
      const toZ = this.cellZ(spec.placement.index);
      const len = Math.max(Math.abs(toX - fromX), Math.abs(toZ - fromZ));
      if (len > 0.5) {
        const alongX = Math.abs(toX - fromX) > Math.abs(toZ - fromZ);
        const stripMat = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.08,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const strip = new THREE.Mesh(
          new THREE.BoxGeometry(alongX ? len : 0.24, 0.02, alongX ? 0.24 : len),
          stripMat,
        );
        strip.position.set((fromX + toX) / 2, 0.12, (fromZ + toZ) / 2);
        this.scene.add(strip);
        this.previewStrips.push({ mesh: strip, mat: stripMat });
      }
    }
  }

  clearPreviews(): void {
    for (const p of this.previews) {
      this.scene.remove(p.group);
      p.mat.dispose();
    }
    this.previews = [];
    for (const s of this.previewStrips) {
      this.scene.remove(s.mesh);
      s.mesh.geometry.dispose();
      s.mat.dispose();
    }
    this.previewStrips = [];
  }

  /** Which preview ghost is under the pointer? Returns the move it represents. */
  pickPreviewAt(
    clientX: number,
    clientY: number,
  ): { pieceIdx: number; dr: number; dc: number } | null {
    if (this.previews.length === 0) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hits = ray.intersectObjects(
      this.previews.map((p) => p.group),
      true,
    );
    for (const hit of hits) {
      const move = hit.object.userData.previewMove;
      if (move) return move as { pieceIdx: number; dr: number; dc: number };
    }
    return null;
  }

  /** Hint: a ghost of the piece repeatedly glides its optimal path. */
  playHintRun(pieceIdx: number, toIndex: number): void {
    this.clearHintRun();
    if (!this.state) return;
    const p = this.state[pieceIdx];
    const srcMat = this.pieceGroups[pieceIdx].userData.material as THREE.MeshStandardMaterial;
    const mat = new THREE.MeshBasicMaterial({
      color: srcMat.color,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    const group = new THREE.Group();
    const { width } = this.layout;
    const aR = (p.index / width) | 0;
    const aC = p.index % width;
    for (const cell of this.layout.cells(p)) {
      const mesh = new THREE.Mesh(this.cubeGeo, mat);
      mesh.position.set((cell % width) - aC, 0.46, ((cell / width) | 0) - aR);
      group.add(mesh);
    }
    group.position.set(this.cellX(p.index), 0, this.cellZ(p.index));
    this.scene.add(group);
    this.hintRun = {
      group,
      mat,
      fromX: this.cellX(p.index),
      fromZ: this.cellZ(p.index),
      toX: this.cellX(toIndex),
      toZ: this.cellZ(toIndex),
      t: 0,
      runs: 3,
    };
  }

  clearHintRun(): void {
    if (this.hintRun) {
      this.scene.remove(this.hintRun.group);
      this.hintRun.mat.dispose();
      this.hintRun = null;
    }
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

    // staged celebration bursts
    if (this.celebrateT >= 0 && this.celebrateEvents.length > 0) {
      for (let i = this.celebrateEvents.length - 1; i >= 0; i--) {
        if (this.celebrateT >= this.celebrateEvents[i].at) {
          this.celebrateEvents[i].fn();
          this.celebrateEvents.splice(i, 1);
        }
      }
    }

    for (let i = this.fireworks.length - 1; i >= 0; i--) {
      const f = this.fireworks[i];
      f.t += dt;
      if (f.t >= f.life) {
        this.scene.remove(f.points);
        f.points.geometry.dispose();
        f.mat.dispose();
        this.fireworks.splice(i, 1);
        continue;
      }
      const pos = f.points.geometry.attributes.position.array as Float32Array;
      const col = f.points.geometry.attributes.color.array as Float32Array;
      const fade = Math.max(0, 1 - f.t / f.life);
      const drag = Math.exp(-dt * 1.1);
      for (let p = 0; p < pos.length / 3; p++) {
        pos[p * 3] += f.vels[p * 3] * dt;
        pos[p * 3 + 1] += f.vels[p * 3 + 1] * dt;
        pos[p * 3 + 2] += f.vels[p * 3 + 2] * dt;
        f.vels[p * 3] *= drag;
        f.vels[p * 3 + 1] = f.vels[p * 3 + 1] * drag - 5.5 * dt;
        f.vels[p * 3 + 2] *= drag;
        // additive blending: fading the color to black fades the particle out
        col[p * 3] = f.base[p * 3] * fade;
        col[p * 3 + 1] = f.base[p * 3 + 1] * fade;
        col[p * 3 + 2] = f.base[p * 3 + 2] * fade;
      }
      f.points.geometry.attributes.position.needsUpdate = true;
      f.points.geometry.attributes.color.needsUpdate = true;
    }

    for (let i = this.ringsFx.length - 1; i >= 0; i--) {
      const r = this.ringsFx[i];
      r.t += dt;
      const k = r.t / 0.55;
      if (k >= 1) {
        this.scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mat.dispose();
        this.ringsFx.splice(i, 1);
      } else {
        const s = 0.6 + easeOutCubic(k) * 7;
        r.mesh.scale.set(s, s, s);
        r.mat.opacity = 0.55 * (1 - k);
      }
    }

    // hero victory spin-jump
    for (let i = this.spins.length - 1; i >= 0; i--) {
      const s = this.spins[i];
      s.t += dt;
      const k = Math.min(1, s.t / 0.75);
      s.group.rotation.y = Math.PI * 2 * easeOutCubic(k);
      s.group.position.y = Math.sin(k * Math.PI) * 0.55;
      if (k >= 1) {
        s.group.rotation.y = 0;
        s.group.position.y = 0;
        this.spins.splice(i, 1);
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

    // directional "press into the wall" lean for blocked moves
    for (let i = this.presses.length - 1; i >= 0; i--) {
      const p = this.presses[i];
      p.t += dt;
      const k = Math.min(1, p.t / 0.24);
      const s = Math.sin(k * Math.PI);
      p.group.rotation.x = p.dirZ * 0.09 * s;
      p.group.rotation.z = -p.dirX * 0.09 * s;
      if (k >= 1) {
        p.group.rotation.x = 0;
        p.group.rotation.z = 0;
        this.presses.splice(i, 1);
      }
    }

    // the on-goal landing preview pulses invitingly
    for (const p of this.previews) {
      if (p.onGoal) p.mat.opacity = 0.34 + Math.sin(this.time * 5) * 0.14;
    }

    // hint: ghost glides its optimal path, three times
    if (this.hintRun) {
      const h = this.hintRun;
      h.t += dt;
      const cycle = 0.85;
      if (h.t >= cycle) {
        h.t -= cycle;
        h.runs--;
        if (h.runs <= 0) this.clearHintRun();
      }
      if (this.hintRun) {
        const k = Math.min(1, h.t / 0.6);
        const e = k * k;
        h.group.position.x = h.fromX + (h.toX - h.fromX) * e;
        h.group.position.z = h.fromZ + (h.toZ - h.fromZ) * e;
        h.mat.opacity = 0.4 * (h.t < 0.6 ? 1 : 1 - (h.t - 0.6) / 0.25);
      }
    }

    // selected piece gently floats (victory spin owns the y while active)
    const spinning = new Set(this.spins.map((s) => s.group));
    this.pieceGroups.forEach((g, i) => {
      if (spinning.has(g)) return;
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
