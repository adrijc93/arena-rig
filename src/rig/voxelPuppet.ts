import * as THREE from "three";

/* ════════════════════════════════════════════════════════════════
   MUÑECO VOXEL — marioneta propia de bloques, PARAMÉTRICA.
   Un esqueleto de 15 piezas + "pieles" definidas por PuppetSpec:
   colores, guantes, casco, peto, hombreras, faldón… La
   personalización de personajes (pelo, tattoos, sangre, ropa)
   se enchufa aquí como más opciones del spec.

   Nombres de articulaciones = perfil "kaykit" de poseDriver, así
   findRig lo detecta sin tocar nada y TODOS los drivers (procedural,
   horneado, espejo) funcionan con cualquier piel.

   Convenciones: mira a +Z · reposo = de pie, brazos abajo ·
   rotation.x negativo = miembro hacia delante.
   ════════════════════════════════════════════════════════════════ */

/** Facciones de la cara: se dibujan en la textura (cejas, barba) o se
    construyen con bloques (pelo). Todo opcional y combinable. */
export interface FaceSpec {
  brows?: "normal" | "fruncido";
  beard?: "none" | "perilla" | "completa";
  beardColor?: number;
  hair?: "none" | "corto" | "melena" | "cresta";
  hairColor?: number;
}

export interface PuppetSpec {
  skin?: number;         // piel
  torso?: number;        // camiseta / torso desnudo
  sleeves?: number;      // mangas (por defecto = torso)
  pants?: number;        // cadera / muslos (pantalón o shorts)
  feet?: number;         // calzado / pies descalzos
  headSize?: number;     // arista del cubo de la cabeza
  face?: FaceSpec;       // facciones: cejas, barba, pelo
  gloves?: number;       // puños grandes de este color (MMA)
  helmet?: number;       // casco metálico con cresta (LUDUS)
  chestPlate?: number;   // peto por encima del torso (LUDUS)
  shoulderPads?: number; // hombreras (LUDUS)
  skirt?: number;        // faldón de tiras de cuero (LUDUS)
}

const D = {
  skin: 0xd9b98f,
  torso: 0x7d6a58,
  pants: 0x4e4943,
  feet: 0x2b2724,
  head: 0.34,            // cabeza CONTENIDA (~1/5 del total): no roba plano
};

const css = (hex: number) => "#" + hex.toString(16).padStart(6, "0");

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

function joint(parent: THREE.Object3D, name: string, x: number, y: number, z: number): THREE.Object3D {
  const j = new THREE.Object3D();
  j.name = name;
  j.position.set(x, y, z);
  parent.add(j);
  return j;
}

/* Cara pixelada dibujada en canvas: ojos y sonrisa, estilo voxel.
   Con FaceSpec: cejas fruncidas, perilla o barba completa. */
function faceTexture(skin: number, face?: FaceSpec): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = css(skin);
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
  // cejas fruncidas: dos bloques inclinados hacia el entrecejo
  if (face?.brows === "fruncido") {
    g.save();
    g.translate(42, 46); g.rotate(0.32); g.fillRect(-15, -4, 30, 8);
    g.restore();
    g.save();
    g.translate(86, 46); g.rotate(-0.32); g.fillRect(-15, -4, 30, 8);
    g.restore();
  }
  // vello facial
  const bc = css(face?.beardColor ?? 0x2b2118);
  if (face?.beard === "perilla") {
    g.fillStyle = bc;
    g.fillRect(54, 100, 20, 18);          // mechón bajo el labio
  } else if (face?.beard === "completa") {
    g.fillStyle = bc;
    g.fillRect(22, 102, 84, 26);          // mandíbula
    g.fillRect(20, 62, 12, 44);           // patilla izquierda
    g.fillRect(96, 62, 12, 44);           // patilla derecha
    g.fillRect(46, 96, 36, 8);            // bigote
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function headMesh(skin: number, size: number, face?: FaceSpec): THREE.Mesh {
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.9 });
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTexture(skin, face), roughness: 0.9 });
  // caras: +x, -x, +y, -y, +z (frontal), -z
  const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), [skinMat, skinMat, skinMat, skinMat, faceMat, skinMat]);
  m.castShadow = true;
  return m;
}

