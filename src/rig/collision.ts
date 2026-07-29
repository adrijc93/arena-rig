import * as THREE from "three";
import { clonePose, type Pose, type Vec3 } from "./poseDriver";

/* ════════════════════════════════════════════════════════════════
   DETECTOR DE COLISIONES — resolución en ESPACIO DE POSE.

   A diferencia de corregir el grafo de escena después de aplicar la
   pose (lo que producía parpadeo al "pelearse" con el lerp), aquí:

     1. FK ANALÍTICO: se calculan las posiciones/orientaciones de
        todas las articulaciones DIRECTAMENTE desde la Pose (los
        quaterniones del muñeco voxel son euler XYZ en espacio
        charRoot, sin rest-pose: worldQ(hijo) = dq ⊗ worldQ(padre)).
     2. DETECCIÓN: OBB contra OBB con SAT (15 ejes) entre bloques de
        extremidades y bloques del cuerpo (misma geometría que
        voxelPuppet.ts, encogida un 15% para permitir contacto visual).
     3. RESOLUCIÓN: empuje CCD sobre LOS ÁNGULOS DE LA POSE — codo /
        hombro (rodilla / cadera) giran lo justo para sacar el bloque
        por donde penetró. Se devuelve una Pose corregida.

   Como la corrección es una función pura de la Pose objetivo, el
   resultado es determinista para cada t: el lerp la suaviza y la
   animación NO parpadea. Se aplica ANTES de lerpPose/applyPose.
   ════════════════════════════════════════════════════════════════ */

const SHRINK = 0.85;
const MAX_ANG = 0.22;      // radianes máximos por articulación y pasada
const STRENGTH = 0.8;      // fracción de la corrección aplicada
const PASSES = 3;          // pasadas de refinado por frame

/* ── OBB + SAT ─────────────────────────────────────────────────── */

interface OBB {
  c: THREE.Vector3;                             // centro (charRoot)
  e: THREE.Vector3;                             // semiejes (tamaños)
  u: [THREE.Vector3, THREE.Vector3, THREE.Vector3]; // ejes
}

const _d = new THREE.Vector3(), _L = new THREE.Vector3();
const _axes: THREE.Vector3[] = Array.from({ length: 15 }, () => new THREE.Vector3());

/** SAT OBB-OBB. El eje devuelto apunta del core AL offender
    (dirección de empuje para sacarlo). null si no hay solape. */
function obbOverlap(core: OBB, off: OBB): { depth: number; axis: THREE.Vector3 } | null {
  _d.subVectors(off.c, core.c);
  let n = 0;
  for (let i = 0; i < 3; i++) { _axes[n++].copy(core.u[i]); _axes[n++].copy(off.u[i]); }
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) _axes[n++].crossVectors(core.u[i], off.u[j]);
  let minDepth = Infinity;
  const best = new THREE.Vector3();
  for (let k = 0; k < 15; k++) {
    _L.copy(_axes[k]);
    if (_L.lengthSq() < 1e-10) continue;
    _L.normalize();
    const ra = core.e.x * Math.abs(core.u[0].dot(_L)) + core.e.y * Math.abs(core.u[1].dot(_L)) + core.e.z * Math.abs(core.u[2].dot(_L));
    const rb = off.e.x * Math.abs(off.u[0].dot(_L)) + off.e.y * Math.abs(off.u[1].dot(_L)) + off.e.z * Math.abs(off.u[2].dot(_L));
    const dist = _d.dot(_L);
    const depth = ra + rb - Math.abs(dist);
    if (depth <= 0) return null;
    if (depth < minDepth) {
      minDepth = depth;
      best.copy(_L);
      if (dist < 0) best.negate(); // apunta core → offender
    }
  }
  return { depth: minDepth, axis: best };
}

/* ── FK analítico desde la Pose (espacio charRoot) ─────────────── */

interface Joint { p: THREE.Vector3; q: THREE.Quaternion }
type Skel = Record<string, Joint>;

const _dq0 = new THREE.Quaternion();

function dq(x: number, y: number, z: number): THREE.Quaternion {
  return _dq0.setFromEuler(new THREE.Euler(x, y, z, "XYZ")).clone();
}

/** posición del hijo = pos padre + offset girado por la q del padre */
function at(jp: THREE.Vector3, q: THREE.Quaternion, x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z).applyQuaternion(q).add(jp);
}

