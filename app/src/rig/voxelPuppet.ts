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
  mouth?: "sonrisa" | "serio" | "smirk";
  wrinkles?: boolean;    // arrugas de frente estilo LEGO (veteranos)
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
  headSize?: number;     // diámetro/altura del cilindro de la cabeza
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

function cyl(rTop: number, rBot: number, h: number, color: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop, rBot, h, 20),
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

/* Cara dibujada en canvas (256×128) que ENVUELVE el cilindro (360°):
   los rasgos viven en el tercio central (el frente, +Z) y el resto del
   lienzo es piel/pelo alrededor de la cabeza — como una minifigura LEGO.
   PROPORCIÓN: los rasgos llenan el 60-70% del frente; si son pequeños,
   la cabeza queda "en blanco" y sin personalidad.
   REGLAS LEGO para caras licenciadas: ojos negros con pupila blanca,
   cejas del color del vello, líneas de contorno nítidas (cheek lines,
   chin lines, ojeras) en vez de sombreado, boca como seña de identidad,
   arrugas de frente en veteranos y tono de piel del personaje real. */
function faceTexture(skin: number, face?: FaceSpec): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = css(skin);
  g.fillRect(0, 0, 256, 128);
  const CX = 128; // centro del frente (u=0.5 → +Z)
  // rapado al cero: velo de pelo muy corto ALREDEDOR de toda la coronilla
  if (face?.hair === "rapado") {
    const hc2 = css(face?.hairColor ?? 0x17110d);
    g.fillStyle = hc2;
    g.globalAlpha = 0.38;
    g.fillRect(0, 0, 256, 26);
    g.globalAlpha = 0.18;
    g.fillRect(0, 26, 256, 7);              // línea del pelo difuminada
    g.globalAlpha = 1;
  }
  // sombreado (alfas fuertes: también debe verse sobre pieles oscuras)
  g.fillStyle = "rgba(25,16,12,0.16)";
  g.fillRect(CX - 32, 44, 26, 32);          // cuenca izquierda
  g.fillRect(CX + 6, 44, 26, 32);           // cuenca derecha
  g.fillStyle = "rgba(25,16,12,0.22)";
  g.fillRect(CX - 7, 56, 14, 24);           // nariz
  g.fillRect(CX - 7, 82, 14, 5);            // sombra bajo la nariz
  g.fillStyle = "rgba(255,255,255,0.16)";
  g.fillRect(CX - 7, 56, 4, 20);            // brillo del puente
  g.fillStyle = "rgba(25,16,12,0.10)";
  g.fillRect(CX - 38, 8, 76, 28);           // frente
  g.fillStyle = "rgba(25,16,12,0.16)";
  g.fillRect(CX - 28, 78, 16, 6);           // pómulo izquierdo
  g.fillRect(CX + 12, 78, 16, 6);           // pómulo derecho
  g.fillStyle = "rgba(120,60,50,0.28)";
  g.fillRect(CX - 13, 86, 26, 11);          // labios (tinte cálido)
  // ojos GRANDES
  g.fillStyle = "#211d1a";
  g.fillRect(CX - 27, 50, 16, 24);
  g.fillRect(CX + 11, 50, 16, 24);
  g.fillStyle = "#ffffff";
  g.fillRect(CX - 24, 52, 5, 6);
  g.fillRect(CX + 14, 52, 5, 6);
  // boca GRANDE — la SEÑA DE IDENTIDAD del personaje (regla LEGO:
  // cada cara licenciada tiene SU boca). sonrisa / serio / smirk torcida
  g.fillStyle = "#211d1a";
  if (face?.mouth === "serio") {
    g.fillRect(CX - 18, 92, 36, 7);
    g.fillStyle = "rgba(25,16,12,0.30)";
    g.fillRect(CX - 20, 90, 4, 9);          // comisuras hundidas
    g.fillRect(CX + 16, 90, 4, 9);
  } else if (face?.mouth === "smirk") {
    // mueca torcida de arrogante (McGregor): línea con UNA comisura subida
    g.fillRect(CX - 16, 93, 28, 6);
    g.fillRect(CX + 8, 86, 7, 8);           // comisura derecha sube
    g.fillStyle = "rgba(25,16,12,0.30)";
    g.fillRect(CX - 19, 91, 4, 8);
  } else {
    g.fillRect(CX - 14, 92, 28, 7);
    g.fillRect(CX - 19, 86, 6, 7);
    g.fillRect(CX + 13, 86, 6, 7);
  }
  /* LÍNEAS DE CONTORNO LEGO: el parecido se logra con líneas nítidas
     oscuras (cheek lines, chin lines, ojeras), NO con más sombreado */
  g.fillStyle = "rgba(60,38,24,0.50)";
  g.fillRect(CX - 26, 76, 13, 3);           // ojera izquierda
  g.fillRect(CX + 13, 76, 13, 3);           // ojera derecha
  g.save(); g.translate(CX - 32, 84); g.rotate(0.45); g.fillRect(0, 0, 12, 3); g.restore();   // cheek line izq
  g.save(); g.translate(CX + 20, 84); g.rotate(-0.45); g.fillRect(0, 0, 12, 3); g.restore();  // cheek line der
  g.fillRect(CX - 9, 112, 18, 3);           // chin line
  if (face?.wrinkles) {
    // arrugas de frente (personajes veteranos, estilo LEGO clásico)
    g.fillRect(CX - 28, 14, 56, 3);
    g.fillRect(CX - 24, 22, 48, 3);
    g.fillRect(CX - 28, 30, 56, 3);
  }
  // cejas GRANDES del COLOR DEL VELLO (regla LEGO: las cejas delatan al
  // personaje); barba si la hay, si no el pelo — nunca el gorro/papakha
  const browC = css(face?.beardColor ?? face?.hairColor ?? 0x2b2118);
  g.fillStyle = browC;
  g.fillRect(CX - 29, 42, 20, 7);
  g.fillRect(CX + 9, 42, 20, 7);
  if (face?.brows === "fruncido") {
    g.save();
    g.translate(CX - 19, 44); g.rotate(0.34); g.fillRect(-14, -5, 28, 9);
    g.restore();
    g.save();
    g.translate(CX + 19, 44); g.rotate(-0.34); g.fillRect(-14, -5, 28, 9);
    g.restore();
  }
  // vello facial texturizado (envuelve el frente y los laterales)
  const bc = css(face?.beardColor ?? 0x2b2118);
  if (face?.beard === "perilla") {
    g.fillStyle = bc;
    g.fillRect(CX - 16, 96, 32, 30);        // mechón: barbilla entera
    g.fillRect(CX - 13, 88, 26, 9);         // bigote unido
  } else if (face?.beard === "completa") {
    g.fillStyle = bc;
    g.fillRect(CX - 40, 96, 80, 32);        // mandíbula (cruza el frente)
    g.fillRect(CX - 46, 60, 14, 40);        // patilla izquierda
    g.fillRect(CX + 32, 60, 14, 40);        // patilla derecha
    g.fillRect(CX - 22, 88, 44, 9);         // bigote (tapa la boca, como en real)
    // textura: píxeles claros dispersos para que no sea un bloque plano
    g.fillStyle = "rgba(255,255,255,0.08)";
    for (const [px, py] of [[-36, 104], [-24, 118], [-10, 106], [4, 120], [18, 108], [30, 118], [-42, 72], [36, 76], [-14, 92], [14, 92]] as const) {
      g.fillRect(CX + px, py, 4, 4);
    }
  } else if (face?.beard === "stubble") {
    g.fillStyle = "rgba(35,28,22,0.32)";
    g.fillRect(CX - 38, 94, 76, 32);        // mandíbula
    g.fillRect(CX - 44, 62, 13, 36);        // patilla izquierda
    g.fillRect(CX + 31, 62, 13, 36);        // patilla derecha
    g.fillRect(CX - 18, 88, 36, 7);         // sombra de bigote
  }
  // con barba la boca se dibuja ENCIMA: hueco oscuro-rojizo dentro del
  // vello (así hace LEGO las caras barbadas: la boca siempre se lee)
  if (face?.beard === "completa" || face?.beard === "perilla") {
    g.fillStyle = "#3d1f16";
    if (face?.mouth === "serio") {
      g.fillRect(CX - 14, 94, 28, 5);
    } else if (face?.mouth === "smirk") {
      g.fillRect(CX - 12, 95, 22, 5);
      g.fillRect(CX + 6, 89, 6, 7);
    } else {
      g.fillRect(CX - 12, 94, 24, 5);
      g.fillRect(CX - 15, 90, 4, 5);
      g.fillRect(CX + 11, 90, 4, 5);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function headMesh(skin: number, size: number, face?: FaceSpec): THREE.Mesh {
  const skinMat = new THREE.MeshStandardMaterial({ color: skin, roughness: 0.9 });
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTexture(skin, face), roughness: 0.9 });
  // cabeza LEGO: CILINDRO con la cara impresa alrededor.
  // thetaStart=π pone el centro de la textura (u=0.5) en el frente (+Z)
  // y la costura atrás; materiales: [lateral, tapa superior, inferior].
  const geo = new THREE.CylinderGeometry(size / 2, size / 2, size, 24, 1, false, Math.PI, Math.PI * 2);
  const m = new THREE.Mesh(geo, [faceMat, skinMat, skinMat]);
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

  // ── cabeza LEGO: cilindro (~1/5 del total) ──
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
  // cabeza calva o rapada: el icónico STUD de LEGO en la coronilla
  if (hair === "none" || hair === "rapado") {
    head.add(cyl(hs * 0.20, hs * 0.20, 0.05, skin, 0, top + 0.02, 0));
  }
  if (hair === "papakha") {
    // papakha de lana (el gorro icónico de Khabib): cilindro grueso que
    // SOBRESALE de la cabeza, color crema — se reconoce al instante
    head.add(cyl(hs / 2 + 0.05, hs / 2 + 0.06, 0.15, hc, 0, top + 0.065, -0.01));
    head.add(cyl(hs / 2 + 0.03, hs / 2 + 0.04, 0.05, hc, 0, top - 0.01, -0.01)); // borde bajo
  } else if (hair === "rapado") {
    // rapado al cero: va PINTADO en la textura alrededor de la coronilla
    // (ventaja del cilindro: el pelo rodea toda la cabeza)
  } else if (hair === "corto") {
    head.add(cyl(hs / 2 + 0.015, hs / 2 + 0.02, 0.09, hc, 0, top + 0.03, -0.01));
  } else if (hair === "melena") {
    head.add(cyl(hs / 2 + 0.025, hs / 2 + 0.03, 0.10, hc, 0, top + 0.04, -0.02));
    head.add(box(hs + 0.04, 0.30, 0.06, hc, 0, top - 0.12, -(hs / 2 + 0.03)));       // cascada trasera
    head.add(box(0.05, 0.22, hs * 0.7, hc, -(hs / 2 + 0.01), top - 0.10, -0.03));    // lado izquierdo
    head.add(box(0.05, 0.22, hs * 0.7, hc, hs / 2 + 0.01, top - 0.10, -0.03));       // lado derecho
  } else if (hair === "cresta") {
    head.add(box(0.07, 0.16, hs + 0.06, hc, 0, top + 0.08, -0.02));
  }

  // ── RELIEVE FACIAL 3D: la cara sobresale del cilindro ────────
  // La textura solo se lee de frente; el relieve (nariz, orejas, cejas,
  // barba 3D) se lee desde CUALQUIER ángulo y recibe luz y sombra.
  const zf = hs / 2;                       // radio de la cabeza (plano frontal)
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
  { id: "veterano", label: "🧓 Veterano", face: { hair: "corto", hairColor: 0x9a938c, beard: "completa", beardColor: 0x8a837c, wrinkles: true } },
  { id: "smirk", label: "😏 Mueca", face: { mouth: "smirk", brows: "fruncido" } },
  // ── inspirados en leyendas de UFC ──
  { id: "aguila", label: "🦅 El Águila", skin: 0xc89878,
    face: { hair: "papakha", hairColor: 0xe8dcc0, beard: "completa", beardColor: 0x14100c, brows: "fruncido", mouth: "serio", nose: "aguilena" } },
  { id: "notorio", label: "☘️ El Notorio", skin: 0xdbb48a,
    face: { hair: "corto", hairColor: 0x8a5c34, beard: "completa", beardColor: 0x8a5c34, brows: "fruncido", mouth: "smirk", nose: "afilada" } },
  { id: "huesos", label: "🦴 Huesos", skin: 0x8a5f45,
    face: { hair: "rapado", hairColor: 0x17110d, mouth: "serio", nose: "ancha", wrinkles: true } },
  { id: "arana", label: "🕷️ La Araña", skin: 0x7a5138,
    face: { hair: "rapado", hairColor: 0x17110d, beard: "stubble", mouth: "serio", nose: "chata", wrinkles: true } },
  { id: "lobo", label: "🐺 El Lobo", skin: 0xd0a884,
    face: { hair: "corto", hairColor: 0x241a10, beard: "completa", beardColor: 0x241a10, brows: "fruncido", nose: "recta" } },
];
