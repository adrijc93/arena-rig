import * as THREE from "three";

/* ════════════════════════════════════════════════════════════════
   DETECTOR DE COLISIONES del muñeco voxel.
   Los bloques se marcan al construir el muñeco con
   userData.collide = "core" (cuerpo: pelvis, pecho, cabeza)
   o "limb" (extremidades). Cada frame, tras aplicar la pose:

     1. DETECCIÓN: OBB contra OBB con SAT (15 ejes) entre cada
        bloque "limb" y los "core" (y pierna contra pierna).
     2. RESOLUCIÓN: empuje tipo CCD — se rota la articulación más
        cercana (codo, luego hombro / rodilla, luego cadera) en la
        dirección que saca el bloque por donde penetró, en ángulos
        pequeños durante 2–3 pasadas. Suave y estable.

   Los bloques se encogen un 15% (SHRINK) para permitir el contacto
   visual sin permitir la penetración real. Las correcciones NO se
   acumulan entre frames: applyPose recoloca cada frame.
   ════════════════════════════════════════════════════════════════ */

const SHRINK = 0.85;
const MAX_ANG = 0.22;      // radianes máximos por articulación y pasada
const STRENGTH = 0.7;      // fracción de la corrección aplicada

interface OBB {
  c: THREE.Vector3;                 // centro (mundo)
  e: THREE.Vector3;                 // semiejes (tamaños)
  u: [THREE.Vector3, THREE.Vector3, THREE.Vector3]; // ejes (mundo)
}

const _obbA: OBB = { c: new THREE.Vector3(), e: new THREE.Vector3(), u: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] };
const _obbB: OBB = { c: new THREE.Vector3(), e: new THREE.Vector3(), u: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] };

function meshOBB(m: THREE.Mesh, out: OBB): OBB {
  const p = (m.geometry as THREE.BoxGeometry).parameters;
  out.c.setFromMatrixPosition(m.matrixWorld);
  out.e.set((p.width / 2) * SHRINK, (p.height / 2) * SHRINK, (p.depth / 2) * SHRINK);
  const el = m.matrixWorld.elements;
  out.u[0].set(el[0], el[1], el[2]).normalize();
  out.u[1].set(el[4], el[5], el[6]).normalize();
  out.u[2].set(el[8], el[9], el[10]).normalize();
  return out;
}

const _d = new THREE.Vector3(), _L = new THREE.Vector3();
const _axes: THREE.Vector3[] = Array.from({ length: 15 }, () => new THREE.Vector3());

/** SAT OBB-OBB. core→offender: el eje devuelto apunta del core AL offender
    (dirección de empuje para sacar al offender). null si no hay solape. */
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

interface Pair {
  off: string;        // articulación cuyos bloques "limb" se comprueban
  ccd: string[];      // articulaciones a corregir, de la más cercana a la más lejana
  cores: string[];    // articulaciones cuyos bloques "core"/"limb" hacen de obstáculo
}

const PAIRS: Pair[] = [
  // antebrazos + puños contra pelvis / pecho / cabeza
  { off: "lowerarm.l", ccd: ["lowerarm.l", "upperarm.l"], cores: ["hips", "spine", "head"] },
  { off: "lowerarm.r", ccd: ["lowerarm.r", "upperarm.r"], cores: ["hips", "spine", "head"] },
  // brazos solo contra la cabeza (junto al pecho es su sitio natural)
  { off: "upperarm.l", ccd: ["upperarm.l"], cores: ["head"] },
  { off: "upperarm.r", ccd: ["upperarm.r"], cores: ["head"] },
  // piernas: muslo contrario, espinilla/pie contra pierna contraria y pelvis
  { off: "upperleg.l", ccd: ["upperleg.l"], cores: ["upperleg.r"] },
  { off: "lowerleg.l", ccd: ["lowerleg.l", "upperleg.l"], cores: ["hips", "upperleg.r", "lowerleg.r"] },
  { off: "lowerleg.r", ccd: ["lowerleg.r", "upperleg.r"], cores: ["hips", "upperleg.l", "lowerleg.l"] },
];

interface Cache {
  joints: Map<string, THREE.Object3D>;
  meshes: Map<string, THREE.Mesh[]>;
}
const _cache = new WeakMap<THREE.Object3D, Cache>();

function getCache(root: THREE.Object3D): Cache {
  let c = _cache.get(root);
  if (c) return c;
  c = { joints: new Map(), meshes: new Map() };
  root.traverse((o) => {
    if (!o.name) return;
    c.joints.set(o.name, o);
    const ms = o.children.filter((ch): ch is THREE.Mesh =>
      (ch as THREE.Mesh).isMesh && !!(ch as THREE.Mesh).userData.collide);
    if (ms.length) c.meshes.set(o.name, ms);
  });
  _cache.set(root, c);
  return c;
}

const _r = new THREE.Vector3(), _axis = new THREE.Vector3();
const _qp = new THREE.Quaternion(), _qdl = new THREE.Quaternion(), _qdw = new THREE.Quaternion();
const _jp = new THREE.Vector3();

/** Rota una articulación como si el mundo la girara `ang` rad alrededor de
    `axisWorld` (conversión mundo → local por conjugación del padre). */
function rotateJointWorld(j: THREE.Object3D, axisWorld: THREE.Vector3, ang: number): void {
  if (!j.parent) return;
  j.parent.getWorldQuaternion(_qp);
  _qdw.setFromAxisAngle(axisWorld, ang);
  _qdl.copy(_qp).invert().multiply(_qdw).multiply(_qp);
  j.quaternion.premultiply(_qdl);
  j.updateWorldMatrix(true, true);
}

export function resolvePuppetCollisions(root: THREE.Object3D, iterations = 2): void {
  const cache = getCache(root);
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (const pair of PAIRS) {
      const offMeshes = cache.meshes.get(pair.off);
      if (!offMeshes) continue;
      for (const om of offMeshes) {
        for (const coreName of pair.cores) {
          const coreMeshes = cache.meshes.get(coreName);
          if (!coreMeshes) continue;
          for (const cm of coreMeshes) {
            const hit = obbOverlap(meshOBB(cm, _obbB), meshOBB(om, _obbA));
            if (!hit) continue;
            moved = true;
            // empuje CCD: articulación más cercana primero; el eje de giro
            // es el que mueve el centro del bloque a lo largo del empuje
            for (const jName of pair.ccd) {
              const j = cache.joints.get(jName);
              if (!j) continue;
              _jp.setFromMatrixPosition(j.matrixWorld);
              _r.subVectors(meshOBB(om, _obbA).c, _jp);
              if (_r.lengthSq() < 1e-6) continue;
              _axis.crossVectors(_r, hit.axis);
              if (_axis.lengthSq() < 1e-6) continue;
              _axis.normalize();
              const ang = Math.min(MAX_ANG, (hit.depth / Math.max(0.06, _r.length())) * STRENGTH);
              rotateJointWorld(j, _axis, ang);
            }
          }
        }
      }
    }
    if (!moved) break;
  }
}
