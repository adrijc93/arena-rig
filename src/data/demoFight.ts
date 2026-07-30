/* Combate de DEMOSTRACIÓN con el formato exacto del log de MMAM
   (CombatLogEntry + ActionResult). Sirve para desarrollar el replay
   sin necesidad del juego completo. Cuando MMAM se conecte, su log
   se enchufa aquí tal cual. */

import type { FightEvent } from "../rig/replay";

export const DEMO_FIGHT: FightEvent[] = [
  /* ─── ASALTO 1: estudio, distancia y primer aviso ─── */
  { round: 1, attacker: "player", action: "jab", hit: "blocked",
    message: "El retador tantea con el jab. El campeón lo para con la palma." },
  { round: 1, attacker: "opponent", action: "jab", hit: "clean",
    message: "Le entra el jab al campeón. Primer aviso." },
  { round: 1, attacker: "player", action: "leg_kick", hit: "clean",
    message: "¡Dura low kick del retador a la pierna adelantada!" },
  { round: 1, attacker: "opponent", action: "cross", hit: "miss",
    message: "El directo del campeón besa el aire. Bien retirada." },
  { round: 1, attacker: "player", action: "takedown_double", hit: "blocked",
    message: "Entra al doble… ¡pero el campeón esparrama y defiende el derribo!" },
  { round: 1, attacker: "opponent", action: "hook", hit: "clean",
    message: "Gancho zurdo del campeón que sacude la cabeza del retador." },
  { round: 1, attacker: "player", action: "clinch_entry",
    message: "El retador cierra la distancia y busca el clinch." },
  { round: 1, attacker: "player", action: "clinch_knee", hit: "clean",
    message: "¡Rodillazo al hígado desde el clinch! Duele." },
  { round: 1, attacker: "opponent", action: "clinch_break",
    message: "El campeón se zafa y rompe el clinch." },
  { round: 1, attacker: "player", action: "rest",
    message: "🔔 Suena la campana. Final del primer asalto." },

  /* ─── ASALTO 2: el campeón derriba, el retador sobrevive ─── */
  { round: 2, attacker: "opponent", action: "takedown_single", hit: "clean",
    message: "¡Single leg del campeón y a la lona! El retador cae." },
  { round: 2, attacker: "opponent", action: "gnp_punch", hit: "clean", bleeding: true,
    message: "Ground and pound del campeón desde la guardia. ¡Sangra la ceja del retador!" },
  { round: 2, attacker: "player", action: "escape_improve",
    message: "El retador hace shrimp y recupera media guardia." },
  { round: 2, attacker: "player", action: "escape_standup",
    message: "¡Explota hacia arriba y se pone de pie! La grada ruge." },
  { round: 2, attacker: "player", action: "head_kick", hit: "blocked",
    message: "Patada alta del retador que choca con el bloqueo." },
  { round: 2, attacker: "opponent", action: "overhand", hit: "miss",
    message: "El campeón carga el overhand… ¡y falla por centímetros!" },
  { round: 2, attacker: "player", action: "overhand", hit: "clean", knockdown: true,
    message: "¡¡OVERHAND DEL RETADOR!! ¡KNOCKDOWN! ¡El campeón cae seco!" },
  { round: 2, attacker: "player", action: "gnp_elbow", hit: "clean", bleeding: true,
    message: "¡Codo que abre un corte en la frente del campeón! El árbitro se acerca…" },
  { round: 2, attacker: "player", action: "cross", hit: "clean",
    knockdown: true, finish: "ko",
    message: "¡¡SE ACABÓ!! ¡KO DEL RETADOR! ¡TENEMOS NUEVO CAMPEÓN! 🏆" },
];
