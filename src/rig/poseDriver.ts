import * as THREE from "three";

/* ════════════════════════════════════════════════════════════════
   ARENA RIG — motor de animación procedural multi-rig
   Una Pose abstracta (ángulos por articulación) aplicable a
   cualquier esqueleto humanoide: KayKit, Rigify (Quaternius),
   Mixamo... Convención: rotation.x negativo = miembro hacia delante.
   ════════════════════════════════════════════════════════════════ */

export type Vec3 = [number, number, number];

export interface Pose {
  bob: number;
  tx?: number; tz?: number;              // traslación de cadera (lateral / profundidad)
  hipsX: number; hipsY: number; hipsZ: number; // inclinación / guiñada / balanceo
  lean: number; twist: number;
  headX: number; headY: number;
  uaR: Vec3; faR: number;
  uaL: Vec3; faL: number;
  thL: number; thLY: number; shL: number; // muslo / apertura de muslo / rodilla
  thR: number; thRY: number; shR: number;
  ankL?: Vec3; ankR?: Vec3;              // tobillos (pie)
  claL?: Vec3; claR?: Vec3;              // clavículas (hombro)
}

export const GUARD: Pose = {
  bob: 0, hipsX: 0, hipsY: 0, hipsZ: 0, lean: 0.06, twist: 0.15,
  headX: 0, headY: 0.15,
  uaR: [-0.5, 0, 0.12], faR: -1.1,
  uaL: [-0.4, 0.4, 0], faL: -1.3,
  thL: 0, thLY: 0, shL: 0.08, thR: 0, thRY: 0, shR: 0.08,
};

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
export const easeIn = (t: number) => t * t;

export function clonePose(p: Pose): Pose {
  return { ...p, uaR: [...p.uaR], uaL: [...p.uaL] };
}

const Z3: Vec3 = [0, 0, 0];

export function lerpPose(a: Pose, b: Pose, k: number): Pose {
  const L = (x: number, y: number) => x + (y - x) * k;
  const LO = (x?: number, y?: number) => L(x ?? 0, y ?? 0);
  const L3 = (x: Vec3, y: Vec3): Vec3 => [L(x[0], y[0]), L(x[1], y[1]), L(x[2], y[2])];
  const L3O = (x?: Vec3, y?: Vec3): Vec3 => L3(x ?? Z3, y ?? Z3);
  return {
    bob: L(a.bob, b.bob), tx: LO(a.tx, b.tx), tz: LO(a.tz, b.tz),
    hipsX: L(a.hipsX, b.hipsX), hipsY: L(a.hipsY, b.hipsY), hipsZ: L(a.hipsZ, b.hipsZ),
    lean: L(a.lean, b.lean), twist: L(a.twist, b.twist),
    headX: L(a.headX, b.headX), headY: L(a.headY, b.headY),
    uaR: L3(a.uaR, b.uaR), faR: L(a.faR, b.faR),
    uaL: L3(a.uaL, b.uaL), faL: L(a.faL, b.faL),
    thL: L(a.thL, b.thL), thLY: L(a.thLY, b.thLY), shL: L(a.shL, b.shL),
    thR: L(a.thR, b.thR), thRY: L(a.thRY, b.thRY), shR: L(a.shR, b.shR),
    ankL: L3O(a.ankL, b.ankL), ankR: L3O(a.ankR, b.ankR),
    claL: L3O(a.claL, b.claL), claR: L3O(a.claR, b.claR),
  };
}

/** Espejo zurdo/diestro: intercambia L/R y niega los ejes Y/Z */
export function mirrorPose(p: Pose): Pose {
  const M3 = (v?: Vec3): Vec3 | undefined => v && [v[0], -v[1], -v[2]];
  return {
    ...p,
    tx: p.tx !== undefined ? -p.tx : undefined,
    hipsY: -p.hipsY, hipsZ: -p.hipsZ, twist: -p.twist, headY: -p.headY,
    uaR: M3(p.uaL)!, uaL: M3(p.uaR)!, faR: p.faL, faL: p.faR,
    thL: p.thR, thR: p.thL, thLY: -p.thRY, thRY: -p.thLY, shL: p.shR, shR: p.shL,
    ankL: M3(p.ankR), ankR: M3(p.ankL), claL: M3(p.claR), claR: M3(p.claL),
  };
}

