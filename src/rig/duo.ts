/* ════════════════════════════════════════════════════════════════
   MODO DUELO — coreografía atacante ↔ rival.
   Para cada movimiento del ATACANTE: qué hace el RIVAL, a qué
   distancia y con qué disposición de escena.

   Sincronía: los movimientos tienen periodos distintos; el reloj
   del rival se escala por pD/pA para que su ciclo vaya A LA PAR
   que el del atacante (la defensa llega cuando llega el golpe).
   pA/pD = 0 → movimiento continuo (sin ciclo): reloj directo.
   ════════════════════════════════════════════════════════════════ */

export type DuoMode = "face" | "ground" | "behind";

export interface DuoCfg {
  def: string;        // movimiento del rival
  pA?: number;        // periodo del ataque en s (0 = continuo)
  pD?: number;        // periodo de la defensa en s (0 = continuo)
  dist?: number;      // separación centro a centro en modo "face"
  mode?: DuoMode;     // disposición (por defecto "face")
  top?: boolean;      // en modo "ground": true = atacante arriba
}

export const DUO_DEFAULT: DuoCfg = { def: "guardia-mma", dist: 1.1 };

export const DUO: Record<string, DuoCfg> = {
  /* ─── Guardia y defensas (el rival ATACA, tú defiendes) ─── */
  "guardia-mma":    { def: "guardia-mma", dist: 0.95 },
  "esquiva":        { def: "jab", pA: 1.4, pD: 0.9, dist: 0.98 },
  "parada":         { def: "jab", pA: 1.2, pD: 0.9, dist: 0.92 },
  "retirada":       { def: "cross", pA: 1.2, pD: 1.15, dist: 1.0 },
  "cobertura":      { def: "hook", pD: 1.2, dist: 0.95 },
  "bloqueo-alto":   { def: "circular", pA: 1.4, pD: 1.6, dist: 1.25 },
  "bloqueo-cuerpo": { def: "patada-cuerpo", pA: 1.4, pD: 1.6, dist: 1.25 },
  "chequeo":        { def: "low-kick", pA: 1.4, pD: 1.6, dist: 1.25 },

  /* ─── Puños ─── */
  "jab":            { def: "parada", pA: 0.9, pD: 1.2, dist: 0.92 },
  "cross":          { def: "retirada", pA: 1.15, pD: 1.2, dist: 0.98 },
  "hook":           { def: "cobertura", pA: 1.2, dist: 0.9 },
  "uppercut":       { def: "retirada", pA: 1.2, pD: 1.2, dist: 0.92 },
  "overhand":       { def: "bloqueo-alto", pA: 1.3, pD: 1.4, dist: 0.98 },
  "gancho-cuerpo":  { def: "bloqueo-cuerpo", pA: 1.3, pD: 1.4, dist: 0.92 },
  "superman":       { def: "cobertura", pA: 1.5, dist: 1.0 },
  "backfist":       { def: "cobertura", pA: 1.4, dist: 1.0 },

  /* ─── Codos ─── */
  "codo":           { def: "bloqueo-alto", pA: 1.0, pD: 1.4, dist: 0.9 },
  "codo-giro":      { def: "cobertura", pA: 1.3, dist: 1.05 },

  /* ─── Patadas y rodillas ─── */
  "low-kick":         { def: "chequeo", pA: 1.6, pD: 1.4, dist: 1.3 },
  "patada-cuerpo":    { def: "bloqueo-cuerpo", pA: 1.6, pD: 1.4, dist: 1.3 },
  "circular":         { def: "bloqueo-alto", pA: 1.6, pD: 1.4, dist: 1.35 },
  "frontal":          { def: "retirada", pA: 1.4, pD: 1.2, dist: 1.45 },
  "lateral":          { def: "retirada", pA: 1.5, pD: 1.2, dist: 1.45 },
  "switch":           { def: "bloqueo-cuerpo", pA: 1.4, pD: 1.4, dist: 1.3 },
  "rodilla":          { def: "clinch", pA: 1.2, dist: 0.8 },
  "rodilla-voladora": { def: "cobertura", pA: 1.6, dist: 1.4 },
  "clinch":           { def: "clinch", dist: 0.8 },

  /* ─── Derribos de pie ─── */
  "sprawl":     { def: "derribo", pA: 2.0, pD: 2.4, dist: 1.25 },
  "derribo":    { def: "sprawl", pA: 2.4, pD: 2.0, dist: 1.25 },
  "single-leg": { def: "sprawl", pA: 2.2, pD: 2.0, dist: 1.25 },
  "ippon":      { def: "guardia-mma", pA: 2.0, dist: 0.85 },
  "suplex":     { def: "guardia-mma", pA: 2.4, mode: "behind" },   // se ejecuta desde la espalda
  "guillotina": { def: "derribo", pD: 2.4, dist: 1.1 },   // caza el derribo
  "ko-plano":   { def: "cross", pA: 3.5, pD: 1.15, dist: 1.15 },

  /* ─── Suelo: arriba/abajo ─── */
  "guardia-abajo":  { def: "guardia-arriba", mode: "ground", top: false },
  "guardia-arriba": { def: "guardia-abajo", mode: "ground", top: true },
  "montada":        { def: "upa", pD: 2.0, mode: "ground", top: true },
  "ground-pound":   { def: "guardia-abajo", mode: "ground", top: true },
  "sumision":       { def: "guardia-arriba", mode: "ground", top: false },
  "media-guardia":  { def: "pase-guardia", pD: 2.6, mode: "ground", top: false },
  "side-control":   { def: "shrimp", pD: 1.6, mode: "ground", top: true },
  "rodilla-vientre":{ def: "shrimp", pD: 1.6, mode: "ground", top: true },
  "pase-guardia":   { def: "media-guardia", mode: "ground", top: true },
  "kimura":         { def: "guardia-abajo", mode: "ground", top: true },
  "americana":      { def: "guardia-abajo", mode: "ground", top: true },
  "triangulo":      { def: "guardia-arriba", mode: "ground", top: false },
  "shrimp":         { def: "side-control", mode: "ground", top: false },
  "upa":            { def: "montada", mode: "ground", top: false },

  /* ─── Espalda: ambos mirando al mismo lado, atacante detrás ─── */
  "espalda":  { def: "espalda", mode: "behind" },
  "mataleon": { def: "espalda", mode: "behind" },
};

