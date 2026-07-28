import { clamp01, clonePose, easeIn, easeOut } from "./poseDriver";
import type { Pose } from "./poseDriver";

/* ════════════════════════════════════════════════════════════════
   SET MMA — biblioteca procedural de movimientos y posturas.
   En pie: guardia, puños, patadas, clinch.
   Suelo: derribos, posiciones, ground & pound, sumisión, KO.
   Cada función devuelve la Pose para un instante t (segundos).
   ════════════════════════════════════════════════════════════════ */

export type MmaMoveId =
  | "guardia-mma" | "esquiva"
  | "jab" | "cross" | "hook" | "uppercut" | "codo"
  | "low-kick" | "circular" | "frontal" | "rodilla"
  | "clinch" | "sprawl" | "derribo"
  | "guardia-abajo" | "guardia-arriba" | "montada" | "ground-pound" | "sumision"
  | "ko-plano";

export type MmaSeccion = "pie" | "suelo";

export const MMA_MOVES: { id: MmaMoveId; label: string; seccion: MmaSeccion; grupo: string }[] = [
  // ─── EN PIE ───
  { id: "guardia-mma", label: "Guardia MMA", seccion: "pie", grupo: "Guardia" },
  { id: "esquiva", label: "Esquiva (slip)", seccion: "pie", grupo: "Guardia" },
  { id: "jab", label: "Jab", seccion: "pie", grupo: "Puños" },
  { id: "cross", label: "Directo (cross)", seccion: "pie", grupo: "Puños" },
  { id: "hook", label: "Gancho (hook)", seccion: "pie", grupo: "Puños" },
  { id: "uppercut", label: "Uppercut", seccion: "pie", grupo: "Puños" },
  { id: "codo", label: "Codo", seccion: "pie", grupo: "Puños" },
  { id: "low-kick", label: "Low kick", seccion: "pie", grupo: "Patadas" },
  { id: "circular", label: "Circular alta", seccion: "pie", grupo: "Patadas" },
  { id: "frontal", label: "Frontal (teep)", seccion: "pie", grupo: "Patadas" },
  { id: "rodilla", label: "Rodillazo", seccion: "pie", grupo: "Patadas" },
  { id: "clinch", label: "Clinch", seccion: "pie", grupo: "Clinch" },
  // ─── SUELO ───
  { id: "sprawl", label: "Sprawl (defensa)", seccion: "suelo", grupo: "Derribos" },
  { id: "derribo", label: "Derribo (double leg)", seccion: "suelo", grupo: "Derribos" },
  { id: "guardia-abajo", label: "Guardia (abajo)", seccion: "suelo", grupo: "Posiciones" },
  { id: "guardia-arriba", label: "Guardia (arriba)", seccion: "suelo", grupo: "Posiciones" },
  { id: "montada", label: "Montada", seccion: "suelo", grupo: "Posiciones" },
  { id: "ground-pound", label: "Ground & pound", seccion: "suelo", grupo: "Ataque" },
  { id: "sumision", label: "Sumisión (armbar)", seccion: "suelo", grupo: "Ataque" },
  { id: "ko-plano", label: "KO (caída atrás)", seccion: "suelo", grupo: "KO" },
];

/** Guardia MMA: manos altas, perfil blado, rebote ligero */
const MMA_GUARD: Pose = {
  bob: 0, hipsX: 0, hipsY: 0, hipsZ: 0,
  lean: 0.1, twist: 0.35,
  headX: 0.08, headY: 0,
  uaR: [-1.0, 0, 0.3], faR: -2.0,
  uaL: [-1.1, -0.2, -0.05], faL: -2.05,
  thL: -0.22, thLY: 0, shL: 0.35,
  thR: 0.18, thRY: 0, shR: 0.3,
};

const cyc = (t: number, period: number) => (t % period) / period;