/* ── Detección de esqueleto: perfiles de nombres por familia de rig ── */

/* Rigs cuya malla mira a -Z local: conjugar Δ por rotY(π) ⇔ negar X y Z,
   para que "delante" en la Pose sea el frente anatómico del modelo.
   Verificado por anatomía (pecho/pies) en 2026-07: los exports Godot y
   Unreal-Godot de Quaternius miran a +Z (estándar glTF) → ninguno activo. */
const FLIPZ: Record<string, boolean> = {};

interface BoneNames {
  hips: string[];
  spineChain: string[][]; // cadenas candidatas, de pelvis a pecho
  head: string[];
  armUpL: string[]; armLoL: string[];
  armUpR: string[]; armLoR: string[];
  legUpL: string[]; legLoL: string[];
  legUpR: string[]; legLoR: string[];
  footL?: string[]; footR?: string[];   // opcionales: realismo (mocap)
  clavL?: string[]; clavR?: string[];
}

const PROFILES: Record<string, BoneNames> = {
  // KayKit (Blender custom: "upperarm.l" → saneado "upperarml")
  kaykit: {
    hips: ["hips"],
    spineChain: [["spine", "chest"], ["spine"]],
    head: ["head"],
    armUpL: ["upperarm.l"], armLoL: ["lowerarm.l"],
    armUpR: ["upperarm.r"], armLoR: ["lowerarm.r"],
    legUpL: ["upperleg.l"], legLoL: ["lowerleg.l"],
    legUpR: ["upperleg.r"], legLoR: ["lowerleg.r"],
    footL: ["foot.l"], footR: ["foot.r"],
    clavL: ["shoulder.l"], clavR: ["shoulder.r"],
  },
  // Rigify DEF (Quaternius Universal: "DEF-upper_arm.L" → "DEF-upper_armL")
  // ojo: la cadena completa es 4 eslabones (DEF-spine también rota en los clips)
  rigify: {
    hips: ["DEF-hips"],
    spineChain: [
      ["DEF-spine", "DEF-spine.001", "DEF-spine.002", "DEF-spine.003"],
      ["DEF-spine.001", "DEF-spine.002", "DEF-spine.003"],
      ["DEF-spine"],
    ],
    head: ["DEF-head"],
    armUpL: ["DEF-upper_arm.L"], armLoL: ["DEF-forearm.L"],
    armUpR: ["DEF-upper_arm.R"], armLoR: ["DEF-forearm.R"],
    legUpL: ["DEF-thigh.L"], legLoL: ["DEF-shin.L"],
    legUpR: ["DEF-thigh.R"], legLoR: ["DEF-shin.R"],
    footL: ["DEF-foot.L"], footR: ["DEF-foot.R"],
    clavL: ["DEF-shoulder.L"], clavR: ["DEF-shoulder.R"],
  },
  // Unreal (export Unreal-Godot de Quaternius UAL2: pelvis/spine_01-03)
  unreal: {
    hips: ["pelvis"],
    spineChain: [["spine_01", "spine_02", "spine_03"]],
    head: ["Head"],
    armUpL: ["upperarm_l"], armLoL: ["lowerarm_l"],
    armUpR: ["upperarm_r"], armLoR: ["lowerarm_r"],
    legUpL: ["thigh_l"], legLoL: ["calf_l"],
    legUpR: ["thigh_r"], legLoR: ["calf_r"],
    footL: ["foot_l"], footR: ["foot_r"],
    clavL: ["clavicle_l"], clavR: ["clavicle_r"],
  },
  // Mixamo
  mixamo: {
    hips: ["mixamorig:Hips", "mixamorigHips", "Hips"],
    spineChain: [["mixamorig:Spine1", "mixamorig:Spine2", "mixamorigSpine1", "mixamorigSpine2"], ["mixamorig:Spine", "Spine"]],
    head: ["mixamorig:Head", "mixamorigHead", "Head"],
    armUpL: ["mixamorig:LeftArm", "mixamorigLeftArm", "LeftArm"],
    armLoL: ["mixamorig:LeftForeArm", "mixamorigLeftForeArm", "LeftForeArm"],
    armUpR: ["mixamorig:RightArm", "mixamorigRightArm", "RightArm"],
    armLoR: ["mixamorig:RightForeArm", "mixamorigRightForeArm", "RightForeArm"],
    legUpL: ["mixamorig:LeftUpLeg", "mixamorigLeftUpLeg", "LeftUpLeg"],
    legLoL: ["mixamorig:LeftLeg", "mixamorigLeftLeg", "LeftLeg"],
    legUpR: ["mixamorig:RightUpLeg", "mixamorigRightUpLeg", "RightUpLeg"],
    legLoR: ["mixamorig:RightLeg", "mixamorigRightLeg", "RightLeg"],
    footL: ["mixamorig:LeftFoot", "mixamorigLeftFoot", "LeftFoot"],
    footR: ["mixamorig:RightFoot", "mixamorigRightFoot", "RightFoot"],
    clavL: ["mixamorig:LeftShoulder", "mixamorigLeftShoulder", "LeftShoulder"],
    clavR: ["mixamorig:RightShoulder", "mixamorigRightShoulder", "RightShoulder"],
  },
};

