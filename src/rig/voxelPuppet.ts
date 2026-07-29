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

/** Facciones de la cara: TODO va impreso en la textura 360° del cilindro
    (técnica de las minifiguras: cabeza lisa + impresión plana).
    Lo único 3D es el pelo/sombrero. Sin nariz ni relieve: tinta plana. */
export interface FaceSpec {
  brows?: "normal" | "fruncido";
  mouth?: "sonrisa" | "serio" | "smirk";
  wrinkles?: boolean;    // arrugas de frente estilo LEGO (veteranos)
  beard?: "none" | "perilla" | "completa" | "stubble";
  beardColor?: number;
  hair?: "none" | "rapado" | "corto" | "melena" | "cresta" | "papakha";
  hairColor?: number;
}

/** Cuerpo: complexión + TEXTURAS impresas (misma técnica que la cara:
    líneas sólidas sobre el color base, como los torsos de minifigura).
    La definición muscular y los tatuajes van pintados en el torso y,
    opcionalmente, en mangas de los antebrazos. */
export interface BodySpec {
  build?: "delgado" | "normal" | "fornido";
  muscle?: "light" | "media" | "fuerte";   // intensidad de la definición impresa
  tattoos?: {
    chest?: "gorila" | "script";           // pieza de pecho
    belly?: "tigre";                       // abdomen
    back?: "cruz-alas";                    // espalda
    armL?: "manga"; armR?: "manga";        // manga de tatuajes en el antebrazo
  };
}

export interface PuppetSpec {
  skin?: number;         // piel
  torso?: number;        // camiseta / torso desnudo
  sleeves?: number;      // mangas (por defecto = torso)
  pants?: number;        // cadera / muslos (pantalón o shorts)
  feet?: number;         // calzado / pies descalzos
  headSize?: number;     // diámetro/altura del cilindro de la cabeza
  face?: FaceSpec;       // facciones: cejas, barba, pelo
  body?: BodySpec;       // complexión, definición muscular y tatuajes
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

function cyl(rTop: number, rBot: number, h: number, color: number, x = 0, y = 0, z = 0, collide?: "core" | "limb"): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop, rBot, h, 20),
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

/* Cara IMPRESA en canvas (256×128) que ENVUELVE el cilindro liso (360°).
   ESTILO LEGO PURO: solo tintas sólidas y líneas nítidas — la tampografía
   de LEGO no degrada, cada rasgo es una capa de tinta plana. Nada de
   sombreado suave: las sombras translúcidas se leían como manchas.
   Los rasgos viven en el tercio central (el frente, +Z); el resto del
   lienzo es piel (y pelo rapado) alrededor de la cabeza. */