export function mmaPoseFor(id: string, t: number): Pose {
  const p = clonePose(MMA_GUARD);

  switch (id) {
    /* ───────────── DE PIE ───────────── */
    case "guardia-mma": {
      const b = Math.abs(Math.sin(t * 4.2));
      p.bob = b * 0.025;
      p.twist = 0.35 + Math.sin(t * 1.4) * 0.04;
      p.uaR = [-1.0 + Math.sin(t * 4.2) * 0.04, 0, 0.3];
      p.uaL = [-1.1 + Math.cos(t * 4.2) * 0.04, -0.2, -0.05];
      return p;
    }

    case "esquiva": {
      const u = cyc(t, 1.4);
      const k = Math.sin(u * Math.PI * 2); // izquierda-derecha
      p.lean = 0.1 + Math.abs(k) * 0.12;
      p.twist = 0.35 + k * 0.3;
      p.headX = 0.08 + Math.abs(k) * 0.1;
      p.bob = -Math.abs(k) * 0.05;
      return p;
    }

    /* ───────────── GOLPES ───────────── */
    case "jab": {
      const u = cyc(t, 0.9);
      let ext: number;
      if (u < 0.25) ext = easeOut(u / 0.25);            // sale rápido
      else if (u < 0.45) ext = 1;
      else ext = 1 - easeIn((u - 0.45) / 0.55);         // vuelve
      p.uaL = [-1.1 - ext * 0.5, -0.2 + ext * 0.2, -0.05];
      p.faL = -2.05 + ext * 1.95;                       // brazo se estira
      // el hombro IZQUIERDO atraviesa con el golpe (twist/hipsY negativos):
      // cuerpo y brazo avanzan juntos, como en el boxeo real
      p.twist = 0.35 - ext * 0.3;
      p.hipsY = -ext * 0.08;
      p.bob = ext * 0.03;
      p.lean = 0.1 + ext * 0.08;
      return p;
    }

    case "cross": {
      const u = cyc(t, 1.15);
      let ext: number;
      if (u < 0.3) ext = easeOut(u / 0.3);
      else if (u < 0.5) ext = 1;
      else ext = 1 - easeIn((u - 0.5) / 0.5);
      p.uaR = [-1.0 - ext * 0.58, 0, 0.3 - ext * 0.28];
      p.faR = -2.0 + ext * 1.92;
      // la cadera y el hombro DERECHO atraviesan con el golpe (rotación grande:
      // el cross nace del pie trasero y termina con el cuerpo casi de frente)
      p.twist = 0.35 + ext * 0.7;
      p.hipsY = ext * 0.25;
      p.lean = 0.1 + ext * 0.12;
      p.bob = ext * 0.03;
      return p;
    }

    case "hook": {
      const u = cyc(t, 1.1);
      // carga: el brazo abre fuera (codo alto, puño al lado de la cabeza)…
      // ¡y TAMBIÉN decae!: si no, el ciclo acaba con el brazo abierto
      const load = u < 0.25 ? easeOut(u / 0.25) : u < 0.5 ? 1 : 1 - easeIn((u - 0.5) / 0.25);
      // barrido: arco horizontal rápido a través del objetivo, pausa y vuelta
      const s = u < 0.25 ? 0 : u < 0.5 ? easeOut((u - 0.25) / 0.25) : u < 0.62 ? 1 : 1 - easeIn((u - 0.62) / 0.38);
      // El arco horizontal sale del eje Z (codo fuera) + eje Y (barrido
      // alrededor del vertical): con el brazo colgando, Y solo es efectiva
      // después de abrir el brazo con Z (orden de euler XYZ).
      // Base = valores de GUARDIA: al final del ciclo todo vuelve a su sitio.
      p.uaL = [
        -1.1 + load * 0.5 - s * 0.6,    // guardia → sube en la carga → horizontal al impacto
        -s * 1.1,                       // barrido a TRAVÉS del objetivo
        -0.05 + load * 0.95 - s * 0.55, // codo abre fuera en la carga → cierra al impacto → guardia
      ];
      p.faL = -1.55;                                     // codo a 90° siempre
      // como en el jab: el hombro izquierdo atraviesa con el arco
      p.twist = 0.35 - s * 0.55;
      p.hipsY = -s * 0.15;
      p.lean = 0.1 + s * 0.1;
      p.bob = -load * 0.03 + s * 0.02;
      p.uaR = [-1.0, 0, 0.3]; p.faR = -2.0;             // la otra protege
      return p;
    }

    case "uppercut": {
      const u = cyc(t, 1.2);
      const dip = u < 0.3 ? easeIn(u / 0.3) : 0;                     // carga abajo
      const up = u < 0.3 ? 0 : u < 0.55 ? easeOut((u - 0.3) / 0.25) : 1 - easeIn((u - 0.55) / 0.45);
      p.bob = -dip * 0.09 + up * 0.1;
      p.lean = 0.1 + dip * 0.25 - up * 0.15;
      p.uaR = [-1.0 + dip * 0.5 - up * 0.85, 0, 0.25];
      p.faR = -2.0 + up * 0.3;                          // sube con el codo cerrado
      // como en el cross: cadera y hombro derecho impulsan hacia arriba/adelante
      p.twist = 0.35 + up * 0.4;
      p.hipsY = up * 0.12;
      return p;
    }

    case "codo": {
      const u = cyc(t, 1.0);
      const s = u < 0.35 ? easeOut(u / 0.35) : 1 - easeIn((u - 0.35) / 0.65);
      p.uaR = [-1.35, -0.5 + s * 1.1, 0.1];
      p.faR = -2.45;                                     // puño pegado: pega el codo
      p.twist = 0.35 + s * 0.5;
      p.lean = 0.1 + s * 0.1;
      return p;
    }

    /* ───────────── PATADAS Y RODILLAS ───────────── */
    case "low-kick": {
      // biomecánica: la fuerza nace del suelo → cadera rota completa (con pivote
      // del pie de apoyo) → la espinilla llega ÚLTIMA, como látigo, a través del
      // objetivo. Brazo del lado que patea barre atrás, la contraria hace "long guard".
      const u = cyc(t, 1.6);
      const step = u < 0.3 ? easeOut(u / 0.3) : 1;                     // paso fuera + carga
      const whip = u < 0.3 ? 0 : u < 0.5 ? easeOut((u - 0.3) / 0.2) : 1 - easeIn((u - 0.5) / 0.5);
      p.tx = step * 0.06;                              // abre la base al entrar
      p.bob = -step * 0.03 - whip * 0.03;
      p.thR = 0.18 - whip * 1.35;                      // la espinilla cruza el objetivo
      p.shR = 0.55 - whip * 0.45;                      // semidoblada → extiende al contacto
      p.hipsY = whip * 0.55;                           // la cadera DERECHA atraviesa (giro completo)
      p.twist = 0.35 - whip * 0.7;                     // hombros contrarrotan: equilibrio
      p.lean = 0.1 - whip * 0.3;                       // se echa atrás al patear
      p.hipsZ = whip * 0.18;                           // cae hacia el lado de apoyo
      p.ankL = [0, whip * 0.6, 0];                     // ¡pivote del pie de apoyo!
      p.uaR = [-1.0 + whip * 1.3, 0, 0.3 + whip * 0.3]; // brazo del lado que patea barre atrás
      p.faR = -2.0 + whip * 1.7;
      p.uaL = [-1.1 - whip * 0.2, -0.2, -0.05 - whip * 0.3]; // long guard al frente
      p.faL = -2.05 + whip * 1.6;
      p.thL = -0.22; p.shL = 0.4;
      return p;
    }

    case "circular": {
      const u = cyc(t, 1.6);
      let k: number;
      if (u < 0.4) k = easeIn(u / 0.4) * 0.3 - 0.3;      // carga
      else if (u < 0.62) k = easeOut((u - 0.4) / 0.22);  // sube la pierna
      else k = 1 - easeIn((u - 0.62) / 0.38);
      p.thR = 0.18 - Math.max(0, k) * 1.75;              // alto
      p.thRY = Math.max(0, k) * 0.5;
      p.shR = 0.3 - Math.max(0, k) * 0.22;               // extendida en el impacto
      p.hipsY = Math.max(0, k) * 0.55;                   // cadera derecha atraviesa
      p.twist = 0.35 - Math.max(0, k) * 0.7;             // hombros contrarrotan
      p.lean = 0.1 - Math.max(0, k) * 0.4;
      p.uaR = [-0.6, 0, 0.8]; p.faR = -1.2;
      p.uaL = [-1.1, -0.2, -0.05]; p.faL = -2.0;
      return p;
    }

    case "frontal": {
      // teep: rodilla al pecho (cámara ~90°), extensión con empuje de cadera,
      // brazo del lado de la pierna cae atrás, la contraria protege la cara.
      const u = cyc(t, 1.4);
      const lift = u < 0.35 ? easeOut(u / 0.35) : 1 - easeIn((u - 0.35) / 0.65);
      const push = u > 0.35 && u < 0.55 ? easeOut((u - 0.35) / 0.2) : u >= 0.55 ? 1 - easeIn((u - 0.55) / 0.45) : 0;
      p.thR = 0.18 - lift * 1.35;                        // rodilla al pecho
      p.shR = 1.7 - push * 1.6;                          // cámara → extensión
      p.tz = push * 0.08;                                // la cadera empuja al objetivo
      p.lean = 0.1 - push * 0.25;
      p.uaR = [-1.0 + push * 1.2, 0, 0.3 + push * 0.3];  // brazo del lado de la pierna atrás
      p.faR = -2.0 + push * 1.5;
      p.uaL = [-1.1 - push * 0.15, -0.2, -0.05];         // la contraria arriba protege
      p.faL = -2.05;
      return p;
    }

    case "rodilla": {
      const u = cyc(t, 1.2);
      const k = u < 0.35 ? easeOut(u / 0.35) : 1 - easeIn((u - 0.35) / 0.65);
      p.thR = 0.18 - k * 1.55;
      p.shR = 0.3 + k * 1.7;                             // pierna recogida fuerte
      p.bob = k * 0.12;                                  // salto al impacto
      p.lean = 0.1 + k * 0.15;
      p.uaR = [-1.0 + k * 1.2, 0, 0.3]; p.faR = -2.0;    // tira del "cuello"
      p.uaL = [-1.1 + k * 1.2, -0.2, -0.05]; p.faL = -2.05;
      return p;
    }

    /* ───────────── LUCHA ───────────── */
    case "clinch": {
      const pull = Math.max(0, Math.sin(t * 1.6));       // tirones de muay thai
      p.uaR = [-1.35, -0.25, 0.1]; p.faR = -1.9;
      p.uaL = [-1.35, 0.25, -0.1]; p.faL = -1.9;
      p.twist = 0.2; p.lean = 0.15 + pull * 0.12;
      p.headX = 0.15;
      p.bob = pull * 0.03;
      p.uaR[0] += pull * 0.2; p.uaL[0] += pull * 0.2;
      return p;
    }

    case "sprawl": {
      const u = cyc(t, 2.0);
      const k = u < 0.25 ? easeOut(u / 0.25) : 1 - easeIn((u - 0.25) / 0.75) * 0.85;
      p.hipsX = k * 0.8;                                 // pecho al suelo
      p.bob = -k * 0.55;
      p.thL = -0.22 + k * 0.95; p.thR = 0.18 + k * 0.95; // piernas atrás
      p.shL = 0.35 - k * 0.15; p.shR = 0.3 - k * 0.1;
      p.uaR = [-1.0 - k * 0.4, 0, 0.5]; p.faR = -2.0 + k * 1.5; // brazos apoyan
      p.uaL = [-1.1 - k * 0.4, -0.2, -0.5]; p.faL = -2.05 + k * 1.55;
      p.lean = 0.1; p.headX = -0.2 * k;
      return p;
    }

    case "derribo": {
      // double leg: cambio de nivel doblando RODILLAS (espalda recta, cabeza
      // arriba), paso de penetración profundo con rodilla trasera casi al
      // suelo, y se conduce a través del oponente.
      const u = cyc(t, 2.4);
      const drop = u < 0.3 ? easeIn(u / 0.3) : 1;
      const pen = u < 0.35 ? 0 : u < 0.6 ? easeOut((u - 0.35) / 0.25) : 1;
      const lift = u < 0.65 ? 0 : u < 0.85 ? easeOut((u - 0.65) / 0.2) : 1 - easeIn((u - 0.85) / 0.15);
      const k = Math.max(drop, pen);
      p.bob = -drop * 0.2 - pen * 0.3 + lift * 0.45;
      p.tz = pen * 0.25;                                 // penetra hacia delante
      p.lean = 0.1 + drop * 0.15 - lift * 0.3;           // espalda recta, NO doblar cintura
      p.headX = 0.05 - 0.15 * k;                         // cabeza arriba, mirada al frente
      p.uaR = [-1.0 + drop * 0.3, -0.3, 0.15]; p.faR = -2.0 + drop * 0.6;
      p.uaL = [-1.1 + drop * 0.3, 0.15, -0.15]; p.faL = -2.05 + drop * 0.65;
      p.thL = -0.22 - pen * 0.7; p.shL = 0.35 + pen * 0.6;  // pierna adelantada profunda
      p.thR = 0.18 + pen * 0.25; p.shR = 0.3 + pen * 1.6;   // rodilla trasera casi al suelo
      return p;
    }

    /* ───────────── SUELO ───────────── */
    case "guardia-abajo": {
      const pinch = Math.sin(t * 1.2) * 0.06;
      p.hipsX = -1.5; p.bob = -0.82;
      p.thL = -1.05 - pinch; p.thLY = 0.35; p.shL = 1.45;
      p.thR = -1.05 + pinch; p.thRY = -0.35; p.shR = 1.45;
      p.uaR = [-1.05, -0.3, 0.2]; p.faR = -1.7;
      p.uaL = [-1.05, 0.3, -0.2]; p.faL = -1.7;
      p.lean = -0.1; p.headX = -0.35;
      return p;
    }

    case "guardia-arriba": {
      const push = Math.max(0, Math.sin(t * 1.5)) * 0.1;
      p.hipsX = 0.35; p.bob = -0.52;
      p.thL = 1.3; p.thLY = 0.55; p.shL = 2.1;
      p.thR = 1.3; p.thRY = -0.55; p.shR = 2.1;
      p.lean = 0.3 + push; p.twist = 0;
      p.uaR = [-0.95 - push, -0.25, 0.15]; p.faR = -0.55;
      p.uaL = [-0.95 - push, 0.25, -0.15]; p.faL = -0.55;
      p.headX = 0.05;
      return p;
    }

    case "montada": {
      const k = Math.abs(Math.sin(t * 1.3)) * 0.05;
      p.hipsX = 0.25; p.bob = -0.5 - k;
      p.thL = 1.45; p.thLY = 0.75; p.shL = 2.0;          // piernas abiertas a horcajadas
      p.thR = 1.45; p.thRY = -0.75; p.shR = 2.0;
      p.lean = 0.3; p.twist = 0;
      p.uaR = [-0.9, -0.2, 0.35]; p.faR = -1.9;
      p.uaL = [-0.9, 0.2, -0.35]; p.faL = -1.9;
      p.headX = 0.1;
      return p;
    }

    case "ground-pound": {
      const ph = t * 5;
      const punchR = Math.max(0, Math.sin(ph));
      const punchL = Math.max(0, Math.sin(ph + Math.PI));
      p.hipsX = 0.25; p.bob = -0.5;
      p.thL = 1.45; p.thLY = 0.75; p.shL = 2.0;
      p.thR = 1.45; p.thRY = -0.75; p.shR = 2.0;
      p.lean = 0.35 + Math.max(punchR, punchL) * 0.2;
      p.twist = (punchR - punchL) * 0.2;
      p.uaR = [-0.9 - punchR * 0.55, -0.2, 0.35]; p.faR = -1.9 + punchR * 1.2;
      p.uaL = [-0.9 - punchL * 0.55, 0.2, -0.35]; p.faL = -1.9 + punchL * 1.2;
      return p;
    }

    case "sumision": {
      const buck = Math.max(0, Math.sin(t * 2.2)) * 0.08;
      p.hipsX = -1.5; p.bob = -0.78 + buck;              // empuje de cadera
      p.thL = -1.35; p.thLY = 0.4; p.shL = 0.7;          // pierna sobre la "cara"
      p.thR = -0.95; p.thRY = -0.5; p.shR = 1.3;         // la otra cruza
      p.uaR = [-1.25, -0.15, 0.15]; p.faR = -1.5;        // tira del brazo
      p.uaL = [-1.25, 0.15, -0.15]; p.faL = -1.5;
      p.lean = -0.15 - buck * 0.5; p.headX = -0.3;
      return p;
    }

    case "ko-plano": {
      const k = easeOut(clamp01((t % 3.5) / 0.8));
      p.hipsX = -1.5 * k; p.bob = -0.82 * k;
      p.lean = 0.1 - 0.1 * k; p.twist = 0.35 - 0.35 * k;
      p.uaR = [-1.0 + 0.6 * k, 0, 0.3 + 0.5 * k]; p.faR = -2.0 + 1.6 * k;
      p.uaL = [-1.1 + 0.7 * k, -0.2, -0.05 - 0.75 * k]; p.faL = -2.05 + 1.65 * k;
      p.thL = -0.22 + 0.35 * k; p.shL = 0.35 + 0.2 * k;
      p.thR = 0.18 + 0.2 * k; p.shR = 0.3 + 0.15 * k;
      p.headX = 0.08 - 0.4 * k;
      return p;
    }

  }

  return p; // id desconocido → guardia MMA
}