export interface Rig {
  charRoot: THREE.Object3D;
  profile: string;
  hips: THREE.Object3D;
  spine: THREE.Object3D[]; // cadena pelvis→pecho (1-3 huesos)
  head: THREE.Object3D;
  armUpL: THREE.Object3D; armLoL: THREE.Object3D;
  armUpR: THREE.Object3D; armLoR: THREE.Object3D;
  legUpL: THREE.Object3D; legLoL: THREE.Object3D;
  legUpR: THREE.Object3D; legLoR: THREE.Object3D;
  footL?: THREE.Object3D; footR?: THREE.Object3D;
  claL?: THREE.Object3D; claR?: THREE.Object3D;
  rest: Map<THREE.Object3D, THREE.Quaternion>;
  hipsBaseX: number; hipsBaseY: number; hipsBaseZ: number;
  unit: number;
  flipZ: boolean; // true si la malla mira a -Z: negar X/Z de las rotaciones
}

export function findRig(root: THREE.Object3D): Rig | null {
  const bones: Record<string, THREE.Object3D> = {};
  root.traverse((o) => { bones[o.name] = o; });
  const pick = (cands: string[]) =>
    cands.map((n) => bones[n] ?? bones[n.replace(/\./g, "")]).find(Boolean);

  for (const [profile, bn] of Object.entries(PROFILES)) {
    const hips = pick(bn.hips);
    const head = pick(bn.head);
    const armUpL = pick(bn.armUpL), armLoL = pick(bn.armLoL);
    const armUpR = pick(bn.armUpR), armLoR = pick(bn.armLoR);
    const legUpL = pick(bn.legUpL), legLoL = pick(bn.legLoL);
    const legUpR = pick(bn.legUpR), legLoR = pick(bn.legLoR);
    const spine = bn.spineChain
      .map((chain) => chain.map((n) => bones[n] ?? bones[n.replace(/\./g, "")]))
      .find((chain) => chain.every(Boolean));
    if (!hips || !head || !spine || !armUpL || !armLoL || !armUpR || !armLoR || !legUpL || !legLoL || !legUpR || !legLoR) continue;
    // huesos opcionales (realismo): si el rig no los trae, se ignoran
    const footL = bn.footL ? pick(bn.footL) : undefined;
    const footR = bn.footR ? pick(bn.footR) : undefined;
    const claL = bn.clavL ? pick(bn.clavL) : undefined;
    const claR = bn.clavR ? pick(bn.clavR) : undefined;
    const all = [hips, ...spine, head, armUpL, armLoL, armUpR, armLoR, legUpL, legLoL, legUpR, legLoR,
      footL, footR, claL, claR].filter(Boolean) as THREE.Object3D[];
    const rest = new Map<THREE.Object3D, THREE.Quaternion>();
    all.forEach((b) => rest.set(b, b.quaternion.clone()));
    return {
      charRoot: root, profile, hips, spine: spine as THREE.Object3D[], head,
      armUpL, armLoL, armUpR, armLoR, legUpL, legLoL, legUpR, legLoR,
      footL, footR, claL, claR,
      rest,
      hipsBaseX: hips.position.x, hipsBaseY: hips.position.y, hipsBaseZ: hips.position.z,
      unit: hips.position.y / 1.02,
      flipZ: !!FLIPZ[profile],
    };
  }
  return null;
}

