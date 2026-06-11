// 3D rendering of the puzzle board: walls, floor tiles, goal markers and the
// colored pieces (a nod to the crate textures of the original WPF app).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { State, W, CELLS, GOAL_INDEX, isWall, cloneState } from '../core/board';
import { FAMILY_COLORS, pieceDef } from '../core/pieces';

const GOAL_CELLS = [GOAL_INDEX, GOAL_INDEX + 1, GOAL_INDEX + W, GOAL_INDEX + W + 1];

function cellX(cell: number): number {
  return (cell % W) - 3.5;
}
function cellZ(cell: number): number {
  return ((cell / W) | 0) - 3.5;
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
  private state: State | null = null;

  private slides: SlideTween[] = [];
  private scales: ScaleTween[] = [];
  private shakes: { group: THREE.Group; t: number }[] = [];
  private selected = -1;
  private time = 0;
  private celebrateT = -1;

  private downAt: { x: number; y: number; t: number } | null = null;

  constructor(
    private container: HTMLElement,
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

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.set(0, 9.6, 7.4);
    this.camera.lookAt(0, 0, 0.2);

    if (opts.interactive) {
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.enablePan = false;
      this.controls.minDistance = 6;
      this.controls.maxDistance = 18;
      this.controls.maxPolarAngle = Math.PI * 0.42;
      this.controls.target.set(0, 0, 0.2);
    }

    this.buildStaticBoard();
    this.buildLights();

    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      this.downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    this.renderer.domElement.addEventListener('pointerup', (e) => {
      if (!this.opts.onPieceClick || !this.downAt) return;
      const moved = Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y);
      const elapsed = performance.now() - this.downAt.t;
      this.downAt = null;
      if (moved > 6 || elapsed > 500) return; // it was an orbit drag
      this.opts.onPieceClick(this.pickPiece(e.clientX, e.clientY));
    });

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
  }

  private buildLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xbdd4ff, 0x232838, 1.1));
    const sun = new THREE.DirectionalLight(0xfff2dd, 2.2);
    sun.position.set(4.5, 10, 3.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -6.5;
    sun.shadow.camera.right = 6.5;
    sun.shadow.camera.top = 6.5;
    sun.shadow.camera.bottom = -6.5;
    sun.shadow.bias = -0.0004;
    this.scene.add(sun);
  }

  private buildStaticBoard(): void {
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(8.7, 0.4, 8.7),
      new THREE.MeshStandardMaterial({ color: 0x11151f, roughness: 1 }),
    );
    base.position.y = -0.21;
    base.receiveShadow = true;
    this.scene.add(base);

    const tileGeo = new THREE.BoxGeometry(0.94, 0.1, 0.94);
    const tileMat = new THREE.MeshStandardMaterial({ color: 0x1b2233, roughness: 0.95 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x39415a, roughness: 0.9 });

    for (let cell = 0; cell < CELLS; cell++) {
      if (isWall(cell)) {
        const wall = new THREE.Mesh(this.wallGeo, wallMat);
        // tiny deterministic height variance so the wall ring reads as hand-built
        const h = 0.86 + (((cell * 2654435761) >>> 28) / 15) * 0.12;
        wall.scale.y = h;
        wall.position.set(cellX(cell), 0.45 * h, cellZ(cell));
        wall.castShadow = true;
        wall.receiveShadow = true;
        this.scene.add(wall);
      } else {
        const isGoal = GOAL_CELLS.includes(cell);
        const mat = isGoal
          ? new THREE.MeshStandardMaterial({
              color: 0x4a3a14,
              roughness: 0.6,
              emissive: 0xffb703,
              emissiveIntensity: 0.35,
            })
          : tileMat;
        const tile = new THREE.Mesh(tileGeo, mat);
        tile.position.set(cellX(cell), 0.0, cellZ(cell));
        tile.receiveShadow = true;
        this.scene.add(tile);
        if (isGoal) this.goalMaterials.push(mat as THREE.MeshStandardMaterial);
      }
    }
  }

  private buildPieceGroup(pieceName: string, anchor: number, pieceIdx: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(cellX(anchor), 0, cellZ(anchor));
    group.userData.pieceIdx = pieceIdx;

    const def = pieceDef(pieceName);
    const color = FAMILY_COLORS[def.family] ?? 0xffffff;
    const hero = def.family === 'o';
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.42,
      metalness: 0.08,
      emissive: color,
      emissiveIntensity: hero ? 0.3 : 0.07,
    });
    group.userData.material = mat;
    group.userData.baseEmissive = mat.emissiveIntensity;

    for (const o of def.offsets) {
      const mesh = new THREE.Mesh(this.cubeGeo, mat);
      mesh.position.set(o % W, 0.46, (o / W) | 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.pieceIdx = pieceIdx;
      group.add(mesh);
    }
    return group;
  }

  /** Replace the whole level: rebuild every piece. */
  setLevel(state: State): void {
    for (const g of this.pieceGroups) {
      this.scene.remove(g);
      (g.userData.material as THREE.Material).dispose();
    }
    this.pieceGroups = [];
    this.slides = [];
    this.scales = [];
    this.shakes = [];
    this.selected = -1;
    this.celebrateT = -1;

    state.forEach((p, i) => {
      const group = this.buildPieceGroup(p.piece, p.index, i);
      this.pieceGroups.push(group);
      this.scene.add(group);
    });
    this.state = cloneState(state);
  }

  /** Animate from the current state to a new one (slide or rotation pop per piece). */
  applyState(state: State, animate = true): void {
    if (!this.state || this.state.length !== state.length) {
      this.setLevel(state);
      return;
    }
    state.forEach((p, i) => {
      const prev = this.state![i];
      const group = this.pieceGroups[i];
      if (p.piece === prev.piece && p.index === prev.index) return;

      if (p.piece !== prev.piece) {
        // Rotation: pop down, swap the cell meshes, pop back up.
        const rebuild = () => {
          const mat = group.userData.material as THREE.MeshStandardMaterial;
          group.clear();
          for (const o of pieceDef(p.piece).offsets) {
            const mesh = new THREE.Mesh(this.cubeGeo, mat);
            mesh.position.set(o % W, 0.46, (o / W) | 0);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData.pieceIdx = i;
            group.add(mesh);
          }
          group.position.set(cellX(p.index), group.position.y, cellZ(p.index));
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
        } else {
          rebuild();
          group.scale.setScalar(1);
        }
      } else if (animate) {
        this.slides.push({
          group,
          fromX: group.position.x,
          fromZ: group.position.z,
          toX: cellX(p.index),
          toZ: cellZ(p.index),
          t: 0,
          dur: 0.16,
        });
      } else {
        group.position.x = cellX(p.index);
        group.position.z = cellZ(p.index);
      }
    });
    this.state = cloneState(state);
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
  }

  private pickPiece(clientX: number, clientY: number): number | null {
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

  frame(dt: number): void {
    this.time += dt;

    for (let i = this.slides.length - 1; i >= 0; i--) {
      const tw = this.slides[i];
      tw.t += dt;
      const k = easeOutCubic(Math.min(1, tw.t / tw.dur));
      tw.group.position.x = tw.fromX + (tw.toX - tw.fromX) * k;
      tw.group.position.z = tw.fromZ + (tw.toZ - tw.fromZ) * k;
      if (tw.t >= tw.dur) {
        this.slides.splice(i, 1);
        tw.onDone?.();
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
    this.renderer.render(this.scene, this.camera);
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
