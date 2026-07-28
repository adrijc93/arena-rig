import { clamp01, clonePose, easeIn, easeOut } from "./poseDriver";
import type { Pose } from "./poseDriver";

/* ════════════════════════════════════════════════════════════════
   SET MMA · SUELO Y GRAPPLING (extensión de mmaMoves.ts)
   Derribos: single leg, proyección de judo, suplex.
   Posiciones: media guardia, control lateral, rodilla en el
   vientre, espalda con ganchos, pase de guardia.
   Sumisiones: mata león, guillotina, triángulo, kimura, americana.
   Escapes: shrimp (escape de cadera), upa (puente y giro).
   ════════════════════════════════════════════════════════════════ */

export type MmaGroundMoveId =
  | "single-leg" | "ippon" | "suplex"
  | "media-guardia" | "side-control" | "rodilla-vientre" | "espalda" | "pase-guardia"
  | "mataleon" | "guillotina" | "triangulo" | "kimura" | "americana"
  | "shrimp" | "upa";

type GroundEntry = { id: MmaGroundMoveId; label: string; seccion: "suelo"; grupo: string };

export const MMA_GROUND_DERRIBOS: GroundEntry[] = [
  { id: "single-leg", label: "Derribo a una pierna", seccion: "suelo", grupo: "Derribos" },
  { id: "ippon", label: "Proyección de judo (seoi nage)", seccion: "suelo", grupo: "Derribos" },
  { id: "suplex", label: "Suplex alemán", seccion: "suelo", grupo: "Derribos" },
];

export const MMA_GROUND_POSICIONES: GroundEntry[] = [
  { id: "media-guardia", label: "Media guardia (abajo)", seccion: "suelo", grupo: "Posiciones" },
  { id: "side-control", label: "Control lateral (cien kilos)", seccion: "suelo", grupo: "Posiciones" },
  { id: "rodilla-vientre", label: "Rodilla en el vientre", seccion: "suelo", grupo: "Posiciones" },
  { id: "espalda", label: "Espalda con ganchos", seccion: "suelo", grupo: "Posiciones" },
  { id: "pase-guardia", label: "Pase de guardia (knee slice)", seccion: "suelo", grupo: "Posiciones" },
];

export const MMA_GROUND_SUMISIONES: GroundEntry[] = [
  { id: "mataleon", label: "Mata león (RNC)", seccion: "suelo", grupo: "Sumisiones" },
  { id: "guillotina", label: "Guillotina", seccion: "suelo", grupo: "Sumisiones" },
  { id: "triangulo", label: "Triángulo", seccion: "suelo", grupo: "Sumisiones" },
  { id: "kimura", label: "Kimura", seccion: "suelo", grupo: "Sumisiones" },
  { id: "americana", label: "Americana", seccion: "suelo", grupo: "Sumisiones" },
];

export const MMA_GROUND_ESCAPES: GroundEntry[] = [
  { id: "shrimp", label: "Escape de cadera (shrimp)", seccion: "suelo", grupo: "Escapes" },
  { id: "upa", label: "Puente y giro (upa)", seccion: "suelo", grupo: "Escapes" },
];

/** Misma guardia base que mmaMoves (copia local para no acoplar módulos) */
const GROUND_GUARD: Pose = {
  bob: 0, hipsX: 0, hipsY: 0, hipsZ: 0,
  lean: 0.1, twist: 0.35,
  headX: 0.08, headY: 0,
  uaR: [-1.0, 0, 0.3], faR: -2.0,
  uaL: [-1.1, -0.2, -0.05], faL: -2.05,
  thL: -0.22, thLY: 0, shL: 0.35,
  thR: 0.18, thRY: 0, shR: 0.3,
};

const cyc = (t: number, period: number) => (t % period) / period;

