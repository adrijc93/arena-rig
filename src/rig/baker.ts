import * as THREE from "three";
import { lerpPose } from "./poseDriver";
import type { Pose, Rig, Vec3 } from "./poseDriver";

/* ════════════════════════════════════════════════════════════════
   HORNO MOCAP → POSE
   Muestrea un AnimationClip fotograma a fotograma y expresa cada
   instante como una Pose de nuestro formato (la inversa exacta de
   rotBone: Δ = P · local · rest⁻¹ · P⁻¹). El resultado se puede
   reproducir con applyPose, mezclar con lerpPose, espejar con
   mirrorPose y editar a mano. Realismo mocap + editabilidad nuestra.
   ════════════════════════════════════════════════════════════════ */

export interface BakedClip {
  fps: number;
  frames: Pose[];
}

const _P = new THREE.Quaternion();
const _R = new THREE.Quaternion();
const _E = new THREE.Euler();

/** Δ en espacio del personaje a partir de las rotaciones actuales */
function deltaOf(rig: Rig, bone: THREE.Object3D, out: THREE.Quaternion) {
  const chain: THREE.Object3D[] = [];
  let cur: THREE.Object3D | null = bone.parent;
  while (cur && cur !== rig.charRoot) { chain.push(cur); cur = cur.parent; }
  _P.set(0, 0, 0, 1);
  for (let i = chain.length - 1; i >= 0; i--) _P.multiply(chain[i].quaternion);
  const rest = rig.rest.get(bone)!;
  out.copy(_P).multiply(bone.quaternion).multiply(_R.copy(rest).invert()).multiply(_P.invert());
}

function rd(rig: Rig, bone: THREE.Object3D, dq: THREE.Quaternion): Vec3 {
  deltaOf(rig, bone, dq);
  _E.setFromQuaternion(dq, "XYZ");
  // convención de autoría: si el rig mira a -Z, deshacer el flip de rotBone
  return rig.flipZ ? [-_E.x, _E.y, -_E.z] : [_E.x, _E.y, _E.z];
}

/** Hornea un clip a `fps` muestras/segundo. Deja el mixer parado al final.
    Si se pasa `snapshot` (estado calibrado), los huesos NO mapeados se
    devuelven a reposo en cada muestra: así el Δ medido se corresponde
    exactamente con lo que applyPose puede reproducir (consistencia). */
export function bakeClip(
  rig: Rig,
  mixer: THREE.AnimationMixer,
  action: THREE.AnimationAction,
  fps = 30,
  snapshot?: Map<THREE.Object3D, { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }>
): BakedClip {
  const dur = action.getClip().duration;
  const n = Math.max(2, Math.round(dur * fps) + 1);
  const frames: Pose[] = [];
  const dq = new THREE.Quaternion();
  const unmapped: THREE.Object3D[] = [];
  if (snapshot) {
    rig.charRoot.traverse((o) => { if (!rig.rest.has(o)) unmapped.push(o); });
  }

  action.reset().play();
  for (let i = 0; i < n; i++) {
    mixer.setTime((i / (n - 1)) * dur);
    // neutralizar huesos no mapeados (DEF-spine suelto, cuello, dedos…)
    for (const o of unmapped) {
      const v = snapshot!.get(o);
      if (v) { o.position.copy(v.p); o.quaternion.copy(v.q); o.scale.copy(v.s); }
    }
    const hips = rd(rig, rig.hips, dq);
    const sp = rig.spine.map((s) => rd(rig, s, dq));
    const head = rd(rig, rig.head, dq);
    const uaR = rd(rig, rig.armUpR, dq), uaL = rd(rig, rig.armUpL, dq);
    const faR = rd(rig, rig.armLoR, dq), faL = rd(rig, rig.armLoL, dq);
    const thR = rd(rig, rig.legUpR, dq), thL = rd(rig, rig.legUpL, dq);
    const shR = rd(rig, rig.legLoR, dq), shL = rd(rig, rig.legLoL, dq);
    frames.push({
      bob: (rig.hips.position.y - rig.hipsBaseY) / rig.unit,
      tx: (rig.hips.position.x - rig.hipsBaseX) / rig.unit,
      tz: (rig.hips.position.z - rig.hipsBaseZ) / rig.unit,
      hipsX: hips[0], hipsY: hips[1], hipsZ: hips[2],
      lean: sp.reduce((a, v) => a + v[0], 0),
      twist: sp.reduce((a, v) => a + v[1], 0),
      headX: head[0], headY: head[1],
      uaR, faR: faR[0], uaL, faL: faL[0],
      thL: thL[0], thLY: thL[1], shL: shL[0],
      thR: thR[0], thRY: thR[1], shR: shR[0],
      ankL: rig.footL ? rd(rig, rig.footL, dq) : undefined,
      ankR: rig.footR ? rd(rig, rig.footR, dq) : undefined,
      claL: rig.claL ? rd(rig, rig.claL, dq) : undefined,
      claR: rig.claR ? rd(rig, rig.claR, dq) : undefined,
    });
  }
  action.stop();
  return { fps, frames };
}

/** Reproduce un clip horneado en bucle, interpolando entre muestras */
export function sampleBaked(bc: BakedClip, t: number): Pose {
  const { fps, frames } = bc;
  const dur = (frames.length - 1) / fps;
  const tt = ((t % dur) + dur) % dur;
  const f = tt * fps;
  const i = Math.min(frames.length - 2, Math.floor(f));
  return lerpPose(frames[i], frames[i + 1], f - i);
}
