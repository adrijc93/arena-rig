/* ════════════════════════════════════════════════════════════════
   Fichas de modelos: añadir un modelo nuevo = añadir una ficha.
   ════════════════════════════════════════════════════════════════ */

export interface ModelFicha {
  id: string;
  label: string;
  file: string;                 // ruta en public/
  autor: string;                // crédito / licencia
  hide: string[];               // nodos a ocultar (armas opcionales, etc.)
  targetHeight: number;         // altura final en unidades de mundo
  rotationY: number;            // orientación en el laboratorio
  calibrateClip?: string;       // clip cuyo primer fotograma define la pose base (brazos abajo)
  clipSource?: string;          // fichero del que tomar los clips (mismo rig, otro archivo)
  clips: string[];              // clips mocap destacados para el lab
}

export const MODELS: ModelFicha[] = [
  {
    id: "quaternius-mannequin",
    label: "Maniquí Quaternius (rig universal)",
    file: "./models/AnimationLibrary_Godot_Standard.gltf",
    autor: "Quaternius · Universal Animation Library · CC0",
    hide: [],
    targetHeight: 1.85,
    rotationY: 0.5,
    calibrateClip: "Idle_Loop",
    clips: [
      "Idle_Loop", "Walk_Loop", "Jog_Fwd_Loop", "Sprint_Loop",
      "Punch_Jab", "Punch_Cross", "Punch_Enter",
      "Hit_Chest", "Hit_Head", "Death01",
      "Sword_Attack", "Sword_Idle",
      "Crouch_Idle_Loop", "Roll", "Dance_Loop",
    ],
  },
  {
    id: "quaternius-ual2",
    label: "Maniquí UAL2 (combos y escudos)",
    file: "./models/UAL2_Standard.glb",
    autor: "Quaternius · Universal Animation Library 2 · CC0",
    hide: [],
    targetHeight: 1.85,
    rotationY: 0.5,
    calibrateClip: "Idle_No_Loop",
    clips: [
      "Melee_Hook", "Melee_Hook_Rec", "Hit_Knockback",
      "Sword_Regular_A", "Sword_Regular_B", "Sword_Regular_C", "Sword_Regular_Combo", "Sword_Heavy_Combo",
      "Sword_Block", "Sword_Dash",
      "Idle_Shield_Loop", "Shield_Dash", "Shield_OneShot",
      "Slide_Start", "Slide_Loop", "LayToIdle", "ClimbUp_1m",
      "Zombie_Idle_Loop", "Zombie_Scratch",
    ],
  },
  {
    id: "quaternius-mannequin-f",
    label: "Maniquí femenino (cuerpo F)",
    file: "./models/Mannequin_F.glb",
    autor: "Quaternius · UAL2 Female Mannequin · CC0",
    hide: [],
    targetHeight: 1.8,
    rotationY: 0.5,
    clipSource: "./models/UAL2_Standard.glb",
    clips: [
      "Melee_Hook", "Melee_Hook_Rec", "Hit_Knockback",
      "Sword_Regular_Combo", "Sword_Heavy_Combo", "Sword_Block", "Sword_Dash",
      "Idle_Shield_Loop", "Shield_Dash", "Slide_Start", "LayToIdle",
    ],
  },
  {
    id: "kaykit-barbarian",
    label: "Barbarian (KayKit)",
    file: "./models/barbarian.glb",
    autor: "Kay Lousberg · KayKit Adventurers · CC0",
    hide: ["1H_Axe_Offhand", "Barbarian_Round_Shield", "2H_Axe", "Mug"],
    targetHeight: 1.85,
    rotationY: 0.5,
    clips: [
      "Idle", "Walking_A", "Running_A",
      "1H_Melee_Attack_Slice_Diagonal", "1H_Melee_Attack_Chop", "1H_Melee_Attack_Stab",
      "Block", "Block_Hit", "Hit_A", "Death_A", "Cheer",
    ],
  },
];