export function buildVoxelPuppet(spec: PuppetSpec = {}): THREE.Object3D {
  const skin = spec.skin ?? D.skin;
  const torso = spec.torso ?? D.torso;
  const sleeves = spec.sleeves ?? torso;
  const pants = spec.pants ?? D.pants;
  const feet = spec.feet ?? D.feet;
  const hs = spec.headSize ?? D.head;

  const root = new THREE.Group();
  root.name = "voxel-root";

  // ── cadera (raíz del rig) ────────────────────────────────
  const hips = joint(root, "hips", 0, 0.66, 0);
  hips.add(box(0.36, 0.16, 0.26, pants, 0, -0.02, 0, "core"));
  if (spec.skirt !== undefined) {
    // faldón de tiras de cuero colgando de la cintura
    for (const [x, z, ry] of [[-0.13, 0.12, 0], [0, 0.14, 0], [0.13, 0.12, 0],
      [-0.13, -0.12, 0], [0, -0.14, 0], [0.13, -0.12, 0],
      [-0.17, 0, Math.PI / 2], [0.17, 0, Math.PI / 2]] as const) {
      const tira = box(0.11, 0.20, 0.02, spec.skirt, x, -0.16, z);
      tira.rotation.y = ry;
      hips.add(tira);
    }
  }

  // ── torso ────────────────────────────────────────────────
  const spine = joint(hips, "spine", 0, 0.08, 0);
  spine.add(box(0.58, 0.40, 0.32, torso, 0, 0.22, 0, "core"));
  if (spec.chestPlate !== undefined) {
    // peto: bloque ligeramente mayor envolviendo el torso
    spine.add(box(0.62, 0.34, 0.36, spec.chestPlate, 0, 0.26, 0, "core"));
  }

  // ── cabeza (cubo contenido: ~1/5 del total) ──
  const head = joint(spine, "head", 0, 0.44, 0);
  const face = spec.face;
  const hm = headMesh(skin, hs, face);
  const cy = 0.05 + hs / 2;      // la base del cubo queda 0.05 sobre la articulación
  const top = 0.05 + hs;         // superficie superior de la cabeza
  hm.position.set(0, cy, 0);
  hm.userData.collide = "core";
  head.add(hm);

  // pelo: bloques sobre/alrededor de la cabeza (corto, melena o cresta)
  const hair = face?.hair ?? "none";
  const hc = face?.hairColor ?? 0x2b2118;
  if (hair === "corto") {
    head.add(box(hs + 0.02, 0.09, hs + 0.02, hc, 0, top + 0.03, -0.01));
  } else if (hair === "melena") {
    head.add(box(hs + 0.04, 0.10, hs + 0.04, hc, 0, top + 0.04, -0.02));
    head.add(box(hs + 0.04, 0.30, 0.06, hc, 0, top - 0.12, -(hs / 2 + 0.03)));       // cascada trasera
    head.add(box(0.05, 0.22, hs * 0.7, hc, -(hs / 2 + 0.01), top - 0.10, -0.03));    // lado izquierdo
    head.add(box(0.05, 0.22, hs * 0.7, hc, hs / 2 + 0.01, top - 0.10, -0.03));       // lado derecho
  } else if (hair === "cresta") {
    head.add(box(0.07, 0.16, hs + 0.06, hc, 0, top + 0.08, -0.02));
  }

  if (spec.helmet !== undefined) {
    // casco: gorro metálico que deja la cara libre + cresta
    head.add(box(hs + 0.03, 0.16, hs + 0.03, spec.helmet, 0, top + 0.02, -0.01));
    head.add(box(0.06, 0.10, hs + 0.10, 0x8c2f2f, 0, top + 0.13, -0.02)); // cresta roja
    // carrillera trasera
    head.add(box(hs + 0.03, 0.20, 0.06, spec.helmet, 0, 0.16, -(hs / 2 + 0.005)));
  }

  // ── brazos (bisagras en hombro y codo) ───────────────────
  for (const s of [1, -1] as const) {
    const side = s === 1 ? "l" : "r";
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

  // ── piernas (bisagras en cadera y rodilla) ───────────────
  for (const s of [1, -1] as const) {
    const side = s === 1 ? "l" : "r";
    const ul = joint(hips, `upperleg.${side}`, 0.15 * s, -0.10, 0);
    ul.add(box(0.21, 0.26, 0.22, pants, 0, -0.14, 0, "limb"));
    const ll = joint(ul, `lowerleg.${side}`, 0, -0.29, 0);
    ll.add(box(0.17, 0.24, 0.18, skin, 0, -0.13, 0, "limb"));
    ll.add(box(0.18, 0.10, 0.28, feet, 0, -0.21, 0.05, "limb")); // pie hacia +Z
  }

  return root;
}

/* ── presets de cara para el personalizador del lab ───────────── */
export const FACE_PRESETS: { id: string; label: string; face: FaceSpec }[] = [
  { id: "base", label: "🙂 Base", face: {} },
  { id: "serio", label: "😠 Serio", face: { brows: "fruncido" } },
  { id: "barba", label: "🧔 Barba", face: { beard: "completa" } },
  { id: "perilla", label: "🐐 Perilla", face: { beard: "perilla", brows: "fruncido" } },
  { id: "corto", label: "✂️ Pelo", face: { hair: "corto", hairColor: 0x2b2118 } },
  { id: "melena", label: "🎸 Melena", face: { hair: "melena", hairColor: 0x3a2a1a } },
  { id: "cresta", label: "🐓 Cresta", face: { hair: "cresta", hairColor: 0x8c2f2f, brows: "fruncido" } },
  { id: "veterano", label: "🧓 Veterano", face: { hair: "corto", hairColor: 0x9a938c, beard: "completa", beardColor: 0x8a837c } },
];
