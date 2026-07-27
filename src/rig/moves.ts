import { clamp01, clonePose, easeOut, GUARD } from "./poseDriver";
import type { Pose } from "./poseDriver";

/* ════════════════════════════════════════════════════════════════
   MOVIMIENTOS COMUNES — locomoción, reacciones y gestos.
   Compartidos por LUDUS y MMA. Lo específico de combate vive en
   mmaMoves.ts (en pie / suelo).
   ════════════════════════════════════════════════════════════════ */

export type MoveId =
  | "guardia" | "caminar" | "correr"
  | "golpe" | "ko" | "provocar" | "celebracion";

export const MOVES: { id: MoveId; label: string }[] = [
  { id: "guardia", label: "Guardia" },
  { id: "caminar", label: "Caminar" },
  { id: "correr", label: "Correr" },
  { id: "golpe", label: "Recibir golpe" },
  { id: "ko", label: "KO" },
  { id: "provocar", label: "Provocar" },
  { id: "celebracion", label: "Celebración" },
];

export function poseFor(mode: MoveId, t: number): Pose {
  const p = clonePose(GUARD);

  if (mode === "guardia") {
    p.bob = Math.abs(Math.sin(t * 3.6)) * 0.02 + Math.sin(t * 1.8) * 0.012;
    p.headY = Math.sin(t * 0.9) * 0.12;
    return p;
  }

  if (mode === "caminar") {
    const ph = t * 9.5;
    const swL = Math.sin(ph), swR = Math.sin(ph + Math.PI);
    p.thL = swL * 0.55; p.thR = swR * 0.55;
    p.shL = Math.max(0, -swL) * 0.9 + 0.08;
    p.shR = Math.max(0, -swR) * 0.9 + 0.08;
    p.bob = Math.abs(Math.sin(ph)) * 0.055;
    p.hipsZ = Math.sin(ph) * 0.06;
    p.hipsY = Math.sin(ph) * 0.08;
    p.uaR = [-0.5 + swR * 0.3, 0, 0.12];
    p.uaL = [-0.4 + swL * 0.3, 0.4, 0];
    p.twist = 0;
    return p;
  }

  if (mode === "correr") {
    const ph = t * 13;                                // ciclo más rápido que caminar
    const swL = Math.sin(ph), swR = Math.sin(ph + Math.PI);
    p.thL = swL * 0.85; p.thR = swR * 0.85;
    p.shL = Math.max(0, -swL) * 1.5 + 0.25;           // el talón sube más atrás
    p.shR = Math.max(0, -swR) * 1.5 + 0.25;
    p.bob = Math.abs(Math.sin(ph)) * 0.09;            // fase aérea marcada
    p.hipsZ = Math.sin(ph) * 0.05;
    p.hipsY = Math.sin(ph) * 0.06;
    p.lean = 0.28;                                    // torso echado al frente
    p.uaR = [-0.6 + swR * 0.55, 0, 0.15]; p.faR = -1.4; // brazos bombean doblados
    p.uaL = [-0.5 + swL * 0.55, 0.3, 0]; p.faL = -1.5;
    p.twist = Math.sin(ph) * 0.08;
    return p;
  }

  if (mode === "golpe") {
    const u = (t % 0.9) / 0.9;
    const k = Math.sin(clamp01(u / 0.55) * Math.PI);
    p.lean = 0.06 - 0.3 * k;
    p.headX = 0.35 * k;
    p.bob = 0.02 * k;
    p.uaR = [-0.5 - 0.4 * k, 0, 0.3]; p.faR = -0.8;
    p.uaL = [-0.4 - 0.3 * k, 0.4, -0.2]; p.faL = -0.9;
    p.twist = 0.15 - 0.2 * k;
    return p;
  }

  if (mode === "ko") {
    const k = easeOut(clamp01((t % 3.2) / 0.8));
    p.hipsZ = -1.25 * k;
    p.bob = -0.62 * k;
    p.lean = 0.3 * k;
    p.headX = 0.35 * k;
    p.thL = -0.5 * k; p.shL = 0.9 * k;
    p.thR = -0.3 * k; p.shR = 0.7 * k;
    p.uaR = [-0.3, 0, 0.9 * k + 0.12]; p.faR = -0.3;
    p.uaL = [-0.3, 0, -0.9 * k]; p.faL = -0.3;
    return p;
  }

  if (mode === "celebracion") {
    const k = Math.abs(Math.sin(t * 4));
    p.bob = k * 0.12;
    p.uaR = [-2.7, 0, 0.25]; p.faR = -0.3;
    p.uaL = [-2.7, 0, -0.25]; p.faL = -0.3;
    p.lean = -0.1; p.headX = -0.25;
    p.twist = 0;
    return p;
  }

  // provocar
  const k = Math.sin(clamp01((t % 2.2) / 1.6) * Math.PI);
  p.uaR = [-0.5 - k * 2.2, 0, 0.12]; p.faR = -0.4;
  p.uaL = [-0.4 - k * 1.6, 0, 0];
  p.headX = -0.25 * k;
  p.bob = k * 0.05;
  return p;
}