/* ── Rotación con eje en el marco del padre: local = P⁻¹ · Δ · P · rest ── */
const _P = new THREE.Quaternion();
const _tmp = new THREE.Quaternion();
const _e = new THREE.Euler();
const _dq = new THREE.Quaternion();

function relQuat(o: THREE.Object3D, stop: THREE.Object3D, out: THREE.Quaternion) {
  const chain: THREE.Object3D[] = [];
  let cur: THREE.Object3D | null = o;
  while (cur && cur !== stop) { chain.push(cur); cur = cur.parent; }
  out.set(0, 0, 0, 1);
  for (let i = chain.length - 1; i >= 0; i--) out.multiply(chain[i].quaternion);
  return out;
}

export function rotBone(rig: Rig, bone: THREE.Object3D, x: number, y: number, z: number) {
  relQuat(bone.parent!, rig.charRoot, _P);
  // flipZ ⇔ conjugar por rotY(π): Rx(θ)→Rx(-θ), Ry(θ)→Ry(θ), Rz(θ)→Rz(-θ)
  _dq.setFromEuler(_e.set(rig.flipZ ? -x : x, y, rig.flipZ ? -z : z));
  const rest = rig.rest.get(bone)!;
  bone.quaternion.copy(_tmp.copy(_P).invert().multiply(_dq).multiply(_P).multiply(rest));
}

export function applyPose(rig: Rig, p: Pose) {
  rig.hips.position.set(
    rig.hipsBaseX + (p.tx ?? 0) * rig.unit,
    rig.hipsBaseY + p.bob * rig.unit,
    rig.hipsBaseZ + (p.tz ?? 0) * rig.unit
  );
  rotBone(rig, rig.hips, p.hipsX, p.hipsY, p.hipsZ);
  const n = rig.spine.length;
  rig.spine.forEach((s) => rotBone(rig, s, p.lean / n, p.twist / n, 0));
  rotBone(rig, rig.head, p.headX, p.headY, 0);
  if (rig.claL) rotBone(rig, rig.claL, ...(p.claL ?? Z3));
  if (rig.claR) rotBone(rig, rig.claR, ...(p.claR ?? Z3));
  rotBone(rig, rig.armUpR, p.uaR[0], p.uaR[1], p.uaR[2]);
  rotBone(rig, rig.armLoR, p.faR, 0, 0);
  rotBone(rig, rig.armUpL, p.uaL[0], p.uaL[1], p.uaL[2]);
  rotBone(rig, rig.armLoL, p.faL, 0, 0);
  rotBone(rig, rig.legUpL, p.thL, p.thLY, 0);
  rotBone(rig, rig.legLoL, p.shL, 0, 0);
  rotBone(rig, rig.legUpR, p.thR, p.thRY, 0);
  rotBone(rig, rig.legLoR, p.shR, 0, 0);
  if (rig.footL) rotBone(rig, rig.footL, ...(p.ankL ?? Z3));
  if (rig.footR) rotBone(rig, rig.footR, ...(p.ankR ?? Z3));
}
