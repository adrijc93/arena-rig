import * as THREE from "three";

/* ════════════════════════════════════════════════════════════════
   MUÑECO VOXEL — marioneta propia de bloques (opción 2: cabezón)
   Piezas rígidas colgadas de articulaciones-bisagra. Sin skinning,
   sin pesos: cada bloque es hijo directo de su hueso.

   Nombres de articulaciones = perfil "kaykit" de poseDriver, así
   findRig lo detecta sin tocar nada y TODOS los drivers (procedural,
   horneado, espejo) funcionan desde el primer día.

   Convenciones: mira a +Z · reposo = de pie, brazos abajo ·
   rotation.x negativo = miembro hacia delante.
   ════════════════════════════════════════════════════════════════ */

const SKIN = 0xd9b98f;   // piel
const SHIRT = 0x7d6a58;  // torso
const PANTS = 0x4e4943;  // cadera / muslos
const DARK = 0x2b2724;   // pies

function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
  );
  m.position.set(x, y, z);
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

/* Cara pixelada dibujada en canvas: ojos y sonrisa, estilo voxel */
function faceTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#d9b98f";
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = "#2b2724";
  // ojos (dos bloques)
  g.fillRect(34, 52, 16, 22);
  g.fillRect(78, 52, 16, 22);
  // brillo
  g.fillStyle = "#ffffff";
  g.fillRect(38, 54, 5, 6);
  g.fillRect(82, 54, 5, 6);
  // sonrisa
  g.fillStyle = "#2b2724";
  g.fillRect(52, 88, 24, 6);
  g.fillRect(46, 82, 6, 6);
  g.fillRect(76, 82, 6, 6);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function headMesh(): THREE.Mesh {
  const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.9 });
  const face = new THREE.MeshStandardMaterial({ map: faceTexture(), roughness: 0.9 });
  // caras: +x, -x, +y, -y, +z (frontal), -z
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), [skin, skin, skin, skin, face, skin]);
  m.castShadow = true;
  return m;
}

export function buildVoxelPuppet(): THREE.Object3D {
  const root = new THREE.Group();
  root.name = "voxel-root";

  // ── cadera (raíz del rig) ────────────────────────────────
  const hips = joint(root, "hips", 0, 0.66, 0);
  hips.add(box(0.36, 0.16, 0.26, PANTS, 0, -0.02, 0));

  // ── torso ────────────────────────────────────────────────
  const spine = joint(hips, "spine", 0, 0.08, 0);
  spine.add(box(0.58, 0.40, 0.32, SHIRT, 0, 0.22, 0));

  // ── cabeza (cubo cabezón, pero moderado: ~1/4 del total) ──
  const head = joint(spine, "head", 0, 0.44, 0);
  const hm = headMesh();
  hm.position.set(0, 0.24, 0);
  head.add(hm);

  // ── brazos (bisagras en hombro y codo) ───────────────────
  for (const s of [1, -1] as const) {
    const side = s === 1 ? "l" : "r";
    const ua = joint(spine, `upperarm.${side}`, 0.37 * s, 0.37, 0);
    ua.add(box(0.16, 0.30, 0.17, SHIRT, 0, -0.16, 0));
    const fa = joint(ua, `lowerarm.${side}`, 0, -0.34, 0);
    fa.add(box(0.14, 0.26, 0.15, SKIN, 0, -0.14, 0));
    fa.add(box(0.155, 0.13, 0.16, SKIN, 0, -0.33, 0)); // puño
  }

  // ── piernas (bisagras en cadera y rodilla) ───────────────
  for (const s of [1, -1] as const) {
    const side = s === 1 ? "l" : "r";
    const ul = joint(hips, `upperleg.${side}`, 0.15 * s, -0.10, 0);
    ul.add(box(0.21, 0.26, 0.22, PANTS, 0, -0.14, 0));
    const ll = joint(ul, `lowerleg.${side}`, 0, -0.29, 0);
    ll.add(box(0.17, 0.24, 0.18, SKIN, 0, -0.13, 0));
    ll.add(box(0.18, 0.10, 0.28, DARK, 0, -0.21, 0.05)); // pie hacia +Z
  }

  return root;
}
