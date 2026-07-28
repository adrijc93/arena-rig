import * as THREE from "three";

/* ════════════════════════════════════════════════════════════════
   MUÑECO VOXEL — marioneta propia de 15 bloques rígidos.

   Estructura: bisagras (Object3D) con cajas como malla, en la jerarquía
   que espera poseDriver (hips → spine → head/brazos, hips → piernas).
   Nombres de articulación compatibles con el perfil "kaykit":
   upperarm.l, lowerleg.r, etc. — findRig la detecta como kaykit.

   La PIEL (colores + rasgos) viene de una spec: así LUDUS (gladiador con
   casco y peto) y MMA (guantes, shorts) comparten exactamente el mismo
   rig y las mismas animaciones procedurales.
   ════════════════════════════════════════════════════════════════ */

export interface PuppetSpec {
  skin: number;        // piel (cabeza, antebrazos, espinillas)
  shirt: number;       // torso
  sleeves: number;     // mangas (brazos)
  pants: number;       // pantalón / faldellín
  boots: number;       // pies
  helmet?: number;     // casco gladiador (LUDUS)
  chestPlate?: number; // peto gladiador (LUDUS)
  gloves?: number;     // guantes (MMA)
  shoulderPads?: number;
}

function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0, collide?: "core" | "limb"): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  if (collide) m.userData.collide = collide;
  return m;
}

/** Cabeza: bloque de piel con cara dibujada en un canvas (ojos + boca) */
function headMesh(skin: number, hs: number): THREE.Mesh {
  const face = document.createElement("canvas");
  face.width = 64; face.height = 64;
  const fc = face.getContext("2d")!;
  fc.fillStyle = "#e8b98a"; fc.fillRect(0, 0, 64, 64);
  fc.fillStyle = "#26221f";
  fc.fillRect(14, 26, 10, 12);  // ojo izquierdo
  fc.fillRect(40, 26, 10, 12);  // ojo derecho
  fc.fillRect(22, 48, 20, 5);   // boca
  const faceTex = new THREE.CanvasTexture(face);
  faceTex.magFilter = THREE.NearestFilter;
  const plain = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.9 });
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.9 });
  // materiales: +x, -x, +y, -y, +z (cara al frente), -z
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(hs, hs, hs),
    [plain, plain, plain, plain, faceMat, plain]
  );
  m.castShadow = true;
  return m;
}

function joint(parent: THREE.Object3D, name: string, x: number, y: number, z: number): THREE.Object3D {
  const j = new THREE.Object3D();
  j.name = name;
  j.position.set(x, y, z);
  parent.add(j);
  return j;
}

export function buildVoxelPuppet(spec: PuppetSpec): THREE.Group {
  const root = new THREE.Group();
  root.name = "voxel-root";
  const { skin, shirt, sleeves, pants, boots } = spec;
  const torso = spec.chestPlate !== undefined ? spec.chestPlate : shirt;

  /* ── cadera (raíz del rig) ── */
  const hips = joint(root, "hips", 0, 0.66, 0);
  hips.add(box(0.36, 0.16, 0.26, pants, 0, -0.02, 0, "core"));
  for (const sx of [-0.14, 0, 0.14]) {
    hips.add(box(0.12, 0.14, 0.27, pants, sx, -0.15, 0)); // tiras del faldellín
  }

  /* ── tronco ── */
  const spine = joint(hips, "spine", 0, 0.08, 0);
  spine.add(box(0.58, 0.40, 0.32, torso, 0, 0.22, 0, "core"));
  if (spec.chestPlate !== undefined) {
    // peto: bloque ligeramente mayor envolviendo el torso
    spine.add(box(0.62, 0.34, 0.36, spec.chestPlate, 0, 0.26, 0, "core"));
  }

  /* ── cabeza (con cara al frente) ── */
  const head = joint(spine, "head", 0, 0.44, 0);
  const hs = 0.30; // un poco más pequeña que la caja original (0.34)
  const hm = headMesh(skin, hs);
  hm.position.set(0, 0.24, 0);
  hm.userData.collide = "core";
  head.add(hm);
  if (spec.helmet !== undefined) {
    // casco gladiador: capa superior + carrillera + cresta
    head.add(box(hs + 0.04, 0.10, hs + 0.04, spec.helmet, 0, 0.35, 0));
    head.add(box(hs + 0.04, 0.16, 0.06, spec.helmet, 0, 0.22, -0.15));
    head.add(box(0.06, 0.16, hs + 0.08, 0x8e2f2f, 0, 0.44, 0)); // cresta roja
  }

  /* ── brazos ── */
  for (const [side, s] of [["l", 1], ["r", -1]] as const) {
    const ua = joint(spine, `upperarm.${side}`, 0.37 * s, 0.37, 0);
    ua.add(box(0.16, 0.30, 0.17, sleeves, 0, -0.16, 0, "limb"));
    if (spec.shoulderPads !== undefined) {
      ua.add(box(0.22, 0.10, 0.23, spec.shoulderPads, 0, -0.02, 0)); // hombrera
    }
    const fa = joint(ua, `lowerarm.${side}`, 0, -0.34, 0);
    fa.add(box(0.14, 0.26, 0.15, skin, 0, -0.14, 0, "limb"));
    if (spec.gloves !== undefined) {
      fa.add(box(0.19, 0.17, 0.20, spec.gloves, 0, -0.33, 0, "limb")); // guante MMA
    } else {
      fa.add(box(0.155, 0.13, 0.16, skin, 0, -0.33, 0, "limb")); // puño
    }
  }

  /* ── piernas ── */
  for (const [side, s] of [["l", 1], ["r", -1]] as const) {
    const ul = joint(hips, `upperleg.${side}`, 0.15 * s, -0.10, 0);
    ul.add(box(0.21, 0.26, 0.22, pants, 0, -0.14, 0, "limb"));
    const ll = joint(ul, `lowerleg.${side}`, 0, -0.29, 0);
    ll.add(box(0.17, 0.24, 0.18, skin, 0, -0.13, 0, "limb"));
    ll.add(box(0.18, 0.10, 0.28, boots, 0, -0.21, 0.05, "limb")); // pie hacia +Z
  }

  return root;
}
