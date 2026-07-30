/* ════════════════════════════════════════════════════════════════
   REPLAY MMAM — contrato de eventos entre el motor de combate de
   MMAM (src/core/combat, combate por turnos) y el motor de
   animación procedural de ARENA RIG.

   MMAM decide QUÉ pasa (acción, calidad del impacto, derribo,
   final); ARENA RIG muestra CÓMO pasa. Este módulo traduce cada
   entrada del log de combate (CombatLogEntry + ActionResult) a un
   PASO de escena: qué movimiento ejecuta cada luchador, qué
   resultado del guion (DUO_SEQ) se elige, quién ataca y cuánto
   dura el paso.

   Los tipos de entrada reflejan 1:1 los de mmam/src/types:
   - action      → ActionType (src/types/actions.ts)
   - hit         → HitQuality (miss/blocked/graze/clean/counter)
   - finish      → FinishType (src/types/combat.ts)
   ════════════════════════════════════════════════════════════════ */

export type MmamHit = "miss" | "blocked" | "graze" | "clean" | "counter";

export type MmamFinish =
  | "ko" | "tko_gnp" | "tko_strikes" | "tko_body" | "tko_corner" | "tko_doctor"
  | "submission"
  | "decision_unanimous" | "decision_split" | "decision_majority";

/** Evento de combate tal y como lo genera MMAM (subconjunto que
    necesita la animación; el mensaje de narración viene de MMAM). */
export interface FightEvent {
  round: number;
  attacker: "player" | "opponent";
  action: string;            // ActionType de MMAM
  hit?: MmamHit;             // calidad del impacto (si aplica)
  knockdown?: boolean;
  flashKnockdown?: boolean;
  bleeding?: boolean;        // mmam causedBleeding: abre un corte
  newPosition?: string;      // Position de MMAM si hubo cambio
  finish?: MmamFinish;       // si el evento acaba el combate
  message: string;           // narración que escribe MMAM
}

/** Paso de escena resuelto: listo para que el loop lo ejecute. */
export interface ReplayStep {
  move: string;        // id de movimiento arena-rig que ejecuta quien ATACA
  outcome: number;     // índice de resultado en DUO_SEQ[move] (si tiene guion)
  swap: boolean;       // false = ataca el luchador principal, true = ataca el rival
  dur: number;         // duración del paso en segundos
  round: number;
  label: string;       // línea de narración para el feed
  finish?: MmamFinish;
  dmg: [number, number];      // daño facial acumulado [player, opponent] tras este paso (0..1)
  bleed: [boolean, boolean];  // corte abierto [player, opponent]
}

/* ─── Tabla de traducción acción MMAM → movimiento arena-rig ───
   kind:
   - strike:   golpe con guion DUO_SEQ (outcome 0 = defiende, 1 = le entra/cae)
   - takedown: derribo con guion (outcome 0 = consuma, 1 = defendido)
   - defense:  acción defensiva del turno → la escena la protagoniza
               el OTRO atacando y este defendiendo (outcome fijo)
   - hold:     posición/acción continua sin guion (clinch, suelo…)
   - sub:      sumisión (posición mantenida; más larga si hay tap)   */
type Kind = "strike" | "takedown" | "defense" | "hold" | "sub";
const MAP: Record<string, { move: string; kind: Kind; outcome?: number }> = {
  /* de pie — puños */
  jab:            { move: "jab", kind: "strike" },
  cross:          { move: "cross", kind: "strike" },
  hook:           { move: "hook", kind: "strike" },
  uppercut:       { move: "uppercut", kind: "strike" },
  body_punch:     { move: "gancho-cuerpo", kind: "strike" },
  overhand:       { move: "overhand", kind: "strike" },
  /* de pie — patadas */
  leg_kick:       { move: "low-kick", kind: "strike" },
  body_kick:      { move: "patada-cuerpo", kind: "strike" },
  head_kick:      { move: "circular", kind: "strike" },
  /* derribos */
  takedown_single:{ move: "single-leg", kind: "takedown" },
  takedown_double:{ move: "derribo", kind: "takedown" },
  takedown_trip:  { move: "ippon", kind: "takedown" },
  /* defensas (las ejecuta el OTRO en escena) */
  block:          { move: "hook", kind: "defense", outcome: 0 },
  parry:          { move: "jab", kind: "defense", outcome: 0 },
  sprawl:         { move: "derribo", kind: "defense", outcome: 1 },
  /* clinch */
  clinch_entry:   { move: "clinch", kind: "hold" },
  clinch_knee:    { move: "rodilla", kind: "strike" },
  clinch_elbow:   { move: "codo", kind: "strike" },
  clinch_dirty_boxing: { move: "hook", kind: "strike" },
  clinch_takedown:{ move: "ippon", kind: "takedown" },
  clinch_break:   { move: "clinch", kind: "hold" },
  clinch_control: { move: "clinch", kind: "hold" },
  /* suelo — arriba */
  gnp_punch:      { move: "ground-pound", kind: "hold" },
  gnp_elbow:      { move: "ground-pound", kind: "hold" },
  gnp_posture:    { move: "montada", kind: "hold" },
  advance_position: { move: "pase-guardia", kind: "hold" },
  maintain_position: { move: "side-control", kind: "hold" },
  /* suelo — abajo */
  escape_standup: { move: "upa", kind: "hold" },
  escape_sweep:   { move: "upa", kind: "hold" },
  escape_improve: { move: "shrimp", kind: "hold" },
  submission_guard: { move: "triangulo", kind: "sub" },
  survive:        { move: "guardia-abajo", kind: "hold" },
  /* sumisiones */
  sub_rnc:        { move: "mataleon", kind: "sub" },
  sub_armbar:     { move: "kimura", kind: "sub" },      // TODO: armbar propio
  sub_triangle:   { move: "triangulo", kind: "sub" },
  sub_guillotine: { move: "guillotina", kind: "sub" },
  sub_kimura:     { move: "kimura", kind: "sub" },
  sub_americana:  { move: "americana", kind: "sub" },
  sub_heel_hook:  { move: "kimura", kind: "sub" },      // TODO: heel hook propio
  /* utilidad */
  rest:           { move: "guardia-mma", kind: "hold" },
};

