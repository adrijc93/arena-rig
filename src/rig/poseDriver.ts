import * as THREE from "three";

/* ════════════════════════════════════════════════════════════════
   ARENA RIG — motor de animación procedural multi-rig
   Una Pose abstracta (ángulos por articulación) aplicable a
   cualquier esqueleto humanoide: KayKit, Rigify (Quaternius),
   Mixamo... Convención: rotation.x negativo = miembro hacia delante.
   ════════════════════════════════════════════════════════════════ */

export interface Pose {
  bob: number;
  hipsY: number; hipsZ: number;
  lean: number; twist: number;
  headX: number; headY: number;
  uaR: [number, number, number]; faR: number;
  uaL: [number, number, number]; faL: number;
  thL: number; shL: number; thR: number; shR: number;
}

export const GUARD: Pose = {
  bob: 0, hipsY: 0, hipsZ: 0, lean: 0.06, twist: 0.15,
  headX: 0, headY: 0.15,
  uaR: [-0.5, 0, 0.12], faR: -1.1,
  uaL: [-0.4, 0.4, 0], faL: -1.3,
  thL: 0, shL: 0.08, thR: 0, shR: 0.08,
};

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
export const easeIn = (t: number) => t * t;

export function clonePose(p: Pose): Pose {
  return { ...p, uaR: [...p.uaR], uaL: [...p.uaL] };
}

export function lerpPose(a: Pose, b: Pose, k: number): Pose {
  const L = (x: number, y: number) => x + (y - x) * k;
  const L3 = (x: [number, number, number], y: [number, number, number]): [number, number, number] => [L(x[0], y[0]), L(x[1], y[1]), L(x[2], y[2])];
  return {
    bob: L(a.bob, b.bob), hipsY: L(a.hipsY, b.hipsY), hipsZ: L(a.hipsZ, b.hipsZ),
    lean: L(a.lean, b.lean), twist: L(a.twist, b.twist),
    headX: L(a.headX, b.headX), headY: L(a.headY, b.headY),
    uaR: L3(a.uaR, b.uaR), faR: L(a.faR, b.faR),
    uaL: L3(a.uaL, b.uaL), faL: L(a.faL, b.faL),
    thL: L(a.thL, b.thL), shL: L(a.shL, b.shL),
    thR: L(a.thR, b.thR), shR: L(a.shR, b.shR),
  };
}

/* ── Detección de esqueleto: perfiles de nombres por familia de rig ── */

interface BoneNames {
  hips: string[];
  spineChain: string[][]; // cadenas candidatas, de pelvis a pecho
  head: string[];
  armUpL: string[]; armLoL: string[];
  armUpR: string[]; armLoR: string[];
  legUpL: string[]; legLoL: string[];
  legUpR: string[]; legLoR: string[];
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
  },
  // Rigify DEF (Quaternius Universal: "DEF-upper_arm.L" → "DEF-upper_armL")
  rigify: {
    hips: ["DEF-hips"],
    spineChain: [["DEF-spine.001", "DEF-spine.002", "DEF-spine.003"], ["DEF-spine"]],
    head: ["DEF-head"],
    armUpL: ["DEF-upper_arm.L"], armLoL: ["DEF-forearm.L"],
    armUpR: ["DEF-upper_arm.R"], armLoR: ["DEF-forearm.R"],
    legUpL: ["DEF-thigh.L"], legLoL: ["DEF-shin.L"],
    legUpR: ["DEF-thigh.R"], legLoR: ["DEF-shin.R"],
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
  rest: Map<THREE.Object3D, THREE.Quaternion>;
  hipsBaseY: number;
  unit: number;
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
    const all = [hips, ...spine, head, armUpL, armLoL, armUpR, armLoR, legUpL, legLoL, legUpR, legLoR];
    const rest = new Map<THREE.Object3D, THREE.Quaternion>();
    all.forEach((b) => rest.set(b, b.quaternion.clone()));
    return {
      charRoot: root, profile, hips, spine: spine as THREE.Object3D[], head,
      armUpL, armLoL, armUpR, armLoR, legUpL, legLoL, legUpR, legLoR,
      rest, hipsBaseY: hips.position.y, unit: hips.position.y / 1.02,
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
  _dq.setFromEuler(_e.set(x, y, z));
  const rest = rig.rest.get(bone)!;
  bone.quaternion.copy(_tmp.copy(_P).invert().multiply(_dq).multiply(_P).multiply(rest));
}

export function applyPose(rig: Rig, p: Pose) {
  rig.hips.position.y = rig.hipsBaseY + p.bob * rig.unit;
  rotBone(rig, rig.hips, 0, p.hipsY, p.hipsZ);
  const n = rig.spine.length;
  rig.spine.forEach((s) => rotBone(rig, s, p.lean / n, p.twist / n, 0));
  rotBone(rig, rig.head, p.headX, p.headY, 0);
  rotBone(rig, rig.armUpR, p.uaR[0], p.uaR[1], p.uaR[2]);
  rotBone(rig, rig.armLoR, p.faR, 0, 0);
  rotBone(rig, rig.armUpL, p.uaL[0], p.uaL[1], p.uaL[2]);
  rotBone(rig, rig.armLoL, p.faL, 0, 0);
  rotBone(rig, rig.legUpL, p.thL, 0, 0);
  rotBone(rig, rig.legLoL, p.shL, 0, 0);
  rotBone(rig, rig.legUpR, p.thR, 0, 0);
  rotBone(rig, rig.legLoR, p.shR, 0, 0);
}