function faceTexture(skin: number, face?: FaceSpec): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = css(skin);
  g.fillRect(0, 0, 256, 128);
  const CX = 128; // centro del frente (u=0.5 → +Z)
  const INK = "#211d1a";   // tinta oscura: ojos y boca
  const LINE = "#4a3020";  // líneas de contorno: marrón sólido

  // rapado al cero: velo de pelo muy corto ALREDEDOR de toda la coronilla
  if (face?.hair === "rapado") {
    g.fillStyle = css(face?.hairColor ?? 0x17110d);
    g.globalAlpha = 0.4;
    g.fillRect(0, 0, 256, 24);
    g.globalAlpha = 0.2;
    g.fillRect(0, 24, 256, 6);              // línea del pelo difuminada
    g.globalAlpha = 1;
  }

  // arrugas de frente (veteranos): tres líneas sólidas
  if (face?.wrinkles) {
    g.fillStyle = LINE;
    g.fillRect(CX - 26, 16, 52, 3);
    g.fillRect(CX - 22, 24, 44, 3);
    g.fillRect(CX - 26, 32, 52, 3);
  }

  // cejas SÓLIDAS del color del vello (barba si la hay, si no el pelo —
  // nunca el gorro/papakha). El fruncido las inclina hacia el centro.
  const browC = css(face?.beardColor ?? face?.hairColor ?? 0x2b2118);
  g.fillStyle = browC;
  if (face?.brows === "fruncido") {
    g.save(); g.translate(CX - 19, 44); g.rotate(0.34); g.fillRect(-14, -4, 28, 8); g.restore();
    g.save(); g.translate(CX + 19, 44); g.rotate(-0.34); g.fillRect(-14, -4, 28, 8); g.restore();
  } else {
    g.fillRect(CX - 29, 42, 20, 7);
    g.fillRect(CX + 9, 42, 20, 7);
  }

  // ojos: negro sólido con el puntito blanco icónico
  g.fillStyle = INK;
  g.fillRect(CX - 27, 52, 16, 22);
  g.fillRect(CX + 11, 52, 16, 22);
  g.fillStyle = "#ffffff";
  g.fillRect(CX - 24, 55, 5, 6);
  g.fillRect(CX + 14, 55, 5, 6);

  // líneas de contorno: ojeras, cheek lines y chin line — el parecido se
  // imprime con LÍNEAS, no con sombras (regla de oro de las caras LEGO)
  g.fillStyle = LINE;
  g.fillRect(CX - 25, 78, 12, 3);           // ojera izquierda
  g.fillRect(CX + 13, 78, 12, 3);           // ojera derecha
  g.save(); g.translate(CX - 33, 86); g.rotate(0.45); g.fillRect(0, 0, 11, 3); g.restore();   // cheek line izq
  g.save(); g.translate(CX + 22, 86); g.rotate(-0.45); g.fillRect(0, 0, 11, 3); g.restore();  // cheek line der
  g.fillRect(CX - 8, 112, 16, 3);           // chin line

  // BARBA impresa como MARCO que enmarca la boca, nunca como bloque:
  // bigote fino + patillas que suben por los lados + banda de mandíbula
  // BAJA. La boca siempre queda visible en el hueco (y94-100).
  const bc = css(face?.beardColor ?? 0x2b2118);
  if (face?.beard === "completa") {
    g.fillStyle = bc;
    g.fillRect(CX - 20, 84, 40, 6);         // bigote fino sobre la boca
    g.fillRect(CX - 46, 58, 11, 50);        // patilla izquierda
    g.fillRect(CX + 35, 58, 11, 50);        // patilla derecha
    g.fillRect(CX - 44, 106, 88, 22);       // banda de mandíbula (baja)
    // trazos de pelo: líneas cortas en tono claro dentro de la barba
    g.fillStyle = "rgba(255,255,255,0.14)";
    for (const [px, py] of [[-34, 112], [-14, 116], [8, 113], [28, 117], [-41, 70], [39, 74]] as const) {
      g.fillRect(CX + px, py, 3, 9);
    }
  } else if (face?.beard === "perilla") {
    g.fillStyle = bc;
    g.fillRect(CX - 14, 86, 28, 5);         // bigote
    g.fillRect(CX - 11, 102, 22, 26);       // mechón de la barbilla
  } else if (face?.beard === "stubble") {
    // sombra de barba incipiente: punteado suave siguiendo el marco
    g.fillStyle = bc;
    g.globalAlpha = 0.35;
    for (let px = -40; px <= 37; px += 7) for (let py = 108; py <= 122; py += 7) {
      g.fillRect(CX + px, py, 3, 3);        // mandíbula
    }
    for (let py = 64; py <= 100; py += 7) {
      g.fillRect(CX - 43, py, 3, 3);        // patilla izquierda
      g.fillRect(CX + 40, py, 3, 3);        // patilla derecha
    }
    g.fillRect(CX - 16, 86, 32, 4);         // sombra de bigote
    g.globalAlpha = 1;
  }

  // BOCA — la seña de identidad del personaje. Va DESPUÉS de la barba:
  // siempre legible en el hueco del marco (como las caras barbadas LEGO)
  g.fillStyle = INK;
  if (face?.mouth === "serio") {
    g.fillRect(CX - 16, 94, 32, 5);         // línea recta
  } else if (face?.mouth === "smirk") {
    // mueca torcida de arrogante (McGregor): línea con UNA comisura subida
    g.fillRect(CX - 14, 95, 24, 5);
    g.fillRect(CX + 6, 89, 6, 7);           // comisura derecha sube
  } else {
    g.fillRect(CX - 14, 94, 28, 5);         // sonrisa: línea con las dos comisuras
    g.fillRect(CX - 17, 90, 4, 5);
    g.fillRect(CX + 13, 90, 4, 5);
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

/* ── TEXTURAS DE CUERPO ──────────────────────────────────────────
   Mismo lenguaje que la cara: líneas sólidas, sin degradados.
   La definición usa un marrón translúcido (se adapta a cualquier tono
   de piel); los tatuajes van en tinta oscura azul-negra como los reales. */

/** Torso delante/espalda (canvas 128×128 por cara del bloque) */
function bodyTexture(base: number, body: BodySpec, part: "front" | "back"): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = css(base);
  g.fillRect(0, 0, 128, 128);
  const ml = body.muscle === "fuerte" ? 0.7 : body.muscle === "light" ? 0.32 : 0.5;
  const M = `rgba(40,25,16,${ml})`;         // líneas de definición
  const TAT = "rgba(22,20,26,0.85)";        // tinta de tatuaje
  const line = (x: number, y: number, w: number, h: number, rot = 0, cx = 0, cy = 0) => {
    g.save(); g.translate(x, y); g.rotate(rot); g.fillRect(cx, cy, w, h); g.restore();
  };

  if (part === "front") {
    // ── definición frontal: formas musculares, no rejilla ──
    g.fillStyle = M;
    line(40, 15, 20, 3, -0.22);              // clavícula izquierda
    line(88, 15, 20, 3, 0.22, -20, 0);       // clavícula derecha
    g.fillRect(63, 24, 2, 22);               // esternón (solo entre pectorales)
    // pectorales: arco inferior en dos trazos (forma de ⌒, no rectas)
    line(33, 44, 22, 3, 0.38, -11, 0);       // pec izquierdo: caída exterior
    line(30, 51, 16, 3, 0.08, -8, 0);        // pec izquierdo: base
    line(95, 44, 22, 3, -0.38, -11, 0);      // pec derecho
    line(98, 51, 16, 3, -0.08, -8, 0);
    // serratos: tres muescas bajo cada pectoral (costillas)
    for (const [sx, sy] of [[26, 58], [23, 65], [21, 72]] as const) line(sx, sy, 3, 6, -0.15);
    for (const [sx, sy] of [[102, 58], [105, 65], [107, 72]] as const) line(sx, sy, 3, 6, 0.15);
    // abs: ladrillos escalonados que se estrechan hacia abajo (six-pack)
    g.fillRect(63, 56, 2, 44);               // línea media abdominal
    g.fillRect(46, 62, 34, 3);
    g.fillRect(48, 76, 32, 3);
    g.fillRect(50, 90, 30, 3);
    // V del adonis hacia la cadera
    line(45, 106, 18, 3, 0.42, -9, 0);
    line(83, 106, 18, 3, -0.42, -9, 0);
    g.fillRect(62, 104, 4, 4);               // ombligo

    // ── tatuajes frontales ──
    const t = body.tattoos;
    if (t?.chest === "gorila") {
      // gorila coronado (pecho del Notorio): corona con banda + cara grande
      g.fillStyle = TAT;
      g.fillRect(48, 14, 32, 4);             // corona: banda
      g.fillRect(50, 7, 6, 8);               //         tres picos
      g.fillRect(61, 5, 6, 10);
      g.fillRect(72, 7, 6, 8);
      g.fillRect(46, 20, 36, 18);            // cabeza
      g.fillStyle = css(base);
      g.fillRect(54, 25, 5, 5);              // ojos (huecos de piel)
      g.fillRect(69, 25, 5, 5);
      g.fillStyle = TAT;
      g.fillRect(54, 34, 20, 12);            // hocico
      g.fillStyle = css(base);
      g.fillRect(61, 36, 3, 3);              // fosas nasales
      g.fillRect(65, 36, 3, 3);
      g.fillRect(58, 41, 12, 3);             // boca
      g.fillStyle = "#ffffff";
      g.fillRect(57, 41, 3, 5);              // colmillos
      g.fillRect(68, 41, 3, 5);
    } else if (t?.chest === "script") {
      // escritura en el pectoral derecho (el "Philippians" de Huesos):
      // dos renglones de trazo fino ondulado (segmentos alternos)
      g.fillStyle = TAT;
      for (const [wx, wy, wr] of [[74, 28, 0.14], [82, 29, -0.10], [90, 30, 0.12], [98, 30, -0.08]] as const) {
        line(wx, wy, 9, 2, wr, -4, 0);
      }
      for (const [wx, wy, wr] of [[76, 36, -0.12], [84, 36, 0.10], [92, 37, -0.14], [100, 37, 0.08]] as const) {
        line(wx, wy, 9, 2, wr, -4, 0);
      }
    }
    if (t?.belly === "tigre") {
      // rayas de tigre: muchas, finas y alternas cruzando el abdomen bajo
      g.fillStyle = TAT;
      for (const [sx, sy, sr] of [[34, 84, 0.5], [94, 86, -0.5], [38, 92, 0.45], [90, 94, -0.45],
        [34, 100, 0.5], [94, 102, -0.5], [40, 108, 0.42], [88, 110, -0.42],
        [44, 116, 0.38], [84, 118, -0.38]] as const) {
        line(sx, sy, 15, 2, sr, -7, 0);
      }
    }
  } else {
    // ── espalda: trapecios, omóplatos, dorsales ──
    g.fillStyle = M;
    line(44, 12, 20, 3, 0.35, -10, 0);       // trapecio izquierdo
    line(84, 12, 20, 3, -0.35, -10, 0);      // trapecio derecho
    g.fillRect(63, 14, 2, 82);               // columna
    line(36, 32, 22, 3, 0.5, -11, 0);        // omóplato izquierdo (arco)
    line(38, 40, 16, 3, 0.3, -8, 0);
    line(92, 32, 22, 3, -0.5, -11, 0);       // omóplato derecho
    line(90, 40, 16, 3, -0.3, -8, 0);
    line(34, 56, 24, 3, 0.25, -12, 0);       // dorsal izquierdo (barrido)
    line(94, 56, 24, 3, -0.25, -12, 0);      // dorsal derecho
    g.fillRect(52, 92, 4, 4);                // hoyuelos lumbares
    g.fillRect(72, 92, 4, 4);
    if (body.tattoos?.back === "cruz-alas") {
      // cruz con alas desplegadas (espalda del Notorio), tres filas de plumas
      g.fillStyle = TAT;
      g.fillRect(59, 8, 8, 46);              // cruz
      g.fillRect(44, 18, 40, 7);
      // alas: tres filas de plumas a AMBOS lados (pares izq/der explícitos)
      for (const [lx, rx, wy, wl, wr] of [[44, 84, 20, 16, 0.5],   // fila alta
        [40, 88, 30, 20, 0.68],                                     // fila media
        [36, 92, 41, 24, 0.85]] as const) {                         // fila baja
        line(lx, wy, wl, 4, wr, -wl, 0);        // pluma izquierda (cae hacia fuera)
        line(rx, wy, wl, 4, -wr, 0, 0);         // pluma derecha (simétrica)
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Manga de tatuajes para el antebrazo (canvas 64×64 que envuelve 360°) */
function sleeveTexture(base: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = css(base);
  g.fillRect(0, 0, 64, 64);
  const TAT = "rgba(22,20,26,0.85)";
  g.fillStyle = TAT;
  g.fillRect(0, 4, 64, 4);                   // brazalete superior (doble)
  g.fillRect(0, 10, 64, 2);
  g.fillRect(0, 58, 64, 3);                  // brazalete de muñeca
  // rosas: pétalos alrededor de un centro de piel
  for (const [px, py] of [[8, 18], [40, 20], [22, 38]] as const) {
    g.fillRect(px + 2, py, 4, 8);            // pétalos verticales
    g.fillRect(px, py + 2, 8, 4);            // pétalos horizontales
    g.fillStyle = css(base);
    g.fillRect(px + 3, py + 3, 2, 2);        // centro de piel
    g.fillStyle = TAT;
  }
  // hojas y espirales de relleno entre las rosas
  for (const [px, py, pr] of [[24, 22, 0.6], [52, 28, -0.6], [10, 32, 0.6], [36, 30, -0.6], [50, 44, 0.6], [12, 48, -0.6], [30, 52, 0.6]] as const) {
    g.save(); g.translate(px, py); g.rotate(pr); g.fillRect(0, 0, 7, 2); g.restore();
  }
  g.fillRect(0, 26, 64, 1);                  // filete fino de separación
  g.fillRect(0, 46, 64, 1);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** torso con textura: caja con materiales por cara [±x, ±y, frente, espalda] */
function torsoMesh(w: number, h: number, d: number, base: number, body: BodySpec, x = 0, y = 0, z = 0): THREE.Mesh {
  const plain = new THREE.MeshStandardMaterial({ color: base, roughness: 0.9 });
  const front = new THREE.MeshStandardMaterial({ map: bodyTexture(base, body, "front"), roughness: 0.9 });
  const back = new THREE.MeshStandardMaterial({ map: bodyTexture(base, body, "back"), roughness: 0.9 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [plain, plain, plain, plain, front, back]);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.userData.collide = "core";
  return m;
}

/** cilindro con textura envolvente 360° (mangas de tatuajes) */
function cylTex(rTop: number, rBot: number, h: number, tex: THREE.CanvasTexture, capColor: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const side = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
  const cap = new THREE.MeshStandardMaterial({ color: capColor, roughness: 0.9 });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, 20, 1, false, Math.PI, Math.PI * 2), [side, cap, cap]);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.userData.collide = "limb";
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

  // ── complexión: cuerpo ESTRECHO, con variantes por personaje ──
  // (los luchadores de MMA sin BodySpec llevan definición "media" de serie)
  const body = spec.body ?? (spec.gloves !== undefined ? { muscle: "media" as const } : undefined);
  const build = body?.build ?? "normal";
  const BW = build === "fornido" ? 0.54 : build === "delgado" ? 0.44 : 0.48;   // pecho
  const BD = build === "fornido" ? 0.30 : 0.27;                                 // profundidad
  const ARM_X = build === "fornido" ? 0.335 : build === "delgado" ? 0.285 : 0.31; // hombros
  const PEL = build === "fornido" ? 0.35 : build === "delgado" ? 0.31 : 0.33;   // pelvis

  // ── cadera (raíz del rig) ────────────────────────────────
  const hips = joint(root, "hips", 0, 0.66, 0);
  hips.add(box(PEL, 0.16, 0.25, pants, 0, -0.02, 0, "core"));
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

  // ── torso: textura de músculos/tatuajes si hay BodySpec ──
  const spine = joint(hips, "spine", 0, 0.08, 0);
  if (body) spine.add(torsoMesh(BW, 0.40, BD, torso, body, 0, 0.22, 0));
  else spine.add(box(BW, 0.40, BD, torso, 0, 0.22, 0, "core"));
  if (spec.chestPlate !== undefined) {
    // peto: bloque ligeramente mayor envolviendo el torso
    spine.add(box(BW + 0.04, 0.34, BD + 0.04, spec.chestPlate, 0, 0.26, 0, "core"));
  }

  // ── cabeza LEGO: cilindro liso con la cara impresa (~1/5 del total) ──
  const head = joint(spine, "head", 0, 0.44, 0);
  const face = spec.face;
  const hm = headMesh(skin, hs, face);
  const cy = 0.05 + hs / 2;      // la base del cilindro queda 0.05 sobre la articulación
  const top = 0.05 + hs;         // superficie superior de la cabeza
  hm.position.set(0, cy, 0);
  hm.userData.collide = "core";
  head.add(hm);

  // pelo: piezas 3D sobre/alrededor de la cabeza (coronilla lisa, sin stud)
  const hair = face?.hair ?? "none";
  const hc = face?.hairColor ?? 0x2b2118;
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

  if (spec.helmet !== undefined) {
    // casco: gorro metálico que deja la cara libre + cresta
    head.add(box(hs + 0.03, 0.16, hs + 0.03, spec.helmet, 0, top + 0.02, -0.01));
    head.add(box(0.06, 0.10, hs + 0.10, 0x8c2f2f, 0, top + 0.13, -0.02)); // cresta roja
    // carrillera trasera
    head.add(box(hs + 0.03, 0.20, 0.06, spec.helmet, 0, 0.16, -(hs / 2 + 0.005)));
  }

  // ── brazos CILÍNDRICOS (bisagras en hombro y codo) ───────
  // como la cabeza: tubos con un leve estrechamiento hacia la articulación
  for (const s of [1, -1] as const) {
    const side = s === 1 ? "l" : "r";
    const ua = joint(spine, `upperarm.${side}`, ARM_X * s, 0.37, 0);
    ua.add(cyl(0.09, 0.08, 0.30, sleeves, 0, -0.16, 0, "limb"));           // manga
    if (spec.shoulderPads !== undefined) {
      ua.add(box(0.22, 0.10, 0.23, spec.shoulderPads, 0, -0.02, 0)); // hombrera
    }
    const fa = joint(ua, `lowerarm.${side}`, 0, -0.34, 0);
    const tat = s === 1 ? body?.tattoos?.armL : body?.tattoos?.armR;
    if (tat === "manga") {
      fa.add(cylTex(0.075, 0.065, 0.26, sleeveTexture(skin), skin, 0, -0.14, 0)); // manga de tatuajes
    } else {
      fa.add(cyl(0.075, 0.065, 0.26, skin, 0, -0.14, 0, "limb"));            // antebrazo
    }
    if (spec.gloves !== undefined) {
      fa.add(cyl(0.10, 0.095, 0.17, spec.gloves, 0, -0.33, 0, "limb")); // guante MMA
    } else {
      fa.add(cyl(0.08, 0.075, 0.13, skin, 0, -0.33, 0, "limb"));      // puño
    }
  }

  // ── piernas CILÍNDRICAS (bisagras en cadera y rodilla) ────
  for (const s of [1, -1] as const) {
    const side = s === 1 ? "l" : "r";
    const ul = joint(hips, `upperleg.${side}`, 0.15 * s, -0.10, 0);
    ul.add(cyl(0.115, 0.095, 0.26, pants, 0, -0.14, 0, "limb"));           // muslo
    const ll = joint(ul, `lowerleg.${side}`, 0, -0.29, 0);
    ll.add(cyl(0.09, 0.075, 0.24, skin, 0, -0.13, 0, "limb"));             // espinilla
    const pie = cyl(0.055, 0.055, 0.28, feet, 0, -0.21, 0.05, "limb"); // pie redondo hacia +Z
    pie.rotation.x = Math.PI / 2;
    ll.add(pie);
  }

  return root;
}

/* ── presets de cara para el personalizador del lab ─────────────
   Los "famosos" llevan piel, complexión, altura y tatuajes propios. */
export interface FacePreset { id: string; label: string; skin?: number; face: FaceSpec; body?: BodySpec; heightFactor?: number }
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
  { id: "aguila", label: "🦅 El Águila", skin: 0xc89878, heightFactor: 0.96,
    face: { hair: "papakha", hairColor: 0xe8dcc0, beard: "completa", beardColor: 0x14100c, brows: "fruncido", mouth: "serio" },
    body: { build: "fornido", muscle: "light" } },
  { id: "notorio", label: "☘️ El Notorio", skin: 0xdbb48a, heightFactor: 0.99,
    face: { hair: "corto", hairColor: 0x8a5c34, beard: "completa", beardColor: 0x8a5c34, brows: "fruncido", mouth: "smirk" },
    body: { build: "normal", muscle: "media",
      tattoos: { chest: "gorila", belly: "tigre", back: "cruz-alas", armL: "manga" } } },
  { id: "huesos", label: "🦴 Huesos", skin: 0x8a5f45, heightFactor: 1.06,
    face: { hair: "rapado", hairColor: 0x17110d, mouth: "serio", wrinkles: true },
    body: { build: "delgado", muscle: "fuerte", tattoos: { chest: "script" } } },
  { id: "arana", label: "🕷️ La Araña", skin: 0x7a5138, heightFactor: 1.01,
    face: { hair: "rapado", hairColor: 0x17110d, beard: "stubble", mouth: "serio", wrinkles: true },
    body: { build: "delgado", muscle: "fuerte" } },
  { id: "lobo", label: "🐺 El Lobo", skin: 0xd0a884, heightFactor: 1.0,
    face: { hair: "corto", hairColor: 0x241a10, beard: "completa", beardColor: 0x241a10, brows: "fruncido" },
    body: { build: "fornido", muscle: "media" } },
];
