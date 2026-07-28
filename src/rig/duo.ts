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
  "suplex":     { def: "guardia-mma", pA: 2.4, dist: 0.85 },
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