function fk(p: Pose): Skel {
  const hipsQ = dq(p.hipsX, p.hipsY, p.hipsZ);
  const hipsP = new THREE.Vector3(0, 0.66, 0);
  const spineQ = dq(p.lean, p.twist, 0).multiply(hipsQ);
  const spineP = at(hipsP, hipsQ, 0, 0.08, 0);
  const headQ = dq(p.headX, p.headY, 0).multiply(spineQ);
  const headP = at(spineP, spineQ, 0, 0.44, 0);

  const skel: Skel = {
    hips: { p: hipsP, q: hipsQ },
    spine: { p: spineP, q: spineQ },
    head: { p: headP, q: headQ },
  };
  for (const s of [1, -1] as const) {
    const side = s === 1 ? "l" : "r";
    const ua: Vec3 = s === 1 ? p.uaL : p.uaR;
    const fa = s === 1 ? p.faL : p.faR;
    const th = s === 1 ? p.thL : p.thR;
    const thY = s === 1 ? p.thLY : p.thRY;
    const sh = s === 1 ? p.shL : p.shR;

    const uaQ = dq(ua[0], ua[1], ua[2]).multiply(spineQ);
    const uaP = at(spineP, spineQ, 0.37 * s, 0.37, 0);
    const laQ = dq(fa, 0, 0).multiply(uaQ);
    const laP = at(uaP, uaQ, 0, -0.34, 0);
    const ulQ = dq(th, thY, 0).multiply(hipsQ);
    const ulP = at(hipsP, hipsQ, 0.15 * s, -0.10, 0);
    const llQ = dq(sh, 0, 0).multiply(ulQ);
    const llP = at(ulP, ulQ, 0, -0.29, 0);

    skel["upperarm." + side] = { p: uaP, q: uaQ };
    skel["lowerarm." + side] = { p: laP, q: laQ };
    skel["upperleg." + side] = { p: ulP, q: ulQ };
    skel["lowerleg." + side] = { p: llP, q: llQ };
  }
  return skel;
}

/* ── Bloques (misma geometría que voxelPuppet.ts) ──────────────── */

interface BlockDef { off: Vec3; size: Vec3 }

const BLOCKS: Record<string, BlockDef[]> = {
  hips: [{ off: [0, -0.02, 0], size: [0.34, 0.16, 0.25] }],           // pelvis
  spine: [{ off: [0, 0.22, 0], size: [0.50, 0.40, 0.30] }],           // pecho
  head: [{ off: [0, 0.25, 0], size: [0.40, 0.40, 0.40] }],            // cabeza (contenida)
  "upperarm.l": [{ off: [0, -0.16, 0], size: [0.16, 0.30, 0.17] }],   // manga
  "upperarm.r": [{ off: [0, -0.16, 0], size: [0.16, 0.30, 0.17] }],
  "lowerarm.l": [
    { off: [0, -0.14, 0], size: [0.14, 0.26, 0.15] },                 // antebrazo
    { off: [0, -0.33, 0], size: [0.19, 0.17, 0.20] },                 // puño/guante
  ],
  "lowerarm.r": [
    { off: [0, -0.14, 0], size: [0.14, 0.26, 0.15] },
    { off: [0, -0.33, 0], size: [0.19, 0.17, 0.20] },
  ],
  "upperleg.l": [{ off: [0, -0.14, 0], size: [0.21, 0.26, 0.22] }],   // muslo
  "upperleg.r": [{ off: [0, -0.14, 0], size: [0.21, 0.26, 0.22] }],
  "lowerleg.l": [
    { off: [0, -0.13, 0], size: [0.17, 0.24, 0.18] },                 // espinilla
    { off: [0, -0.21, 0.05], size: [0.18, 0.10, 0.28] },              // pie
  ],
  "lowerleg.r": [
    { off: [0, -0.13, 0], size: [0.17, 0.24, 0.18] },
    { off: [0, -0.21, 0.05], size: [0.18, 0.10, 0.28] },
  ],
};

function blockOBB(skel: Skel, joint: string, b: BlockDef): OBB {
  const j = skel[joint];
  const c = new THREE.Vector3(b.off[0], b.off[1], b.off[2]).applyQuaternion(j.q).add(j.p);
  const e = new THREE.Vector3(
    (b.size[0] / 2) * SHRINK, (b.size[1] / 2) * SHRINK, (b.size[2] / 2) * SHRINK);
  const x = new THREE.Vector3(1, 0, 0).applyQuaternion(j.q);
  const y = new THREE.Vector3(0, 1, 0).applyQuaternion(j.q);
  const z = new THREE.Vector3(0, 0, 1).applyQuaternion(j.q);
  return { c, e, u: [x, y, z] };
}

/* ── Pares a comprobar (extremidad → obstáculos) ───────────────── */

const PAIRS = [
  { off: "lowerarm.l", cores: ["hips", "spine", "head"] },
  { off: "lowerarm.r", cores: ["hips", "spine", "head"] },
  { off: "upperarm.l", cores: ["head"] },   // junto al pecho es su sitio natural
  { off: "upperarm.r", cores: ["head"] },
  { off: "upperleg.l", cores: ["upperleg.r"] },
  { off: "lowerleg.l", cores: ["hips", "upperleg.r", "lowerleg.r"] },
  { off: "lowerleg.r", cores: ["hips", "upperleg.l", "lowerleg.l"] },
];

/* ── Correcciones CCD sobre los ángulos de la Pose ─────────────── */

const _r = new THREE.Vector3(), _a = new THREE.Vector3(), _x = new THREE.Vector3();
const _qd = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _ql = new THREE.Quaternion();
const _eul = new THREE.Euler();

/** ángulo de giro deseado: mueve el punto `c` (a radio r del pivote)
    a lo largo de la normal de empuje n */
