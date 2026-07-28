/* ════════════════════════════════════════════════════════════════
   Personajes: todos son PIELES de la marioneta voxel.
   Añadir un personaje nuevo = añadir una ficha con su PuppetSpec.
   ════════════════════════════════════════════════════════════════ */

import type { PuppetSpec } from "./voxelPuppet";

export interface ModelFicha {
  id: string;
  label: string;
  autor: string;
  targetHeight: number;         // altura final en unidades de mundo
  rotationY: number;            // orientación en el laboratorio
  spec?: PuppetSpec;            // "piel" (colores, piezas, accesorios); vacío = muñeco base
}

export const MODELS: ModelFicha[] = [
  {
    id: "voxel",
    label: "Muñeco Voxel 🧱 (base)",
    autor: "Arena Rig — marioneta propia de 15 piezas",
    targetHeight: 1.7,
    rotationY: 0,
  },
  {
    id: "voxel-ludus",
    label: "Gladiador LUDUS ⚔",
    autor: "Arena Rig — piel LUDUS sobre marioneta voxel",
    targetHeight: 1.7,
    rotationY: 0,
    spec: {
      skin: 0xc9995f,          // piel tostada de arena
      torso: 0x6e5133,         // subarmalis (prenda acolchada bajo el peto)
      sleeves: 0xc9995f,       // brazos desnudos
      pants: 0x5b4a2f,
      feet: 0x3a3128,          // sandalias
      helmet: 0xa8893f,        // bronce
      chestPlate: 0xb5964a,
      shoulderPads: 0xa8893f,
      skirt: 0x74562f,         // cuero
    },
  },
  {
    id: "voxel-mma",
    label: "Luchador MMA 🥊",
    autor: "Arena Rig — piel MMA sobre marioneta voxel",
    targetHeight: 1.7,
    rotationY: 0,
    spec: {
      torso: 0xd9b98f,         // torso desnudo
      sleeves: 0xd9b98f,
      pants: 0xb02a2a,         // shorts rojos
      feet: 0xd9b98f,          // descalzo
      gloves: 0x27324a,        // guantes azul noche
    },
  },
];
