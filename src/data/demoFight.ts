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
  { round: 1, attacker: "player", action: "hook", hit: "counter",
    message: "El campeón sale con el jab… ¡y se come el gancho de CONTRAGOLPE del retador!" },
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
  { round: 2, attacker: "opponent", action: "sub_kimura",
    message: "¡Intenta la kimura el campeón! El retador pelea las manos y sobrevive a la llave." },
  { round: 2, attacker: "player", action: "escape_improve",
    message: "El retador hace shrimp y recupera media guardia." },
  { round: 2, attacker: "player", action: "escape_standup",
    message: "¡Explota hacia arriba y se pone de pie! La grada ruge." },
  { round: 2, attacker: "player", action: "head_kick", hit: "blocked",
    message: "Patada alta del retador que choca con el bloqueo." },
  { round: 2, attacker: "player", action: "head_kick", hit: "graze", flashKnockdown: true,
    message: "¡LA SEGUNDA ROZA LA SIEN! ¡El campeón cae a una rodilla… y se levanta como puede! ¡FLASH KNOCKDOWN!" },
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

/* Segundo combate de demostración: final por SUMISIÓN (?replay=1&fight=sub).
   Muestra la otra rama del motor: llave defendida (resiste) y ¡TAP OUT! */
export const DEMO_FIGHT_SUB: FightEvent[] = [
  /* ─── ASALTO 1: el retador manda de pie, el campeón prueba suerte abajo ─── */
  { round: 1, attacker: "player", action: "jab", hit: "clean",
    message: "El retador marca la distancia con el jab desde el primer segundo." },
  { round: 1, attacker: "opponent", action: "body_kick", hit: "clean",
    message: "Patada al cuerpo del campeón que retumba en todo el pabellón." },
  { round: 1, attacker: "player", action: "takedown_single", hit: "clean",
    message: "¡Single leg del retador y a la lona! Buena defensa del campeón abajo." },
  { round: 1, attacker: "player", action: "gnp_punch", hit: "graze",
    message: "Lluvia de golpes cortos del retador desde la guardia." },
  { round: 1, attacker: "opponent", action: "sub_heel_hook",
    message: "¡El campeón caza la pierna y TUERCE EL TALÓN! ¡El retador escapa a duras penas!" },
  { round: 1, attacker: "player", action: "escape_standup",
    message: "El retador se quita de encima y vuelve a ponerse de pie." },
  { round: 1, attacker: "opponent", action: "rest",
    message: "🔔 Final del primer asalto. Igualdad total." },

  /* ─── ASALTO 2: la espalda y el mata león ─── */
  { round: 2, attacker: "opponent", action: "takedown_double", hit: "clean",
    message: "¡Doble pierna EXPLOSIVA del campeón! El retador al suelo." },
  { round: 2, attacker: "opponent", action: "advance_position",
    message: "El campeón pasa la guardia… ¡y se pega a la espalda con los ganchos!" },
  { round: 2, attacker: "opponent", action: "sub_rnc", finish: "submission",
    message: "¡MATA LEÓN! ¡El brazo bajo la barbilla! ¡TAP, TAP, TAP! ¡El campeón retiene por SUMISIÓN! 👑" },
];