function pushAngle(pivot: THREE.Vector3, c: THREE.Vector3, n: THREE.Vector3, depth: number): number {
  _r.subVectors(c, pivot);
  if (_r.lengthSq() < 1e-6) return 0;
  _a.crossVectors(_r, n);
  if (_a.lengthSq() < 1e-6) return 0;
  _a.normalize();
  return Math.min(MAX_ANG, (depth / Math.max(0.06, _r.length())) * STRENGTH);
}

/** codo/rodilla: solo pueden girar sobre su X local (= X del padre en mundo) */
function scalarPush(axisParentQ: THREE.Quaternion, pivot: THREE.Vector3, c: THREE.Vector3, n: THREE.Vector3, depth: number): number {
  _r.subVectors(c, pivot);
  if (_r.lengthSq() < 1e-6) return 0;
  _a.crossVectors(_r, n);
  if (_a.lengthSq() < 1e-6) return 0;
  _a.normalize();
  const ang = Math.min(MAX_ANG, (depth / Math.max(0.06, _r.length())) * STRENGTH);
  _x.set(1, 0, 0).applyQuaternion(axisParentQ);
  return ang * _a.dot(_x);
}

/** hombro/cadera: euler completo. Rota la articulación en mundo con
    (axis = r×n, ang) y lo convierte de vuelta a euler XYZ local. */
function eulerPush(curQ: THREE.Quaternion, parentQ: THREE.Quaternion, pivot: THREE.Vector3, c: THREE.Vector3, n: THREE.Vector3, depth: number): Vec3 | null {
  const ang = pushAngle(pivot, c, n, depth);
  if (ang === 0) return null;
  _qd.setFromAxisAngle(_a, ang);            // _a queda cargada por pushAngle
  _qi.copy(parentQ).invert();
  _ql.copy(_qd).multiply(curQ).multiply(_qi);
  _eul.setFromQuaternion(_ql, "XYZ");
  return [_eul.x, _eul.y, _eul.z];
}

/** Aplica la cadena CCD correspondiente al bloque infractor. */
function correct(p: Pose, offJoint: string, skel: Skel, c: THREE.Vector3, n: THREE.Vector3, depth: number): void {
  const side = offJoint.endsWith(".l") ? "l" : "r";
  const ua = skel["upperarm." + side], la = skel["lowerarm." + side];
  const ul = skel["upperleg." + side], ll = skel["lowerleg." + side];

  if (offJoint.startsWith("lowerarm")) {
    // 1) codo
    const dFa = scalarPush(ua.q, la.p, c, n, depth);
    if (side === "l") p.faL += dFa; else p.faR += dFa;
    // 2) hombro (con la orientación ya corregida por el codo)
    const uaQ2 = dq(side === "l" ? p.uaL[0] : p.uaR[0], side === "l" ? p.uaL[1] : p.uaR[1], side === "l" ? p.uaL[2] : p.uaR[2]).multiply(skel.spine.q);
    const e = eulerPush(uaQ2, skel.spine.q, ua.p, c, n, depth);
    if (e) { if (side === "l") p.uaL = e; else p.uaR = e; }
  } else if (offJoint.startsWith("upperarm")) {
    const e = eulerPush(ua.q, skel.spine.q, ua.p, c, n, depth);
    if (e) { if (side === "l") p.uaL = e; else p.uaR = e; }
  } else if (offJoint.startsWith("lowerleg")) {
    // 1) rodilla
    const dSh = scalarPush(ul.q, ll.p, c, n, depth);
    if (side === "l") p.shL += dSh; else p.shR += dSh;
    // 2) cadera (solo X/Y: el eje Z no existe en la Pose de muslo)
    const e = eulerPush(ul.q, skel.hips.q, ul.p, c, n, depth);
    if (e) { if (side === "l") { p.thL = e[0]; p.thLY = e[1]; } else { p.thR = e[0]; p.thRY = e[1]; } }
  } else if (offJoint.startsWith("upperleg")) {
    const e = eulerPush(ul.q, skel.hips.q, ul.p, c, n, depth);
    if (e) { if (side === "l") { p.thL = e[0]; p.thLY = e[1]; } else { p.thR = e[0]; p.thRY = e[1]; } }
  }
}

/* ── Entrada pública ───────────────────────────────────────────── */

/** Devuelve una copia de la Pose con las colisiones resueltas.
    Función pura de la pose → misma t, misma corrección (sin parpadeo). */
export function resolvePoseCollisions(src: Pose): Pose {
  const p = clonePose(src);
  for (let pass = 0; pass < PASSES; pass++) {
    let moved = false;
    for (const pair of PAIRS) {
      const skel = fk(p); // FK fresco por par: las correcciones se acumulan en p
      for (const ob of BLOCKS[pair.off]) {
        const offObb = blockOBB(skel, pair.off, ob);
        for (const coreName of pair.cores) {
          for (const cb of BLOCKS[coreName]) {
            const hit = obbOverlap(blockOBB(skel, coreName, cb), offObb);
            if (!hit) continue;
            correct(p, pair.off, skel, offObb.c, hit.axis, hit.depth);
            moved = true;
          }
        }
      }
    }
    if (!moved) break;
  }
  return p;
}
