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
  mouth?: "sonrisa" | "serio";
  beard?: "none" | "perilla" | "completa" | "stubble";
  beardColor?: number;
  nose?: "recta" | "ancha" | "afilada" | "chata" | "aguilena";
  hair?: "none" | "rapado" | "corto" | "melena" | "cresta" | "papakha";
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
  head: 0.40,            // cabeza equilibrada: suficiente para facciones reconocibles
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
  /* PROPORCIÓN VOXEL: los rasgos llenan el 60-70% de la cara. Si son
     pequeños, la cabeza queda "en blanco" y sin personalidad. */
  // sombreado: cuencas, nariz, frente, pómulos (alfa fuerte: también
  // debe verse sobre pieles oscuras)
  g.fillStyle = "rgba(25,16,12,0.16)";
  g.fillRect(24, 44, 32, 34);              // cuenca izquierda
  g.fillRect(72, 44, 32, 34);              // cuenca derecha
  g.fillStyle = "rgba(25,16,12,0.22)";
  g.fillRect(56, 58, 16, 26);              // nariz
  g.fillRect(56, 84, 16, 6);               // sombra bajo la nariz
  g.fillStyle = "rgba(255,255,255,0.16)";
  g.fillRect(56, 58, 5, 22);               // brillo del puente
  g.fillStyle = "rgba(25,16,12,0.10)";
  g.fillRect(18, 6, 92, 32);               // frente
  g.fillStyle = "rgba(25,16,12,0.16)";
  g.fillRect(26, 80, 20, 7);               // pómulo izquierdo
  g.fillRect(82, 80, 20, 7);               // pómulo derecho
  g.fillRect(48, 86, 5, 9);                // surco nasolabial izquierdo
  g.fillRect(75, 86, 5, 9);                // surco nasolabial derecho
  g.fillStyle = "rgba(120,60,50,0.28)";
  g.fillRect(50, 88, 28, 12);              // labios (tinte cálido bajo la boca)
  // ojos GRANDES (cada uno ~17% del ancho de la cara)
  g.fillStyle = "#211d1a";
  g.fillRect(28, 50, 22, 26);
  g.fillRect(78, 50, 22, 26);
  // brillo
  g.fillStyle = "#ffffff";
  g.fillRect(32, 52, 6, 7);
  g.fillRect(82, 52, 6, 7);
  // boca GRANDE: sonrisa por defecto; "serio" = línea recta
  g.fillStyle = "#211d1a";
  if (face?.mouth === "serio") {
    g.fillRect(44, 92, 40, 8);
    g.fillStyle = "rgba(25,16,12,0.30)";
    g.fillRect(42, 90, 5, 10);             // comisuras hundidas
    g.fillRect(81, 90, 5, 10);
  } else {
    g.fillRect(48, 92, 32, 8);
    g.fillRect(42, 84, 8, 8);
    g.fillRect(78, 84, 8, 8);
  }
  // cejas GRANDES: línea base siempre; "fruncido" las inclina al entrecejo
  g.fillStyle = "rgba(33,29,26,0.9)";
  g.fillRect(26, 42, 26, 8);
  g.fillRect(76, 42, 26, 8);
  if (face?.brows === "fruncido") {
    g.fillStyle = "#211d1a";
    g.save();
    g.translate(41, 45); g.rotate(0.32); g.fillRect(-18, -5, 36, 10);
    g.restore();
    g.save();
    g.translate(87, 45); g.rotate(-0.32); g.fillRect(-18, -5, 36, 10);
    g.restore();
  }
  // vello facial: GRANDE, que cubra de verdad la mitad inferior de la cara
  const bc = css(face?.beardColor ?? 0x2b2118);
  if (face?.beard === "perilla") {
    g.fillStyle = bc;
    g.fillRect(44, 96, 40, 32);           // mechón ancho: barbilla entera
    g.fillRect(48, 88, 32, 10);           // bigote unido a la perilla
  } else if (face?.beard === "completa") {
    g.fillStyle = bc;
    g.fillRect(12, 96, 104, 32);          // mandíbula y barbilla: todo el tercio inferior
    g.fillRect(10, 56, 20, 44);           // patilla izquierda (sube hasta la sien)
    g.fillRect(98, 56, 20, 44);           // patilla derecha
    g.fillRect(38, 88, 52, 10);           // bigote ancho (tapa la boca, como en real)
    // textura: píxeles claros dispersos para que no sea un bloque plano
    g.fillStyle = "rgba(255,255,255,0.08)";
    for (const [px, py] of [[20, 104], [34, 118], [52, 106], [70, 120], [88, 108], [102, 118], [16, 70], [106, 76], [46, 92], [78, 92]] as const) {
      g.fillRect(px, py, 4, 4);
    }
  } else if (face?.beard === "stubble") {
    // barba incipiente: velo oscuro translúcido en mandíbula y mejillas
    g.fillStyle = "rgba(35,28,22,0.32)";
    g.fillRect(14, 94, 100, 34);          // mandíbula
    g.fillRect(12, 60, 18, 38);           // patilla izquierda
    g.fillRect(98, 60, 18, 38);           // patilla derecha
    g.fillRect(42, 88, 44, 8);            // sombra de bigote
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
  if (hair === "papakha") {
    // papakha de lana (el gorro icónico de Khabib): cilindro grueso que
    // SOBRESALE de la cabeza, color crema — se reconoce al instante
    head.add(box(hs + 0.10, 0.15, hs + 0.10, hc, 0, top + 0.065, -0.01));
    head.add(box(hs + 0.06, 0.05, hs + 0.06, hc, 0, top - 0.01, -0.01)); // borde bajo
  } else if (hair === "rapado") {
    // rapado al cero: lámina fina PEGADA al cráneo (Jones, Silva) —
    // si sobresale parece una tapa flotando
    head.add(box(hs + 0.002, 0.028, hs + 0.002, hc, 0, top + 0.004, -0.004));
  } else if (hair === "corto") {
    head.add(box(hs + 0.02, 0.09, hs + 0.02, hc, 0, top + 0.03, -0.01));
  } else if (hair === "melena") {
    head.add(box(hs + 0.04, 0.10, hs + 0.04, hc, 0, top + 0.04, -0.02));
    head.add(box(hs + 0.04, 0.30, 0.06, hc, 0, top - 0.12, -(hs / 2 + 0.03)));       // cascada trasera
    head.add(box(0.05, 0.22, hs * 0.7, hc, -(hs / 2 + 0.01), top - 0.10, -0.03));    // lado izquierdo
    head.add(box(0.05, 0.22, hs * 0.7, hc, hs / 2 + 0.01, top - 0.10, -0.03));       // lado derecho
  } else if (hair === "cresta") {
    head.add(box(0.07, 0.16, hs + 0.06, hc, 0, top + 0.08, -0.02));
  }

  // ── RELIEVE FACIAL 3D: la cara sobresale del cubo ────────────
  // La textura solo se lee de frente; el relieve (nariz, orejas, cejas,
  // barba 3D) se lee desde CUALQUIER ángulo y recibe luz y sombra.
  const zf = hs / 2;                       // plano frontal de la cara
  // nariz 3D con FORMAS: cada luchador tiene la suya (perfil reconocible)
  const nose = face?.nose ?? "recta";
  if (nose === "ancha") {
    // ancha y aplastada (Jon Jones)
    head.add(box(hs * 0.26, hs * 0.16, 0.05, skin, 0, cy, zf + 0.02));
  } else if (nose === "afilada") {
    // fina y larga, sobresale más (McGregor)
    head.add(box(hs * 0.12, hs * 0.26, 0.07, skin, 0, cy + hs * 0.03, zf + 0.028));
  } else if (nose === "chata") {
    // ancha pero baja y pegada (Anderson Silva)
    head.add(box(hs * 0.24, hs * 0.11, 0.035, skin, 0, cy - hs * 0.02, zf + 0.012));
  } else if (nose === "aguilena") {
    // puente alto que sobresale arriba, cae recta (Khabib)
    const nb = box(hs * 0.14, hs * 0.26, 0.06, skin, 0, cy + hs * 0.05, zf + 0.02);
    nb.rotation.x = -0.18;
    head.add(nb);
  } else {
    // recta: la estándar
    head.add(box(hs * 0.16, hs * 0.20, 0.05, skin, 0, cy + hs * 0.02, zf + 0.02));
  }
  // orejas
  head.add(box(0.03, hs * 0.22, hs * 0.16, skin, -(zf + 0.008), cy + 0.02, -0.01));
  head.add(box(0.03, hs * 0.22, hs * 0.16, skin, zf + 0.008, cy + 0.02, -0.01));
  // cejas en relieve (solo fruncido: marca el enfado y da sombra sobre los ojos)
  const bc3 = face?.beardColor ?? 0x2b2118;
  if (face?.brows === "fruncido") {
    const bl = box(hs * 0.30, 0.028, 0.03, bc3, -hs * 0.18, cy + hs * 0.23, zf + 0.012);
    bl.rotation.z = -0.22; head.add(bl);
    const br = box(hs * 0.30, 0.028, 0.03, bc3, hs * 0.18, cy + hs * 0.23, zf + 0.012);
    br.rotation.z = 0.22; head.add(br);
  }
  // barba 3D ESCALONADA: bigote, mejillas, mandíbula y punta, cada una a
  // su profundidad, y la barba CUELGA bajo el mentón como una de verdad.
  // (La placa única de antes parecía un bloque flotando delante de la cara.)
  if (face?.beard === "completa") {
    // empieza BAJO la boca: deja libres ojos, nariz y pómulos (si sube,
    // se convierte en un muro que se traga la cara)
    head.add(box(hs * 0.46, 0.04, 0.03, bc3, 0, cy - hs * 0.15, zf + 0.008));            // bigote bajo la nariz
    head.add(box(hs * 0.86, hs * 0.13, 0.028, bc3, 0, cy - hs * 0.29, zf + 0.005));      // mejillas
    head.add(box(hs * 0.78, hs * 0.20, 0.042, bc3, 0, cy - hs * 0.43, zf + 0.010));      // mandíbula principal
    head.add(box(hs * 0.55, hs * 0.17, 0.06, bc3, 0, cy - hs * 0.58, zf + 0.015));       // punta de la barbilla (cuelga)
    head.add(box(0.04, hs * 0.50, hs * 0.55, bc3, -(zf + 0.008), cy - hs * 0.20, 0.02)); // patilla/mejilla izq
    head.add(box(0.04, hs * 0.50, hs * 0.55, bc3, zf + 0.008, cy - hs * 0.20, 0.02));    // patilla/mejilla der
    head.add(box(hs * 0.62, 0.06, hs * 0.68, bc3, 0, cy - hs / 2 + 0.012, 0.02));        // bajo la barbilla
  } else if (face?.beard === "perilla") {
    head.add(box(hs * 0.44, 0.035, 0.028, bc3, 0, cy - hs * 0.15, zf + 0.006));          // bigote
    head.add(box(hs * 0.38, hs * 0.17, 0.042, bc3, 0, cy - hs * 0.36, zf + 0.012));      // mechón
    head.add(box(hs * 0.27, hs * 0.14, 0.052, bc3, 0, cy - hs * 0.50, zf + 0.022));      // punta del mechón (cuelga)
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

/* ── presets de cara para el personalizador del lab ─────────────
   Los "famosos" llevan tono de piel propio: parecidos reconocibles. */
export interface FacePreset { id: string; label: string; skin?: number; face: FaceSpec }
export const FACE_PRESETS: FacePreset[] = [
  { id: "base", label: "🙂 Base", face: {} },
  { id: "serio", label: "😠 Serio", face: { brows: "fruncido", mouth: "serio" } },
  { id: "barba", label: "🧔 Barba", face: { beard: "completa" } },
  { id: "perilla", label: "🐐 Perilla", face: { beard: "perilla", brows: "fruncido" } },
  { id: "corto", label: "✂️ Pelo", face: { hair: "corto", hairColor: 0x2b2118 } },
  { id: "melena", label: "🎸 Melena", face: { hair: "melena", hairColor: 0x3a2a1a } },
  { id: "cresta", label: "🐓 Cresta", face: { hair: "cresta", hairColor: 0x8c2f2f, brows: "fruncido" } },
  { id: "veterano", label: "🧓 Veterano", face: { hair: "corto", hairColor: 0x9a938c, beard: "completa", beardColor: 0x8a837c } },
  // ── inspirados en leyendas de UFC ──
  { id: "aguila", label: "🦅 El Águila", skin: 0xc89878,
    face: { hair: "papakha", hairColor: 0xe8dcc0, beard: "completa", beardColor: 0x14100c, brows: "fruncido", mouth: "serio", nose: "aguilena" } },
  { id: "notorio", label: "☘️ El Notorio", skin: 0xdbb48a,
    face: { hair: "corto", hairColor: 0x8a5c34, beard: "completa", beardColor: 0x8a5c34, brows: "fruncido", mouth: "serio", nose: "afilada" } },
  { id: "huesos", label: "🦴 Huesos", skin: 0x8a5f45,
    face: { hair: "rapado", hairColor: 0x17110d, mouth: "serio", nose: "ancha" } },
  { id: "arana", label: "🕷️ La Araña", skin: 0x7a5138,
    face: { hair: "rapado", hairColor: 0x17110d, beard: "stubble", mouth: "serio", nose: "chata" } },
  { id: "lobo", label: "🐺 El Lobo", skin: 0xd0a884,
    face: { hair: "corto", hairColor: 0x241a10, beard: "completa", beardColor: 0x241a10, brows: "fruncido", nose: "recta" } },
];