/* ════════════════════════════════════════════════════════════════
   SECUENCIAS — el duelo con guion.
   Para golpes y derribos el rival NO repite siempre lo mismo:
   hay varios RESULTADOS que se alternan con cada click
   (defiende / le entra limpio / cae derribado).
   Cada resultado coreografía a AMBOS por tramos ("beats"):
   tt = t % T; el beat activo es el que contiene tt; su reloj local
   tm = tt - from (los movimientos cíclicos hacen %periodo interno,
   así que el impacto cae siempre en el mismo punto del beat).
   Los impactos se alinean empezando ataque y defensa en el mismo
   `from` (actúan en el mismo % de su ciclo); "golpeado" empieza
   justo en el instante del impacto.
   ════════════════════════════════════════════════════════════════ */

export interface DuoBeat { move: string; from: number; to: number }
export interface DuoOutcome { atk: DuoBeat[]; def: DuoBeat[] }
export interface DuoSeq { T: number; outcomes: DuoOutcome[] }

/** Beat activo en tt (s dentro del ciclo) y su reloj local */
export function duoBeatAt(beats: DuoBeat[], tt: number): { move: string; tm: number } {
  let b = beats[0];
  for (const x of beats) {
    if (tt >= x.from && tt < x.to) { b = x; break; }
    b = x;                       // pasado el último: se queda en el último
  }
  return { move: b.move, tm: tt - b.from };
}