/** Devuelve la Pose del movimiento de suelo, o null si el id no es de este módulo */
export function mmaGroundPoseFor(id: string, t: number): Pose | null {
  const p = clonePose(GROUND_GUARD);

  switch (id) {
    /* ───────────── DERRIBOS ───────────── */
    case "single-leg": {
      // single leg: cambio de nivel doblando RODILLAS, cabeza PEGADA al
      // costado (al frente te comías la guillotina), manos cerradas tras la
      // rodilla y se CONDUCE a través levantando la pierna atrapada
      const u = cyc(t, 2.2);
      const drop = u < 0.25 ? easeIn(u / 0.25) : u < 0.8 ? 1 : 1 - easeIn((u - 0.8) / 0.2);
      const run = u < 0.35 ? 0 : u < 0.6 ? easeOut((u - 0.35) / 0.25) : u < 0.8 ? 1 : 1 - easeIn((u - 0.8) / 0.2);
      p.bob = -drop * 0.4 + run * 0.12;                   // nivel bajo → levanta al conducir
      p.tz = run * 0.3;                                   // conduce A TRAVÉS
      p.lean = 0.1 + drop * 0.35 - run * 0.1;             // espalda recta inclinada
      p.headY = -drop * 0.45;                             // cabeza al COSTADO
      p.headX = 0.05 - drop * 0.1;
      p.uaR = [-0.6 - drop * 0.55, -0.2, 0.1]; p.faR = -2.0 + drop * 0.25; // manos cerradas tras la rodilla
      p.uaL = [-0.6 - drop * 0.6, 0.15, -0.15]; p.faL = -2.05 + drop * 0.3;
      p.thL = -0.22 - drop * 0.85; p.shL = 0.35 + drop * 0.9;  // paso de penetración
      p.thR = 0.18 + drop * 0.35; p.shR = 0.3 + drop * 1.6;    // rodilla trasera casi al suelo
      return p;
    }

    case "ippon": {
      // seoi nage: agarre de cuello y manga, TIRÓN para desequilibrar, se
      // entra GIRANDO de espaldas con la cadera baja y se proyecta por
      // encima del hombro tirando de los dos brazos en diagonal
      const u = cyc(t, 2.0);
      const grip = u < 0.2 ? easeOut(u / 0.2) : 1;
      const turn = u < 0.2 ? 0 : u < 0.45 ? easeIn((u - 0.2) / 0.25) : u < 0.85 ? 1 : 1 - easeIn((u - 0.85) / 0.15);
      const thr = u < 0.45 ? 0 : u < 0.65 ? easeOut((u - 0.45) / 0.2) : u < 0.85 ? 1 : 1 - easeIn((u - 0.85) / 0.15);
      p.hipsY = -turn * 1.2 + thr * 0.3;                  // se mete de espaldas
      p.twist = 0.35 - turn * 0.9 + thr * 0.25;
      p.bob = -turn * 0.18 - thr * 0.12;                  // cadera baja al cargar
      p.lean = 0.15 + thr * 0.55;                         // saca cadera y vuelca
      p.uaR = [-1.1 + grip * 0.15 + thr * 0.7, -0.4, 0.1]; p.faR = -2.2 + thr * 0.3;  // solapa: tira en diagonal
      p.uaL = [-1.0 + grip * 0.2 + thr * 0.8, 0.3, -0.2]; p.faL = -2.1 + thr * 0.35;  // manga
      p.shL = 0.35 + turn * 0.5 - thr * 0.2; p.shR = 0.3 + turn * 0.5 - thr * 0.2; // rodillas bajo el rival
      p.headX = 0.1 + thr * 0.15;
      return p;
    }

    case "suplex": {
      // suplex alemán: cerrojo a la cintura, pop de cadera y PUENTE atrás
      // llevando al rival por encima. Arriesgado y espectacular.
      const u = cyc(t, 2.4);
      const lock = u < 0.2 ? easeOut(u / 0.2) : 1;
      const arch = u < 0.25 ? 0 : u < 0.5 ? easeIn((u - 0.25) / 0.25) : u < 0.75 ? 1 : 1 - easeIn((u - 0.75) / 0.25);
      p.bob = -lock * 0.12 + arch * 0.3;                  // pop de cadera al despegar
      p.lean = 0.15 - arch * 0.85;                        // se arquea ATRÁS
      p.hipsX = -arch * 0.5;
      p.headX = 0.08 - arch * 0.35;
      p.uaR = [-1.15, -0.2, 0.15]; p.faR = -2.3;          // cerrojo a la cintura
      p.uaL = [-1.15, 0.2, -0.15]; p.faL = -2.3;
      p.shL = 0.35 + lock * 0.35 - arch * 0.25; p.shR = 0.3 + lock * 0.35 - arch * 0.25; // carga piernas → extiende
      p.thL = -0.22 - arch * 0.2; p.thR = 0.18 - arch * 0.2;   // despega con las piernas arriba
      p.twist = 0.3;
      return p;
    }

    /* ───────────── POSICIONES ───────────── */
    case "media-guardia": {
      // media guardia (abajo): medio de lado, rodilla ESCUDO cruzada al
      // frente, la otra pierna engancha por dentro; underhook buscando la
      // espalda y frame contra la "cara"
      const adj = Math.sin(t * 1.8) * 0.05;               // ajustes vivos del escudo
      p.hipsX = -1.3; p.hipsZ = 0.35;                     // medio de lado
      p.bob = -0.75;
      p.thL = -1.15 - adj; p.thLY = 0.35; p.shL = 1.5;    // rodilla escudo
      p.thR = -0.55; p.thRY = -0.4; p.shR = 1.3;          // gancho interno bajo
      p.uaL = [-1.25, 0.1, -0.1]; p.faL = -1.55;          // underhook que llega lejos
      p.uaR = [-1.05, -0.3, 0.25]; p.faR = -2.25;         // frame en la cara
      p.lean = -0.05; p.twist = 0.2; p.headX = -0.3;
      return p;
    }

    case "side-control": {
      // control lateral (cien kilos): pecho contra pecho PERPENDICULAR,
      // caderas bajas y pesadas, piernas abiertas atrás; crossface bajo la
      // cabeza y la otra mano bajo la cadera lejana. Presión constante.
      const press = Math.max(0, Math.sin(t * 1.5)) * 0.05;
      p.bob = -0.55 - press; p.hipsX = 0.45; p.twist = 0.6;
      p.lean = 0.5;
      p.thL = 0.7; p.thLY = 0.3; p.shL = 0.4;             // piernas atrás abiertas
      p.thR = 0.7; p.thRY = -0.3; p.shR = 0.4;
      p.uaR = [-1.3, -0.35, 0.1]; p.faR = -2.2;           // crossface bajo la cabeza
      p.uaL = [-0.8, 0.3, -0.2]; p.faL = -1.9;            // bajo la cadera lejana
      p.headX = 0.1;                                      // cabeza alta, mirando al rival
      return p;
    }

    case "rodilla-vientre": {
      // rodilla en el vientre: la espinilla derecha clavada en el "ombligo",
      // pie izquierdo POSTEADO lejos, peso en punta (duele y puntúa);
      // manos al cuello y a la cadera
      const bal = Math.sin(t * 2.2) * 0.04;               // equilibrio en punta
      p.bob = -0.4 + bal * 0.5;
      p.twist = 0.5; p.lean = 0.15;                       // torso erguido: el peso va en la rodilla
      p.thR = 0.9; p.thRY = 0.35; p.shR = 1.7;            // rodilla clavada
      p.thL = -0.35; p.thLY = -0.5; p.shL = 0.3;          // poste bien abierto atrás-fuera
      p.uaR = [-1.35, -0.3, 0.1]; p.faR = -1.7;           // agarre del cuello, brazo largo
      p.uaL = [-1.0, 0.3, -0.25]; p.faL = -1.5;           // control de la cadera
      p.headX = 0.1; p.headY = bal;
      return p;
    }

    case "espalda": {
      // control de ESPALDA con ganchos: sentado detrás, talones clavados
      // dentro de los muslos rivales, cinturón de seguridad (un brazo sobre
      // el hombro, el otro bajo el brazo) y la barbilla pegada. La posición
      // más dominante del grappling.
      const sq = Math.max(0, Math.sin(t * 2.0));          // apretones de control
      p.bob = -0.5; p.hipsX = -0.25; p.lean = -0.05;
      p.thL = -0.95; p.thLY = 0.55; p.shL = 1.8 + sq * 0.1;   // gancho
      p.thR = -0.95; p.thRY = -0.55; p.shR = 1.8 + sq * 0.1;  // gancho
      p.uaR = [-1.3, -0.3, 0.05]; p.faR = -2.3 - sq * 0.15;   // sobre el hombro (el que ahoga)
      p.uaL = [-1.0, 0.35, -0.2]; p.faL = -2.1;               // bajo el brazo contrario
      p.headY = -0.2; p.headX = 0.1;                        // barbilla pegada al hombro
      return p;
    }

    case "pase-guardia": {
      // pase de guardia al través (knee slice): agarres de cuello y pierna,
      // se pone DE PIE con postura y la rodilla derecha corta como cuchillo
      // entre las piernas hasta asentarse en control lateral
      const u = cyc(t, 2.6);
      const grips = u < 0.15 ? easeOut(u / 0.15) : 1;
      const up = u < 0.2 ? 0 : u < 0.4 ? easeOut((u - 0.2) / 0.2) : 1;
      const slice = u < 0.45 ? 0 : u < 0.7 ? easeIn((u - 0.45) / 0.25) : 1;
      const settle = u < 0.75 ? 0 : u < 0.9 ? easeOut((u - 0.75) / 0.15) : 1;
      p.bob = -0.35 + up * 0.35 - slice * 0.2 - settle * 0.2;
      p.lean = 0.3 + grips * 0.1 - up * 0.05 + slice * 0.15;
      p.uaR = [-1.2, -0.25, 0.1]; p.faR = -2.1;           // cuello
      p.uaL = [-0.9, 0.25, -0.2]; p.faL = -2.0;           // pierna/cadera
      p.thR = 1.2 - up * 1.4 - slice * 0.3; p.shR = 2.0 - up * 1.7 + slice * 0.9; // la rodilla corta baja
      p.thL = 1.2 - up * 1.35 + slice * 0.5; p.shL = 2.0 - up * 1.6 - slice * 0.1; // poste trasero
      p.twist = slice * 0.5 + settle * 0.1;
      p.tz = slice * 0.2;
      p.headX = 0.15;
      return p;
    }

    /* ───────────── SUMISIONES ───────────── */
    case "mataleon": {
      // mata león desde la espalda: el antebrazo derecho rodea el cuello,
      // la izquierda empuja la nuca, ganchos apretando. La sumisión más
      // común del MMA: ~50% de las finalizaciones en UFC.
      const sq = 0.5 + Math.sin(t * 2.4) * 0.5;           // aprieta y afloja
      p.bob = -0.5; p.hipsX = -0.25; p.lean = -0.05 - sq * 0.05;
      p.thL = -0.95; p.thLY = 0.55; p.shL = 1.8 + sq * 0.15;
      p.thR = -0.95; p.thRY = -0.55; p.shR = 1.8 + sq * 0.15;
      p.uaR = [-1.35 - sq * 0.1, -0.15, 0.0]; p.faR = -2.5 - sq * 0.2;  // antebrazo al cuello
      p.uaL = [-1.15, 0.25, -0.1]; p.faL = -2.3 - sq * 0.15;            // mano a la nuca
      p.headY = -0.15; p.headX = 0.05;
      return p;
    }

    case "guillotina": {
      // guillotina DE PIE: el brazo derecho envuelve el "cuello" por
      // delante, la izquierda cierra el candado y se tira ARRIBA con la
      // cadera al frente. La segunda sumisión más común del MMA.
      const pull = 0.5 + Math.sin(t * 2.2) * 0.5;
      p.uaR = [-1.35, -0.3, 0.25]; p.faR = -2.45 - pull * 0.2;  // brazo al cuello
      p.uaL = [-1.2, 0.05, -0.05]; p.faL = -2.3;                // cierra el candado
      p.bob = -0.05 + pull * 0.07;                            // tira hacia ARRIBA
      p.lean = 0.05 - pull * 0.1;                             // pecho atrás
      p.hipsX = pull * 0.08;                                  // cadera al frente
      p.twist = 0.2; p.headX = 0.12;
      p.shL = 0.4; p.shR = 0.35;                              // base firme
      return p;
    }

    case "triangulo": {
      // triángulo desde la guardia: la pierna derecha pasa por encima del
      // "hombro" y la izquierda ancla la figura de cuatro; la cadera SUBE
      // al apretar y las manos tiran de la "cabeza" hacia abajo
      const sq = 0.5 + Math.sin(t * 2.0) * 0.5;
      p.hipsX = -1.5; p.bob = -0.78 + sq * 0.06;
      p.thR = -1.4; p.thRY = -0.45; p.shR = 1.0 + sq * 0.2;     // pierna sobre el hombro
      p.thL = -1.15; p.thLY = 0.5; p.shL = 1.6;                 // ancla (figura de cuatro)
      p.uaR = [-1.2, -0.2, 0.15]; p.faR = -2.2 - sq * 0.15;     // tira de la cabeza
      p.uaL = [-1.2, 0.2, -0.15]; p.faL = -2.2 - sq * 0.15;
      p.lean = -0.1; p.headX = -0.35;
      p.hipsZ = sq * 0.1;                                       // busca el ángulo
      return p;
    }

    case "kimura": {
      // kimura desde arriba: figura de cuatro a la "muñeca", pecho pegado
      // y la palanca lleva la "mano" hacia la espalda del rival
      const u = cyc(t, 1.8);
      const crank = u < 0.3 ? easeIn(u / 0.3) : u < 0.6 ? 1 : 1 - easeIn((u - 0.6) / 0.4);
      p.bob = -0.5; p.hipsX = 0.3;
      p.twist = 0.45 + crank * 0.2;
      p.lean = 0.45 - crank * 0.1;
      p.uaR = [-1.1, -0.3, 0.15]; p.faR = -1.9;                         // agarra la muñeca
      p.uaL = [-1.0 + crank * 0.35, 0.3, -0.2 + crank * 0.2]; p.faL = -2.0; // cierra y lleva la palanca
      p.thL = 0.8; p.shL = 1.6; p.thR = -0.2; p.shR = 0.3;              // base sentada/posteada
      p.headX = 0.2;
      return p;
    }

    case "americana": {
      // americana desde la montada: la "muñeca" se clava al suelo y se
      // pinta hacia abajo como un broche; pecho encima, peso a través
      const u = cyc(t, 1.8);
      const crank = u < 0.3 ? easeIn(u / 0.3) : u < 0.6 ? 1 : 1 - easeIn((u - 0.6) / 0.4);
      p.hipsX = 0.25; p.bob = -0.45;
      p.thL = 1.45; p.thLY = 0.75; p.shL = 2.0;                 // montada
      p.thR = 1.45; p.thRY = -0.75; p.shR = 2.0;
      p.lean = 0.35 + crank * 0.05;
      p.uaR = [-1.15, -0.25, 0.1]; p.faR = -1.8;                // clava la muñeca
      p.uaL = [-1.0 - crank * 0.25, 0.2, -0.1]; p.faL = -1.6 - crank * 0.3; // pinta hacia el suelo
      p.twist = crank * 0.25;
      p.headX = 0.15;
      return p;
    }

    /* ───────────── ESCAPES ───────────── */
    case "shrimp": {
      // escape de cadera debajo del control lateral: frames con antebrazo
      // y mano, se gira de lado y la cadera EXPLOTA hacia fuera; la rodilla
      // cercana se cuela como escudo para rehacer la guardia
      const u = cyc(t, 1.6);
      const scoot = u < 0.35 ? easeOut(u / 0.35) : 1 - easeIn((u - 0.35) / 0.65);
      p.hipsX = -1.3; p.hipsZ = 0.35 + scoot * 0.3;             // se pone de lado
      p.bob = -0.75;
      p.tx = -scoot * 0.15;                                     // la cadera escapa
      p.uaL = [-1.2, 0.1, -0.05]; p.faL = -2.3;                 // frame bajo el cuello
      p.uaR = [-1.0, -0.3, 0.3]; p.faR = -2.2;                  // frame en la cadera
      p.thL = -1.0 + scoot * 0.3; p.thLY = 0.3; p.shL = 1.4;    // rodilla escudo se cuela
      p.thR = -0.7 - scoot * 0.4; p.shR = 1.2 + scoot * 0.3;    // empuja el suelo
      p.twist = -0.2 * scoot; p.headX = -0.25;
      return p;
    }

    case "upa": {
      // puente y giro debajo de la montada: atrapa "brazo y pie" de un
      // lado, PUENTE alto con la cadera al cielo y VUELCA hacia ese lado
      const u = cyc(t, 2.0);
      const trap = u < 0.25 ? easeOut(u / 0.25) : 1;
      const bridge = u < 0.3 ? 0 : u < 0.55 ? easeOut((u - 0.3) / 0.25) : u < 0.7 ? 1 : 1 - easeIn((u - 0.7) / 0.3);
      const roll = u < 0.55 ? 0 : u < 0.75 ? easeIn((u - 0.55) / 0.2) : u < 0.85 ? 1 : 1 - easeIn((u - 0.85) / 0.15);
      void trap;
      p.hipsX = -1.4 + bridge * 0.5; p.bob = -0.72 + bridge * 0.2;  // cadera al cielo
      p.hipsZ = roll * 0.9; p.twist = 0.3 * roll;                   // vuelca
      p.tx = roll * 0.2;
      p.uaR = [-1.15, -0.3, 0.2]; p.faR = -2.3;                     // atrapa el brazo
      p.uaL = [-1.05, 0.2, -0.15]; p.faL = -2.3;
      p.thL = -1.0; p.shL = 1.7; p.thR = -1.0; p.shR = 1.7;         // pies planos junto al cuerpo
      p.headX = -0.3; p.lean = -0.1;
      return p;
    }
  }

  void clamp01;
  return null; // id de otro módulo
}
