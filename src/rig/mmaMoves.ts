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
  | "parada" | "retirada" | "cobertura" | "bloqueo-alto" | "bloqueo-cuerpo" | "chequeo"
  | "jab" | "cross" | "hook" | "uppercut" | "overhand" | "gancho-cuerpo" | "superman" | "backfist"
  | "codo" | "codo-giro"
  | "low-kick" | "patada-cuerpo" | "circular" | "frontal" | "lateral" | "switch" | "rodilla" | "rodilla-voladora"
  | "clinch" | "sprawl" | "derribo"
  | "guardia-abajo" | "guardia-arriba" | "montada" | "ground-pound" | "sumision"
  | "ko-plano";

export type MmaSeccion = "pie" | "suelo";

export const MMA_MOVES: { id: MmaMoveId; label: string; seccion: MmaSeccion; grupo: string }[] = [
  // ─── EN PIE ───
  { id: "guardia-mma", label: "Guardia MMA", seccion: "pie", grupo: "Guardia" },
  { id: "esquiva", label: "Esquiva (slip)", seccion: "pie", grupo: "Guardia" },
  { id: "parada", label: "Parada (parry)", seccion: "pie", grupo: "Defensas" },
  { id: "retirada", label: "Retirada (pull)", seccion: "pie", grupo: "Defensas" },
  { id: "cobertura", label: "Cobertura (shell)", seccion: "pie", grupo: "Defensas" },
  { id: "bloqueo-alto", label: "Bloqueo patada alta", seccion: "pie", grupo: "Defensas" },
  { id: "bloqueo-cuerpo", label: "Bloqueo patada al cuerpo", seccion: "pie", grupo: "Defensas" },
  { id: "chequeo", label: "Chequeo de low kick", seccion: "pie", grupo: "Defensas" },
  { id: "jab", label: "Jab", seccion: "pie", grupo: "Puños" },
  { id: "cross", label: "Directo (cross)", seccion: "pie", grupo: "Puños" },
  { id: "hook", label: "Gancho (hook)", seccion: "pie", grupo: "Puños" },
  { id: "uppercut", label: "Uppercut", seccion: "pie", grupo: "Puños" },
  { id: "overhand", label: "Overhand", seccion: "pie", grupo: "Puños" },
  { id: "gancho-cuerpo", label: "Gancho al cuerpo", seccion: "pie", grupo: "Puños" },
  { id: "superman", label: "Superman punch", seccion: "pie", grupo: "Puños" },
  { id: "backfist", label: "Backfist giratorio", seccion: "pie", grupo: "Puños" },
  { id: "codo", label: "Codo horizontal", seccion: "pie", grupo: "Codos" },
  { id: "codo-giro", label: "Codo giratorio", seccion: "pie", grupo: "Codos" },
  { id: "low-kick", label: "Low kick", seccion: "pie", grupo: "Patadas" },
  { id: "patada-cuerpo", label: "Circular al cuerpo", seccion: "pie", grupo: "Patadas" },
  { id: "circular", label: "Circular alta", seccion: "pie", grupo: "Patadas" },
  { id: "frontal", label: "Frontal (teep)", seccion: "pie", grupo: "Patadas" },
  { id: "lateral", label: "Lateral (side kick)", seccion: "pie", grupo: "Patadas" },
  { id: "switch", label: "Switch kick", seccion: "pie", grupo: "Patadas" },
  { id: "rodilla", label: "Rodillazo", seccion: "pie", grupo: "Patadas" },
  { id: "rodilla-voladora", label: "Rodilla voladora", seccion: "pie", grupo: "Patadas" },
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

    /* ───────────── DEFENSAS ───────────── */
    case "parada": {
      // parry con la DERECHA contra el jab rival: toque corto adelante-abajo
      // que desvía el golpe justo antes de que llegue; la cabeza sale de la
      // línea y el cuerpo queda listo para el contragolpe
      const u = cyc(t, 1.2);
      const k = u < 0.2 ? easeOut(u / 0.2) : u < 0.4 ? 1 : 1 - easeIn((u - 0.4) / 0.6);
      p.uaR = [-1.0 - k * 0.35, 0, 0.3 + k * 0.05];
      p.faR = -2.0 + k * 1.3;                       // la mano sale a tocar el golpe
      p.twist = 0.35 - k * 0.15;                    // se aparta ligeramente
      p.headY = -k * 0.2;
      p.bob = -k * 0.02;
      return p;
    }

    case "retirada": {
      // pull counter: la cabeza y el pecho se echan ATRÁS fuera de la línea
      // del golpe, el peso cae sobre la pierna trasera — y vuelve al instante
      const u = cyc(t, 1.2);
      const k = u < 0.25 ? easeOut(u / 0.25) : u < 0.45 ? 1 : 1 - easeIn((u - 0.45) / 0.55);
      p.lean = 0.1 - k * 0.3;                       // torso atrás
      p.headX = 0.08 - k * 0.18;                    // la cabeza se quita del camino
      p.hipsX = -k * 0.08;
      p.bob = -k * 0.04;
      p.shR = 0.3 + k * 0.15;                       // carga la pierna trasera
      return p;
    }

    case "cobertura": {
      // shell: guantes PEGADOS a las sienes, codos cerrados al cuerpo, bajo
      // la lluvia de golpes — compacto, aguantando, con pequeñas sacudidas
      const flinch = Math.max(0, Math.sin(t * 4.5));
      p.uaR = [-1.2, -0.15, 0.0]; p.faR = -2.4;     // antebrazos verticales sellando la cara
      p.uaL = [-1.2, 0.15, 0.0]; p.faL = -2.4;
      p.bob = -0.05 - flinch * 0.03;
      p.shL = 0.4; p.shR = 0.35;                    // base cargada
      p.lean = 0.15 + flinch * 0.05;
      p.headX = 0.15;                               // mentón abajo
      return p;
    }

    case "bloqueo-alto": {
      // bloqueo de la circular alta: el antebrazo DERECHO sube vertical junto
      // a la sien (el "escudo"), el cuerpo se compacta y el impacto lo empuja
      const u = cyc(t, 1.4);
      const k = u < 0.25 ? easeOut(u / 0.25) : 1 - easeIn((u - 0.25) / 0.75);
      const hit = u > 0.3 && u < 0.45 ? Math.sin((u - 0.3) / 0.15 * Math.PI) : 0; // sacudida
      p.uaR = [-1.45 - k * 0.05, -0.35, -0.1]; p.faR = -2.5; // antebrazo vertical en la sien
      p.bob = -k * 0.04 - hit * 0.02;
      p.tx = -hit * 0.05;                           // el impacto lo desplaza de lado
      p.hipsZ = -hit * 0.15;
      p.lean = 0.1 + k * 0.05;
      p.twist = 0.35 - k * 0.1;                     // se compacta detrás del escudo
      p.headX = 0.1;
      return p;
    }

    case "bloqueo-cuerpo": {
      // bloqueo de la patada al cuerpo: el codo DERECHO baja pegado a las
      // costillas y el antebrazo cubre el costado; recibe girando hacia la patada
      const u = cyc(t, 1.4);
      const k = u < 0.25 ? easeOut(u / 0.25) : 1 - easeIn((u - 0.25) / 0.75);
      const hit = u > 0.3 && u < 0.45 ? Math.sin((u - 0.3) / 0.15 * Math.PI) : 0;
      p.uaR = [-0.45 - k * 0.15, 0, 0.35];          // brazo bajo, codo pegado al cuerpo
      p.faR = -1.1;                                 // antebrazo cubre el costado
      p.twist = 0.35 + k * 0.15;                    // se gira un pelín hacia la patada
      p.bob = -k * 0.03 - hit * 0.02;
      p.hipsZ = hit * 0.1;
      p.lean = 0.1 + k * 0.08;
      return p;
    }

    case "chequeo": {
      // check de la low kick: la espinilla ADELANTADA sube como escudo
      // (rodilla alta, punta del pie abajo, recibiendo con el peroné) y las
      // caderas giran hacia la patada; las manos no bajan de la guardia
      const u = cyc(t, 1.4);
      const k = u < 0.22 ? easeOut(u / 0.22) : u < 0.5 ? 1 : 1 - easeIn((u - 0.5) / 0.5);
      const hit = u > 0.28 && u < 0.42 ? Math.sin((u - 0.28) / 0.14 * Math.PI) : 0;
      p.thL = -0.22 - k * 1.0;                      // rodilla izquierda sube
      p.thLY = k * 0.25;                            // apunta fuera: recibe con el peroné
      p.shL = 0.35 + k * 1.5;                       // espinilla recogida = escudo
      p.bob = -k * 0.03 + hit * 0.02;
      p.hipsY = -k * 0.2;                           // gira hacia la patada
      p.twist = 0.35 - k * 0.15;
      p.uaL = [-1.1 - k * 0.15, -0.2, -0.05];       // manos firmes en guardia
      p.thR = 0.18; p.shR = 0.35 + k * 0.05;        // apoyo cargado
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
      // MISMO timing que el uppercut: carga en el primer 30% del ciclo,
      // golpe en 0.30–0.55, vuelta hasta el final (periodo 1.2s)
      const u = cyc(t, 1.2);
      // carga: el brazo abre fuera Y EL CUERPO SE ENROSCA ATRÁS…
      // ¡y TAMBIÉN decae!: si no, el ciclo acaba con el brazo abierto
      const load = u < 0.3 ? easeIn(u / 0.3) : u < 0.55 ? 1 : u < 0.9 ? 1 - easeIn((u - 0.55) / 0.35) : 0;
      // golpe: el barrido del brazo y el giro del cuerpo hacia adelante
      // ocurren A LA VEZ (0.30–0.55), pausa corta y vuelta
      const s = u < 0.3 ? 0 : u < 0.55 ? easeOut((u - 0.3) / 0.25) : u < 0.62 ? 1 : u < 0.95 ? 1 - easeIn((u - 0.62) / 0.33) : 0;
      // follow-through: tras el contacto el puño SIGUE cruzado hacia el lado
      // contrario (0.55–0.75), acompañando el giro del cuerpo; luego vuelve
      const carry = u < 0.55 ? 0 : u < 0.75 ? easeOut((u - 0.55) / 0.2) : u < 0.95 ? 1 - easeIn((u - 0.75) / 0.2) : 0;
      // LIMITACIÓN DEL RIG (verificada con sonda en ejecución): el codo
      // flexiona SIEMPRE en el plano sagital del personaje (FA = Rx(fa)·UA).
      // Para que el quiebro brazo-antebrazo sea EN HORIZONTAL hacia dentro
      // (y no cayendo hacia abajo): el BRAZO baja en diagonal hacia dentro
      // y el codo "recoge" el antebrazo hasta la horizontal. El fa exacto
      // que deja el antebrazo horizontal se calcula del propio brazo:
      // fa = π/2 − atan2(z, y) de la dirección del brazo — así el antebrazo
      // queda horizontal DURANTE TODO el golpe, barriendo fuera → centro →
      // lado contrario, con ~25–45° de quiebro visible en el codo.
      p.uaL = [
        -1.1 + load * 0.5 - s * 0.15 - carry * 0.05,  // guardia → carga → diagonal abajo-dentro
        -0.2 + load * 0.2,                            // el brazo pasa por el frente
        -0.05 + load * 0.95 - s * 1.65 - carry * 0.25, // codo fuera → cruza DENTRO → lado contrario
      ];
      // dirección del brazo (euler XYZ aplicado a (0,-1,0)) → fa que lo
      // deja horizontal; se funde con el codo de guardia según "bend"
      const sz = Math.sin(p.uaL[2]), cz = Math.cos(p.uaL[2]);
      const sy = Math.sin(p.uaL[1]);
      const sx = Math.sin(p.uaL[0]), cx = Math.cos(p.uaL[0]);
      const vy = -cz, vz0 = -sz * sy;
      const dy = vy * cx - vz0 * sx, dz = vy * sx + vz0 * cx;
      const faH = Math.max(-2.2, Math.min(0.3, Math.PI / 2 - Math.atan2(dz, dy)));
      const bend = Math.min(1, s * 3);
      p.faL = -2.05 * (1 - bend) + faH * bend;
      // enrosca ATRÁS en la carga → desenrosca ADELANTE golpeando, y el
      // follow-through añade un poco más de giro: el cuerpo acompaña al puño
      p.twist = 0.35 + load * 0.35 - s * 1.05 - carry * 0.2;
      p.hipsY = load * 0.05 - s * 0.28 - carry * 0.05;
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
      p.uaR = [-1.0 + dip * 0.5 - up * 0.95, 0, 0.25];
      // el codo abre más en el impacto: el puño llega MÁS LEJOS del cuerpo
      // (~0.48 delante del hombro, como el hook) en lugar de subir pegado
      p.faR = -2.0 + up * 0.8;
      // como en el cross: cadera y hombro derecho impulsan hacia arriba/adelante
      p.twist = 0.35 + up * 0.4;
      p.hipsY = up * 0.12;
      return p;
    }

    case "overhand": {
      // bucle por ENCIMA de la guardia rival: entre cross y hook. Carga con
      // el codo fuera y alto, y el puño cae en ARCO mientras el hombro
      // derecho atraviesa. La izquierda no baja: protege del contragolpe.
      const u = cyc(t, 1.3);
      const load = u < 0.3 ? easeIn(u / 0.3) : u < 0.55 ? 1 : u < 0.9 ? 1 - easeIn((u - 0.55) / 0.35) : 0;
      const s = u < 0.3 ? 0 : u < 0.55 ? easeOut((u - 0.3) / 0.25) : u < 0.65 ? 1 : u < 0.95 ? 1 - easeIn((u - 0.65) / 0.3) : 0;
      p.uaR = [
        -1.0 + load * 0.35 - s * 0.75,   // sube cargando → cae ADELANTE (menos extendido que el cross)
        0,
        0.3 - load * 0.75 + s * 0.7,     // codo FUERA y alto en la carga (el arco) → cruza al frente al caer
      ];
      p.faR = -2.0 + load * 0.15 + s * 1.25; // medio doblado en el arco → casi extiende al caer
      p.twist = 0.35 - load * 0.3 + s * 0.95; // enrosca atrás → hombro derecho atraviesa fuerte
      p.hipsY = -load * 0.05 + s * 0.3;
      p.lean = 0.1 + s * 0.18;             // se echa ENCIMA del golpe
      p.bob = -load * 0.04 + s * 0.02;
      p.uaL = [-1.1, -0.2, -0.05]; p.faL = -2.05; // la otra protege la cara
      return p;
    }

    case "gancho-cuerpo": {
      // hook IZQUIERDO al hígado: cambio de nivel doblando RODILLAS (espalda
      // inclinada pero recta, ¡no se dobla la cintura!) y el antebrazo entra
      // HORIZONTAL al cuerpo con giro corto de cadera. Mismo quiebro de codo
      // dinámico que el hook: antebrazo horizontal durante todo el golpe.
      const u = cyc(t, 1.3);
      const load = u < 0.3 ? easeIn(u / 0.3) : u < 0.55 ? 1 : u < 0.9 ? 1 - easeIn((u - 0.55) / 0.35) : 0;
      const s = u < 0.3 ? 0 : u < 0.55 ? easeOut((u - 0.3) / 0.25) : u < 0.62 ? 1 : u < 0.95 ? 1 - easeIn((u - 0.62) / 0.33) : 0;
      const lvl = Math.max(load, s);                     // el nivel bajo se mantiene en todo el golpe
      p.bob = -lvl * 0.14;                               // baja el centro de gravedad
      p.shL = 0.35 + lvl * 0.25; p.shR = 0.3 + lvl * 0.25; // con las rodillas, NO con la espalda
      p.lean = 0.1 + lvl * 0.12;
      p.uaL = [
        -0.55 + load * 0.1 - s * 0.1,    // brazo BAJO, apuntando al tronco rival
        -0.2 + load * 0.15,
        -0.05 + load * 0.6 - s * 1.15,   // codo fuera → cruza dentro al cuerpo
      ];
      // fa dinámico que deja el antebrazo horizontal (misma técnica que el hook)
      const szb = Math.sin(p.uaL[2]), czb = Math.cos(p.uaL[2]);
      const syb = Math.sin(p.uaL[1]);
      const sxb = Math.sin(p.uaL[0]), cxb = Math.cos(p.uaL[0]);
      const vyb = -czb, vz0b = -szb * syb;
      const dyb = vyb * cxb - vz0b * sxb, dzb = vyb * sxb + vz0b * cxb;
      const faHb = Math.max(-2.2, Math.min(0.3, Math.PI / 2 - Math.atan2(dzb, dyb)));
      const bend = Math.min(1, s * 3);
      p.faL = -1.9 * (1 - bend) + faHb * bend;
      p.twist = 0.35 + load * 0.2 - s * 0.75;            // giro corto y bajo
      p.hipsY = load * 0.05 - s * 0.3;
      p.uaR = [-1.0, 0, 0.3]; p.faR = -2.0;              // la derecha protege la cara
      return p;
    }

    case "superman": {
      // superman punch: finta de patada derecha (el rival baja la guardia),
      // la pierna patea ATRÁS mientras el cuerpo SALTA ADELANTE y el puño
      // derecho cruza por encima. Momento de vuelo: los dos pies en el aire.
      const u = cyc(t, 1.5);
      const faint = u < 0.3 ? easeOut(u / 0.3) : u < 0.45 ? 1 - easeIn((u - 0.3) / 0.15) : 0; // rodilla sube (finta)
      const fly = u < 0.3 ? 0 : u < 0.55 ? easeOut((u - 0.3) / 0.25) : u < 0.7 ? 1 : 1 - easeIn((u - 0.7) / 0.3);
      p.thR = 0.18 - faint * 1.3 + fly * 0.9;    // rodilla arriba → patea ATRÁS en el vuelo
      p.shR = 0.3 + faint * 0.7 + fly * 0.3;
      p.thL = -0.22 + fly * 0.15; p.shL = 0.35 + faint * 0.1; // la de apoyo impulsa y despega
      p.bob = -faint * 0.05 + fly * 0.18;        // despega
      p.tz = fly * 0.3;                          // el cuerpo vuela ADELANTE
      p.uaR = [-1.0 + faint * 0.1 - fly * 0.6, 0, 0.3 - fly * 0.25]; // el puño cruza
      p.faR = -2.0 + fly * 1.9;
      p.twist = 0.35 - faint * 0.15 + fly * 0.75;
      p.hipsY = fly * 0.2;
      p.lean = 0.1 + fly * 0.2;
      p.uaL = [-1.1, -0.2, -0.05]; p.faL = -2.05; // la otra alta: expuesto pero protegido
      return p;
    }

    case "backfist": {
      // spinning backfist IZQUIERDO: giro relámpago hacia atrás (se esconde
      // el golpe) y el brazo se DESENROLLA como un látigo cruzando el frente,
      // golpeando con el dorso del puño. Si falla, queda vendido: vuelve rápido.
      const u = cyc(t, 1.4);
      const wind = u < 0.25 ? easeIn(u / 0.25) : u < 0.5 ? 1 : 1 - easeIn((u - 0.5) / 0.5); // giro atrás (se mantiene en el barrido)
      const spin = u < 0.25 ? 0 : u < 0.5 ? easeOut((u - 0.25) / 0.25) : 1 - easeIn((u - 0.5) / 0.5); // desenrolla
      p.twist = 0.35 + wind * 0.45 - spin * 1.5;   // atrás → hombro IZQUIERDO barre adelante
      p.hipsY = wind * 0.1 - spin * 0.55;
      p.uaL = [
        -1.1 + wind * 0.25 - spin * 0.65,          // desenrolla HORIZONTAL a la altura de la cabeza
        -0.2,
        -0.05 + wind * 0.5 - spin * 1.1,           // recogido → barre cruzando al frente
      ];
      p.faL = -2.05 + spin * 1.95;                 // se desenrolla casi extendido
      p.lean = 0.1 + spin * 0.05;
      p.bob = -wind * 0.04;
      p.uaR = [-1.0, 0, 0.3]; p.faR = -2.0;        // la derecha protege la cara
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

    case "codo-giro": {
      // codo giratorio DERECHO: el mismo giro escondido del backfist pero con
      // el brazo PEGADO — es el codo lo que barre hasta la cara. Corta distancia.
      const u = cyc(t, 1.3);
      const wind = u < 0.25 ? easeIn(u / 0.25) : 0;      // giro atrás (esconde)
      const spin = u < 0.25 ? 0 : u < 0.5 ? easeOut((u - 0.25) / 0.25) : 1 - easeIn((u - 0.5) / 0.5); // barre
      p.twist = 0.35 - wind * 0.3 + spin * 1.3;          // atrás → hombro DERECHO barre adelante
      p.hipsY = -wind * 0.08 + spin * 0.5;
      p.uaR = [-1.35 + wind * 0.2 - spin * 0.15, -0.5, 0.1 + spin * 0.4]; // codo alto apuntando al rival
      p.faR = -2.45;                                     // puño pegado: pega el codo
      p.lean = 0.1 + spin * 0.08;
      p.bob = -wind * 0.04 + spin * 0.03;
      p.uaL = [-1.1, -0.2, -0.05]; p.faL = -2.05;        // la otra protege
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
      p.twist = 0.35 - step * 0.15 - whip * 0.25;      // hombros: cargan atrás y luego ACOMPAÑAN
                                                       // el giro CON RETRASO (la cadera lidera) —
                                                       // el pecho nunca gira en sentido contrario
      p.lean = 0.1 - whip * 0.3;                       // se echa atrás al patear
      p.hipsZ = whip * 0.18;                           // cae hacia el lado de apoyo
      p.ankL = [0, whip * 0.6, 0];                     // ¡pivote del pie de apoyo!
      // brazos: el del lado que patea barre atrás-abajo por FUERA de la cadera
      // (z NEGATIVA = hacia fuera); la contraria hace long guard HORIZONTAL
      // y extendida a la altura del hombro, ligeramente abierta
      p.uaR = [-1.0 + whip * 1.1, 0, 0.3 - whip * 0.5];
      p.faR = -2.0 + whip * 1.4;
      p.uaL = [-1.1 - whip * 0.45, -0.2 + whip * 0.1, -0.05 + whip * 0.3];
      p.faL = -2.05 + whip * 1.75;
      p.thL = -0.22; p.shL = 0.4;
      return p;
    }

    case "patada-cuerpo": {
      // roundhouse al CUERPO (hígado/costillas): misma cadena cinética que la
      // low kick corregida (cadera lidera, hombros acompañan con retraso) pero
      // la espinilla llega ALTA, envolviendo el costado.
      const u = cyc(t, 1.6);
      const step = u < 0.3 ? easeOut(u / 0.3) : 1;
      const whip = u < 0.3 ? 0 : u < 0.5 ? easeOut((u - 0.3) / 0.2) : 1 - easeIn((u - 0.5) / 0.5);
      p.tx = step * 0.05;
      p.bob = -step * 0.02 - whip * 0.02;
      p.thR = 0.18 - whip * 1.55;                      // llega al cuerpo (más alta que la low)
      p.thRY = whip * 0.15;                            // abre un poco: envuelve el costado
      p.shR = 0.55 - whip * 0.5;
      p.hipsY = whip * 0.55;                           // la cadera DERECHA atraviesa
      p.twist = 0.35 - step * 0.15 - whip * 0.25;      // hombros acompañan CON RETRASO
      p.lean = 0.1 - whip * 0.25;
      p.hipsZ = whip * 0.12;
      p.ankL = [0, whip * 0.6, 0];                     // pivote del pie de apoyo
      // mismo esquema de brazos que la low kick: barre fuera + long guard tensa
      p.uaR = [-1.0 + whip * 1.1, 0, 0.3 - whip * 0.5];
      p.faR = -2.0 + whip * 1.4;
      p.uaL = [-1.1 - whip * 0.45, -0.2 + whip * 0.1, -0.05 + whip * 0.3];
      p.faL = -2.05 + whip * 1.75;
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
      p.hipsY = Math.max(0, k) * 0.55;                 // cadera derecha atraviesa
      p.twist = 0.35 - Math.abs(k) * 0.4;              // hombros: cargan atrás y ACOMPAÑAN
                                                       // con retraso (la cadera lidera), como la low kick
      p.lean = 0.1 - Math.max(0, k) * 0.4;
      // brazos como la low kick: el derecho barre atrás por FUERA, la
      // izquierda hace long guard horizontal (antes quedaban abrazados al pecho)
      const kk = Math.max(0, k);
      p.uaR = [-1.0 + kk * 1.1, 0, 0.3 - kk * 0.5]; p.faR = -2.0 + kk * 1.4;
      p.uaL = [-1.1 - kk * 0.45, -0.2 + kk * 0.1, -0.05 + kk * 0.3]; p.faL = -2.05 + kk * 1.75;
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
      p.uaR = [-1.0 + push * 1.1, 0, 0.3 - push * 0.5];  // brazo del lado de la pierna atrás por FUERA
      p.faR = -2.0 + push * 1.4;
      p.uaL = [-1.1 - push * 0.15, -0.2, -0.05];         // la contraria arriba protege
      p.faL = -2.05;
      return p;
    }

    case "lateral": {
      // side kick: cuerpo de perfil, rodilla al pecho DE LADO y extensión
      // empujando con el TALÓN a través del objetivo; el cuerpo se echa atrás
      // (cuanta más extensión, más inclinación). Poder de empuje, no de látigo.
      const u = cyc(t, 1.5);
      const ch = u < 0.35 ? easeOut(u / 0.35) : u < 0.55 ? 1 : 1 - easeIn((u - 0.55) / 0.45); // cámara
      const ext = u < 0.35 ? 0 : u < 0.55 ? easeOut((u - 0.35) / 0.2) : u < 0.7 ? 1 : 1 - easeIn((u - 0.7) / 0.3); // extensión
      p.thR = 0.18 - ch * 1.1 - ext * 0.5;             // rodilla alta → pierna casi HORIZONTAL al extender
      p.thRY = -ch * 0.5 + ext * 0.3;                  // de lado en la cámara → alinea al extender
      p.shR = 0.3 + ch * 1.4 - ext * 1.65;             // cámara MUY recogida → extensión total (contraste)
      p.hipsY = ch * 0.5;                              // cadera de perfil
      p.twist = 0.35 + ch * 0.2 - ext * 0.1;           // pecho de perfil que acompaña
      p.lean = 0.1 - ext * 0.35;                       // se echa atrás al extender
      p.hipsZ = ch * 0.1;
      p.bob = -ch * 0.03 + ext * 0.02;
      p.uaR = [-1.0 + ext * 1.1, 0, 0.3 - ext * 0.5];  // brazo derecho cae atrás por FUERA (equilibrio)
      p.faR = -2.0 + ext * 1.4;
      p.uaL = [-1.1, -0.2, -0.05]; p.faL = -2.05;      // la otra protege
      p.thL = -0.22; p.shL = 0.35;
      return p;
    }

    case "switch": {
      // switch kick: las piernas intercambian el puesto en un saltito y la
      // IZQUIERDA (que era la delantera) patea AL CUERPO como trasera. Rápido
      // y engañoso: el rival ve el cambio tarde. Cadera izquierda atraviesa,
      // hombros acompañan con retraso (mismo patrón corregido).
      const u = cyc(t, 1.4);
      const sw = u < 0.25 ? easeOut(u / 0.25) : 1;               // el switch de pies
      const kick = u < 0.25 ? 0 : u < 0.5 ? easeOut((u - 0.25) / 0.25) : 1 - easeIn((u - 0.5) / 0.5);
      p.bob = sw * 0.05 - kick * 0.02;                    // pequeño salto en el cambio
      p.thL = -0.22 + sw * 0.4 - kick * 1.7;              // izquierda: va atrás → PATADA alta
      p.thR = 0.18 - sw * 0.4;                            // derecha: pasa a ser la delantera (apoyo)
      p.shL = 0.35 + sw * 0.2 - kick * 0.25;              // recoge → extiende al impacto
      p.shR = 0.3 + sw * 0.15;
      p.hipsY = -kick * 0.45;                             // cadera IZQUIERDA atraviesa
      p.twist = 0.35 + sw * 0.1 - kick * 0.4;             // hombros acompañan CON RETRASO
      p.lean = 0.1 - kick * 0.2;
      p.hipsZ = -kick * 0.1;
      p.ankR = [0, -kick * 0.5, 0];                       // pivota el nuevo pie de apoyo
      // espejo de la low kick: el izquierdo barre atrás por FUERA (z positiva
      // = hacia fuera para el brazo izquierdo) y la derecha hace long guard
      p.uaL = [-1.1 + kick * 1.1, -0.2, -0.05 + kick * 0.35];
      p.faL = -2.05 + kick * 1.45;
      p.uaR = [-1.0 - kick * 0.5, 0, 0.3 - kick * 0.15];
      p.faR = -2.0 + kick * 1.7;
      return p;
    }

    case "rodilla": {
      const u = cyc(t, 1.2);
      const k = u < 0.35 ? easeOut(u / 0.35) : 1 - easeIn((u - 0.35) / 0.65);
      p.thR = 0.18 - k * 1.55;
      p.shR = 0.3 + k * 1.7;                             // pierna recogida fuerte
      p.bob = k * 0.12;                                  // salto al impacto
      p.lean = 0.1 + k * 0.15;
      // los brazos TIRAN hacia abajo del "cuello": los guantes acaban delante
      // del esternón con el codo doblado, no colgando a los lados
      p.uaR = [-1.0 + k * 0.15, 0, 0.3 - k * 0.1]; p.faR = -2.0 + k * 0.5;
      p.uaL = [-1.1 + k * 0.15, -0.2, -0.05 + k * 0.1]; p.faL = -2.05 + k * 0.55;
      return p;
    }

    case "rodilla-voladora": {
      // flying knee: carga con paso de impulso → SALTO ADELANTE con la rodilla
      // derecha subiendo en punta, la cadera empujando a través y los brazos
      // tirando hacia atrás (como si arrastraran el cuello del rival).
      const u = cyc(t, 1.6);
      const run = u < 0.3 ? easeIn(u / 0.3) : 1;                   // impulso (carga abajo)
      const fly = u < 0.3 ? 0 : u < 0.55 ? easeOut((u - 0.3) / 0.25) : u < 0.7 ? 1 : 1 - easeIn((u - 0.7) / 0.3);
      p.bob = -run * 0.08 + fly * 0.3;                     // carga abajo → despega ALTO
      p.tz = fly * 0.35;                                   // vuela hacia el objetivo
      p.thR = 0.18 - fly * 1.75;                           // rodilla al pecho y más
      p.thRY = fly * 0.25;                                 // apunta al centro: sobresale del torso
      p.shR = 0.3 + fly * 1.95;                            // pierna recogida a tope
      p.thL = -0.22 + fly * 0.5;                           // la de apoyo queda atrás en el aire
      p.shL = 0.35 + fly * 0.4;
      p.lean = 0.1 - fly * 0.05;                           // torso erguido, la cadera empuja al frente
      p.hipsY = fly * 0.15;
      p.uaR = [-1.0 + fly * 1.3, 0, 0.3 - fly * 0.5]; p.faR = -2.0 + fly * 0.9; // tira atrás-abajo por FUERA
      p.uaL = [-1.1 + fly * 0.6, -0.2, -0.05]; p.faL = -2.05; // la otra queda alta
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