/** Duración del guion DUO_SEQ de cada movimiento (s). Espejo de los
    T definidos en duo.ts — se duplica aquí para que el traductor no
    dependa del render. */
const SEQ_T: Record<string, number> = {
  jab: 3.6, cross: 3.8, hook: 3.8, overhand: 4.6, circular: 4.4,
  "low-kick": 4.0, uppercut: 3.8, "gancho-cuerpo": 3.9, superman: 4.8,
  backfist: 4.4, codo: 3.6, "codo-giro": 4.4, "patada-cuerpo": 4.4,
  frontal: 4.2, lateral: 4.2, switch: 4.0, rodilla: 3.6,
  "rodilla-voladora": 4.8, derribo: 5.2, "single-leg": 5.0, suplex: 4.6, ippon: 4.4,
};

const HOLD_DUR = 2.6;       // posiciones y acciones continuas
const SUB_DUR = 4.2;        // sumisión mantenida (sufriendo la llave)
const KO_DUR = 4.2;         // caída y cuerpo en la lona
const REST_DUR = 1.6;

/** ¿El impacto ha entrado? (para elegir el resultado del guion) */
function landed(e: FightEvent): boolean {
  return e.hit === "clean" || e.hit === "counter" || e.hit === "graze" || !!e.knockdown;
}

/** Daño facial que deja cada calidad de impacto (0..1 acumulativo). */
const HIT_DMG: Record<MmamHit, number> = {
  miss: 0, blocked: 0.02, graze: 0.07, clean: 0.15, counter: 0.20,
};

/** Traduce el log de combate de MMAM a pasos de escena ejecutables. */
export function resolveReplay(events: FightEvent[]): ReplayStep[] {
  const steps: ReplayStep[] = [];
  const dmg: [number, number] = [0, 0];             // [player, opponent]
  const bleed: [boolean, boolean] = [false, false];
  for (const e of events) {
    const defIdx = e.attacker === "player" ? 1 : 0;  // quien RECIBE

    /* ── Final por KO/TKO: la escena la protagoniza el PERDEDOR
          cayendo a la lona (ko-plano) mientras el otro remata ── */
    if (e.finish && e.finish !== "submission" && !e.finish.startsWith("decision")) {
      dmg[defIdx] = 1;                               // KO: la cara lo cuenta todo
      steps.push({
        move: "ko-plano", outcome: 0,
        swap: e.attacker === "player",   // el que cae es el OTRO
        dur: KO_DUR, round: e.round, label: e.message, finish: e.finish,
        dmg: [dmg[0], dmg[1]], bleed: [bleed[0], bleed[1]],
      });
      continue;
    }

    const m = MAP[e.action] ?? { move: "guardia-mma", kind: "hold" as Kind };

    /* ── daño acumulado del defensor: golpes y ground & pound dejan
          marca; los derribos y cortes suman aparte ── */
    if ((m.kind === "strike" || e.action.startsWith("gnp")) && e.hit) {
      dmg[defIdx] = Math.min(1, dmg[defIdx] + (HIT_DMG[e.hit] ?? 0));
    }
    if (e.knockdown) dmg[defIdx] = Math.min(1, dmg[defIdx] + 0.12);
    if (e.flashKnockdown) dmg[defIdx] = Math.min(1, dmg[defIdx] + 0.06);
    if (e.bleeding) {
      bleed[defIdx] = true;
      dmg[defIdx] = Math.min(1, dmg[defIdx] + 0.04);
    }

    let outcome = 0;
    if (m.kind === "strike") outcome = landed(e) ? 1 : 0;          // 0 defiende · 1 le entra
    else if (m.kind === "takedown") outcome = landed(e) ? 0 : 1;  // 0 consuma · 1 defendido
    else if (m.kind === "defense") outcome = m.outcome ?? 0;

    /* quién mueve en escena: en defensas ataca el OTRO (este defiende) */
    const swap = m.kind === "defense" ? e.attacker === "player" : e.attacker === "opponent";

    let dur: number;
    if (m.kind === "sub") dur = e.finish === "submission" ? SUB_DUR + 0.8 : SUB_DUR;
    else if (e.action === "rest") dur = REST_DUR;
    else dur = SEQ_T[m.move] ?? HOLD_DUR;

    steps.push({
      move: m.move, outcome, swap, dur,
      round: e.round, label: e.message, finish: e.finish,
      dmg: [dmg[0], dmg[1]], bleed: [bleed[0], bleed[1]],
    });
  }
  return steps;
}