export const DUO_SEQ: Record<string, DuoSeq> = {
  /* ── JAB: para o le entra ── */
  jab: {
    T: 3.6,
    outcomes: [
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "jab", from: 0.5, to: 1.4 }, { move: "guardia-mma", from: 1.4, to: 3.6 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "parada", from: 0.5, to: 1.7 }, { move: "guardia-mma", from: 1.7, to: 3.6 }] },
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "jab", from: 0.5, to: 1.4 }, { move: "guardia-mma", from: 1.4, to: 3.6 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.72 }, { move: "golpeado", from: 0.72, to: 1.92 }, { move: "guardia-mma", from: 1.92, to: 3.6 }] },
    ],
  },
  /* ── CROSS: retira o le entra ── */
  cross: {
    T: 3.8,
    outcomes: [
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "cross", from: 0.5, to: 1.65 }, { move: "guardia-mma", from: 1.65, to: 3.8 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "retirada", from: 0.5, to: 1.7 }, { move: "guardia-mma", from: 1.7, to: 3.8 }] },
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "cross", from: 0.5, to: 1.65 }, { move: "guardia-mma", from: 1.65, to: 3.8 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.79 }, { move: "golpeado", from: 0.79, to: 1.99 }, { move: "guardia-mma", from: 1.99, to: 3.8 }] },
    ],
  },
  /* ── HOOK: se cubre o le entra ── */
  hook: {
    T: 3.8,
    outcomes: [
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "hook", from: 0.5, to: 1.7 }, { move: "guardia-mma", from: 1.7, to: 3.8 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "cobertura", from: 0.5, to: 1.7 }, { move: "guardia-mma", from: 1.7, to: 3.8 }] },
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "hook", from: 0.5, to: 1.7 }, { move: "guardia-mma", from: 1.7, to: 3.8 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.8 }, { move: "golpeado", from: 0.8, to: 2.0 }, { move: "guardia-mma", from: 2.0, to: 3.8 }] },
    ],
  },
  /* ── OVERHAND: lo bloquea… o KNOCKDOWN y a rematar al suelo ── */
  overhand: {
    T: 4.6,
    outcomes: [
      { atk: [{ move: "guardia-mma", from: 0, to: 0.45 }, { move: "overhand", from: 0.45, to: 1.75 }, { move: "guardia-mma", from: 1.75, to: 4.6 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.45 }, { move: "bloqueo-alto", from: 0.45, to: 1.85 }, { move: "guardia-mma", from: 1.85, to: 4.6 }] },
      { atk: [{ move: "guardia-mma", from: 0, to: 0.45 }, { move: "overhand", from: 0.45, to: 1.75 }, { move: "guardia-mma", from: 1.75, to: 2.6 }, { move: "guardia-arriba", from: 2.6, to: 4.6 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.77 }, { move: "golpeado", from: 0.77, to: 1.25 }, { move: "derribado", from: 1.25, to: 3.2 }, { move: "guardia-abajo", from: 3.2, to: 4.6 }] },
    ],
  },
  /* ── CIRCULAR ALTA: la bloquea o le entra ── */
  circular: {
    T: 4.4,
    outcomes: [
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "circular", from: 0.5, to: 2.1 }, { move: "guardia-mma", from: 2.1, to: 4.4 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "bloqueo-alto", from: 0.5, to: 1.9 }, { move: "guardia-mma", from: 1.9, to: 4.4 }] },
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "circular", from: 0.5, to: 2.1 }, { move: "guardia-mma", from: 2.1, to: 4.4 }],
        def: [{ move: "guardia-mma", from: 0, to: 1.05 }, { move: "golpeado", from: 1.05, to: 2.25 }, { move: "guardia-mma", from: 2.25, to: 4.4 }] },
    ],
  },
  /* ── LOW KICK: lo chequea o le entra ── */
  "low-kick": {
    T: 4.0,
    outcomes: [
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "low-kick", from: 0.5, to: 2.1 }, { move: "guardia-mma", from: 2.1, to: 4.0 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "chequeo", from: 0.5, to: 1.9 }, { move: "guardia-mma", from: 1.9, to: 4.0 }] },
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "low-kick", from: 0.5, to: 2.1 }, { move: "guardia-mma", from: 2.1, to: 4.0 }],
        def: [{ move: "guardia-mma", from: 0, to: 1.0 }, { move: "golpeado", from: 1.0, to: 2.2 }, { move: "guardia-mma", from: 2.2, to: 4.0 }] },
    ],
  },
  /* ── UPPERCUT: retira o le entra ── */
  uppercut: {
    T: 3.8,
    outcomes: [
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "uppercut", from: 0.5, to: 1.7 }, { move: "guardia-mma", from: 1.7, to: 3.8 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "retirada", from: 0.5, to: 1.7 }, { move: "guardia-mma", from: 1.7, to: 3.8 }] },
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "uppercut", from: 0.5, to: 1.7 }, { move: "guardia-mma", from: 1.7, to: 3.8 }],
        def: [{ move: "guardia-mma", from: 0, to: 1.1 }, { move: "golpeado", from: 1.1, to: 2.3 }, { move: "guardia-mma", from: 2.3, to: 3.8 }] },
    ],
  },
  /* ── GANCHO AL CUERPO: lo bloquea o le entra ── */
  "gancho-cuerpo": {
    T: 3.9,
    outcomes: [
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "gancho-cuerpo", from: 0.5, to: 1.8 }, { move: "guardia-mma", from: 1.8, to: 3.9 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "bloqueo-cuerpo", from: 0.5, to: 1.9 }, { move: "guardia-mma", from: 1.9, to: 3.9 }] },
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "gancho-cuerpo", from: 0.5, to: 1.8 }, { move: "guardia-mma", from: 1.8, to: 3.9 }],
        def: [{ move: "guardia-mma", from: 0, to: 1.25 }, { move: "golpeado", from: 1.25, to: 2.45 }, { move: "guardia-mma", from: 2.45, to: 3.9 }] },
    ],
  },
  /* ── SUPERMAN PUNCH: se cubre… o KNOCKDOWN y a rematar ── */
  superman: {
    T: 4.8,
    outcomes: [
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "superman", from: 0.5, to: 2.0 }, { move: "guardia-mma", from: 2.0, to: 4.8 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "cobertura", from: 0.5, to: 2.0 }, { move: "guardia-mma", from: 2.0, to: 4.8 }] },
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "superman", from: 0.5, to: 2.0 }, { move: "guardia-mma", from: 2.0, to: 2.7 }, { move: "guardia-arriba", from: 2.7, to: 4.8 }],
        def: [{ move: "guardia-mma", from: 0, to: 1.4 }, { move: "golpeado", from: 1.4, to: 2.0 }, { move: "derribado", from: 2.0, to: 3.4 }, { move: "guardia-abajo", from: 3.4, to: 4.8 }] },
    ],
  },
  /* ── BACKFIST GIRATORIO: se cubre… o KNOCKDOWN y a rematar ── */
  backfist: {
    T: 4.4,
    outcomes: [
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "backfist", from: 0.5, to: 1.9 }, { move: "guardia-mma", from: 1.9, to: 4.4 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "cobertura", from: 0.5, to: 1.9 }, { move: "guardia-mma", from: 1.9, to: 4.4 }] },
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "backfist", from: 0.5, to: 1.9 }, { move: "guardia-mma", from: 1.9, to: 2.6 }, { move: "guardia-arriba", from: 2.6, to: 4.4 }],
        def: [{ move: "guardia-mma", from: 0, to: 1.2 }, { move: "golpeado", from: 1.2, to: 1.9 }, { move: "derribado", from: 1.9, to: 3.3 }, { move: "guardia-abajo", from: 3.3, to: 4.4 }] },
    ],
  },
  /* ── CODO HORIZONTAL: lo bloquea o le entra ── */
  codo: {
    T: 3.6,
    outcomes: [
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "codo", from: 0.5, to: 1.5 }, { move: "guardia-mma", from: 1.5, to: 3.6 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "bloqueo-alto", from: 0.5, to: 1.7 }, { move: "guardia-mma", from: 1.7, to: 3.6 }] },
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "codo", from: 0.5, to: 1.5 }, { move: "guardia-mma", from: 1.5, to: 3.6 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.85 }, { move: "golpeado", from: 0.85, to: 2.05 }, { move: "guardia-mma", from: 2.05, to: 3.6 }] },
    ],
  },
  /* ── CODO GIRATORIO: se cubre… o KNOCKDOWN y a rematar ── */
  "codo-giro": {
    T: 4.4,
    outcomes: [
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "codo-giro", from: 0.5, to: 1.8 }, { move: "guardia-mma", from: 1.8, to: 4.4 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "cobertura", from: 0.5, to: 1.8 }, { move: "guardia-mma", from: 1.8, to: 4.4 }] },
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "codo-giro", from: 0.5, to: 1.8 }, { move: "guardia-mma", from: 1.8, to: 2.5 }, { move: "guardia-arriba", from: 2.5, to: 4.4 }],
        def: [{ move: "guardia-mma", from: 0, to: 1.15 }, { move: "golpeado", from: 1.15, to: 1.85 }, { move: "derribado", from: 1.85, to: 3.25 }, { move: "guardia-abajo", from: 3.25, to: 4.4 }] },
    ],
  },
  /* ── CIRCULAR AL CUERPO: lo bloquea o le entra ── */
  "patada-cuerpo": {
    T: 4.4,
    outcomes: [
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "patada-cuerpo", from: 0.5, to: 2.1 }, { move: "guardia-mma", from: 2.1, to: 4.4 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "bloqueo-cuerpo", from: 0.5, to: 1.9 }, { move: "guardia-mma", from: 1.9, to: 4.4 }] },
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "patada-cuerpo", from: 0.5, to: 2.1 }, { move: "guardia-mma", from: 2.1, to: 4.4 }],
        def: [{ move: "guardia-mma", from: 0, to: 1.3 }, { move: "golpeado", from: 1.3, to: 2.5 }, { move: "guardia-mma", from: 2.5, to: 4.4 }] },
    ],
  },
  /* ── FRONTAL (teep): retira… o le empuja y pierde la base ── */
  frontal: {
    T: 4.2,
    outcomes: [
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "frontal", from: 0.5, to: 1.9 }, { move: "guardia-mma", from: 1.9, to: 4.2 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "retirada", from: 0.5, to: 1.7 }, { move: "guardia-mma", from: 1.7, to: 4.2 }] },
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "frontal", from: 0.5, to: 1.9 }, { move: "guardia-mma", from: 1.9, to: 4.2 }],
        def: [{ move: "guardia-mma", from: 0, to: 1.27 }, { move: "golpeado", from: 1.27, to: 2.0 }, { move: "zozobra", from: 2.0, to: 2.9 }, { move: "guardia-mma", from: 2.9, to: 4.2 }] },
    ],
  },
  /* ── LATERAL (side kick): retira… o le empuja y pierde la base ── */
  lateral: {
    T: 4.2,
    outcomes: [
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "lateral", from: 0.5, to: 2.0 }, { move: "guardia-mma", from: 2.0, to: 4.2 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "retirada", from: 0.5, to: 1.7 }, { move: "guardia-mma", from: 1.7, to: 4.2 }] },
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "lateral", from: 0.5, to: 2.0 }, { move: "guardia-mma", from: 2.0, to: 4.2 }],
        def: [{ move: "guardia-mma", from: 0, to: 1.4 }, { move: "golpeado", from: 1.4, to: 2.2 }, { move: "zozobra", from: 2.2, to: 3.1 }, { move: "guardia-mma", from: 3.1, to: 4.2 }] },
    ],
  },
  /* ── SWITCH KICK: lo bloquea o le entra ── */
  switch: {
    T: 4.0,
    outcomes: [
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "switch", from: 0.5, to: 1.9 }, { move: "guardia-mma", from: 1.9, to: 4.0 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "bloqueo-cuerpo", from: 0.5, to: 1.9 }, { move: "guardia-mma", from: 1.9, to: 4.0 }] },
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "switch", from: 0.5, to: 1.9 }, { move: "guardia-mma", from: 1.9, to: 4.0 }],
        def: [{ move: "guardia-mma", from: 0, to: 1.2 }, { move: "golpeado", from: 1.2, to: 2.4 }, { move: "guardia-mma", from: 2.4, to: 4.0 }] },
    ],
  },
  /* ── RODILLAZO: aguanta en clinch o le entra ── */
  rodilla: {
    T: 3.6,
    outcomes: [
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "rodilla", from: 0.5, to: 1.7 }, { move: "guardia-mma", from: 1.7, to: 3.6 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "clinch", from: 0.5, to: 1.7 }, { move: "guardia-mma", from: 1.7, to: 3.6 }] },
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "rodilla", from: 0.5, to: 1.7 }, { move: "guardia-mma", from: 1.7, to: 3.6 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.92 }, { move: "golpeado", from: 0.92, to: 2.12 }, { move: "guardia-mma", from: 2.12, to: 3.6 }] },
    ],
  },
  /* ── RODILLA VOLADORA: se cubre… o KNOCKDOWN y a rematar ── */
  "rodilla-voladora": {
    T: 4.8,
    outcomes: [
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "rodilla-voladora", from: 0.5, to: 2.1 }, { move: "guardia-mma", from: 2.1, to: 4.8 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "cobertura", from: 0.5, to: 2.1 }, { move: "guardia-mma", from: 2.1, to: 4.8 }] },
      { atk: [{ move: "guardia-mma", from: 0, to: 0.5 }, { move: "rodilla-voladora", from: 0.5, to: 2.1 }, { move: "guardia-mma", from: 2.1, to: 2.8 }, { move: "guardia-arriba", from: 2.8, to: 4.8 }],
        def: [{ move: "guardia-mma", from: 0, to: 1.45 }, { move: "golpeado", from: 1.45, to: 2.1 }, { move: "derribado", from: 2.1, to: 3.5 }, { move: "guardia-abajo", from: 3.5, to: 4.8 }] },
    ],
  },
  /* ── DERRIBO (double leg): lo defiende de pie… o cae y le montan ── */
  derribo: {
    T: 5.2,
    outcomes: [
      { atk: [{ move: "guardia-mma", from: 0, to: 0.6 }, { move: "derribo", from: 0.6, to: 3.0 }, { move: "guardia-mma", from: 3.0, to: 5.2 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.6 }, { move: "defensa-derribo", from: 0.6, to: 2.0 }, { move: "guardia-mma", from: 2.0, to: 5.2 }] },
      { atk: [{ move: "guardia-mma", from: 0, to: 0.6 }, { move: "derribo", from: 0.6, to: 3.0 }, { move: "guardia-arriba", from: 3.0, to: 5.2 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.6 }, { move: "volcado", from: 0.6, to: 2.6 }, { move: "guardia-abajo", from: 2.6, to: 5.2 }] },
    ],
  },
  /* ── SINGLE LEG: lo defiende de pie… o cae y le montan ── */
  "single-leg": {
    T: 5.0,
    outcomes: [
      { atk: [{ move: "guardia-mma", from: 0, to: 0.6 }, { move: "single-leg", from: 0.6, to: 2.8 }, { move: "guardia-mma", from: 2.8, to: 5.0 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.6 }, { move: "defensa-derribo", from: 0.6, to: 2.0 }, { move: "guardia-mma", from: 2.0, to: 5.0 }] },
      { atk: [{ move: "guardia-mma", from: 0, to: 0.6 }, { move: "single-leg", from: 0.6, to: 2.8 }, { move: "guardia-arriba", from: 2.8, to: 5.0 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.6 }, { move: "volcado", from: 0.6, to: 2.6 }, { move: "guardia-abajo", from: 2.6, to: 5.0 }] },
    ],
  },
  /* ── SUPLEX (DESDE LA ESPALDA): lo defiende de pie… o vuela ── */
  suplex: {
    T: 4.6,
    outcomes: [
      { atk: [{ move: "guardia-mma", from: 0, to: 0.6 }, { move: "suplex", from: 0.6, to: 3.0 }, { move: "guardia-mma", from: 3.0, to: 4.6 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.7 }, { move: "defensa-derribo", from: 0.7, to: 2.1 }, { move: "guardia-mma", from: 2.1, to: 4.6 }] },
      { atk: [{ move: "guardia-mma", from: 0, to: 0.6 }, { move: "suplex", from: 0.6, to: 3.0 }, { move: "guardia-arriba", from: 3.0, to: 4.6 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.7 }, { move: "volado", from: 0.7, to: 2.5 }, { move: "guardia-abajo", from: 2.5, to: 4.6 }] },
    ],
  },
  /* ── IPPON (seoi nage): lo defiende de pie… o proyección limpia ── */
  ippon: {
    T: 4.4,
    outcomes: [
      { atk: [{ move: "guardia-mma", from: 0, to: 0.6 }, { move: "ippon", from: 0.6, to: 2.6 }, { move: "guardia-mma", from: 2.6, to: 4.4 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.7 }, { move: "defensa-derribo", from: 0.7, to: 2.1 }, { move: "guardia-mma", from: 2.1, to: 4.4 }] },
      { atk: [{ move: "guardia-mma", from: 0, to: 0.6 }, { move: "ippon", from: 0.6, to: 2.6 }, { move: "guardia-mma", from: 2.6, to: 4.4 }],
        def: [{ move: "guardia-mma", from: 0, to: 0.7 }, { move: "volcado", from: 0.7, to: 2.7 }, { move: "guardia-abajo", from: 2.7, to: 4.4 }] },
    ],
  },
};
