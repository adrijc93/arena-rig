import { clamp01, clonePose, easeIn, easeOut, GUARD } from "./poseDriver";
import type { Pose } from "./poseDriver";

/* ════════════════════════════════════════════════════════════════
   Biblioteca de movimientos procedurales (compartida LUDUS / MMA)
   Cada función devuelve la Pose para un instante t (segundos).
   ════════════════════════════════════════════════════════════════ */

export type MoveId =
  | "guardia" | "caminar" | "tajo" | "estocada" | "mandoble"
  | "bloqueo" | "golpe" | "ko" | "provocar";

export const MOVES: { id: MoveId; label: string }[] = [
  { id: "guardia", label: "Guardia" },
  { id: "caminar", label: "Caminar" },
  { id: "tajo", label: "Tajo" },
  { id: "estocada", label: "Estocada" },
  { id: "mandoble", label: "Mandoble" },
  { id: "bloqueo", label: "Bloqueo" },
  { id: "golpe", label: "Recibir golpe" },
  { id: "ko", label: "KO" },
  { id: "provocar", label: "Provocar" },
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

  if (mode === "tajo") {
    const u = (t % 1.15) / 1.15;
    if (u < 0.6) {
      p.twist = 0.15 + easeIn(u / 0.6) * 0.8;
      p.uaR = [-0.9, 0, 0.7];
    } else {
      const s = easeOut((u - 0.6) / 0.4);
      p.twist = 0.95 - s * 1.5;
      p.uaR = [-0.9 + s * 0.3, 0, 0.7 - s * 1.1];
    }
    p.faR = -0.7;
    p.uaL = [-0.2, 0.1, 0]; p.faL = -0.6;
    p.lean = 0.06 + Math.sin(u * Math.PI) * 0.12;
    return p;
  }

  if (mode === "estocada") {
    const u = (t % 1.1) / 1.1;
    let arm: number;
    if (u < 0.55) { arm = -0.4 - easeIn(u / 0.55) * 0.4; p.faR = -1.4; }
    else { arm = -0.8 - easeOut((u - 0.55) / 0.45) * 0.9; p.faR = -0.15; }
    p.uaR = [arm, 0, 0.12];
    p.twist = 0.15 + (u > 0.55 ? 0.5 : 0);
    p.lean = 0.06 + Math.sin(u * Math.PI) * 0.2;
    p.uaL = [-0.2, 0.1, 0]; p.faL = -0.6;
    return p;
  }

  if (mode === "mandoble") {
    const u = (t % 1.25) / 1.25;
    let arm: number;
    if (u < 0.7) arm = -0.5 - easeIn(u / 0.7) * 2.1;
    else arm = -2.6 + easeOut((u - 0.7) / 0.3) * 3.1;
    p.uaR = [arm, 0, 0.12];
    p.faR = -0.4;
    p.lean = 0.06 + Math.sin(u * Math.PI) * 0.35;
    p.twist = 0.15 - Math.sin(u * Math.PI) * 0.35;
    p.uaL = [-0.2 - Math.sin(u * Math.PI) * 0.6, 0.1, 0];
    return p;
  }

  if (mode === "bloqueo") {
    const k = 0.9 + Math.sin(t * 2.4) * 0.1;
    p.uaL = [-1.15 * k, 0.55, 0]; p.faL = -1.7;
    p.uaR = [-0.35, 0, 0.15]; p.faR = -0.9;
    p.lean = 0.14; p.twist = 0.35;
    p.bob = -0.05;
    p.thL = -0.12; p.thR = 0.1; p.shL = 0.25; p.shR = 0.25;
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

  // provocar
  const k = Math.sin(clamp01((t % 2.2) / 1.6) * Math.PI);
  p.uaR = [-0.5 - k * 2.2, 0, 0.12]; p.faR = -0.4;
  p.uaL = [-0.4 - k * 1.6, 0, 0];
  p.headX = -0.25 * k;
  p.bob = k * 0.05;
  return p;
}
