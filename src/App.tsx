import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { applyPose, clonePose, findRig, GUARD, lerpPose, rotBone } from "./rig/poseDriver";
import { resolvePoseCollisions } from "./rig/collision";
import type { Pose, Rig } from "./rig/poseDriver";
import { MOVES, poseFor } from "./rig/moves";
import type { MoveId } from "./rig/moves";
import { MMA_MOVES, mmaPoseFor } from "./rig/mmaMoves";
import { MODELS } from "./rig/manifest";
import { applyFaceDamage, buildVoxelPuppet, FACE_PRESETS } from "./rig/voxelPuppet";
import type { FaceSpec, PuppetSpec } from "./rig/voxelPuppet";
import { DUO, DUO_DEFAULT, DUO_SEQ, duoBeatAt } from "./rig/duo";
import { DEMO_FIGHT, DEMO_FIGHT_SUB } from "./data/demoFight";
import { DEMO_MMAM_REAL } from "./data/mmamRealDemo";
import { mmamLogToFight } from "./rig/mmamAdapter";
import { resolveReplay } from "./rig/replay";
import type { ReplayStep } from "./rig/replay";

/* Puntería: qué brazos golpean y a qué altura apuntan (cabeza o cuerpo).
   Se aplica en modo duelo a quien ATACA (tú o el rival según el movimiento).
   ground & pound: los DOS brazos apuntan a la cara del que está abajo. */
const AIM: Record<string, { side: "L" | "R"; lvl: "head" | "body" }[]> = {
  jab: [{ side: "L", lvl: "head" }],
  hook: [{ side: "L", lvl: "head" }],
  backfist: [{ side: "L", lvl: "head" }],
  "gancho-cuerpo": [{ side: "L", lvl: "body" }],
  cross: [{ side: "R", lvl: "head" }],
  uppercut: [{ side: "R", lvl: "head" }],
  overhand: [{ side: "R", lvl: "head" }],
  superman: [{ side: "R", lvl: "head" }],
  codo: [{ side: "R", lvl: "head" }],
  "codo-giro": [{ side: "R", lvl: "head" }],
  "ground-pound": [{ side: "L", lvl: "head" }, { side: "R", lvl: "head" }],
};

/* Posiciones de suelo: para colocar la escena dinámicamente durante
   las secuencias (el derribo empieza de pie y acaba en el suelo). */
const GROUND_TOP = new Set(["guardia-arriba", "montada", "ground-pound", "side-control", "rodilla-vientre", "pase-guardia", "kimura", "americana"]);
const GROUND_BOTTOM = new Set(["guardia-abajo", "media-guardia", "sumision", "triangulo", "armbar", "heel-hook", "caught", "tap-out", "shrimp", "upa", "derribado", "ko-plano"]);

/* Replay: poses TUMBADAS (el otro se recoloca hacia su cabeza) y
   sumisiones desde abajo cuyo tap-out se desploma encima. */
const REPLAY_LYING = new Set(["guardia-abajo", "media-guardia", "derribado", "ko-plano", "sumision", "triangulo", "armbar", "heel-hook", "tap-out", "shrimp", "upa"]);
const REPLAY_SUB_BOT = new Set(["sumision", "triangulo", "armbar"]);

/* ════════════════════════════════════════════════════════════════
   ARENA RIG LAB — banco de pruebas del motor de animación.
   Todos los personajes son pieles de la marioneta voxel y todas
   las animaciones son PROCEDURALES (nuestra biblioteca de poses).
   Elige personaje → elige movimiento. Base compartida de LUDUS y MMA.
   Modo DUELO: un rival enfrente ejecutando la respuesta coreografiada
   (src/rig/duo.ts). Cámara orbital: arrastra para girar, rueda = zoom.
   ════════════════════════════════════════════════════════════════ */

interface Loaded {
  rig: Rig | null;
  snapshot: Map<THREE.Object3D, { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }>;
}

interface Fighter {
  root: THREE.Object3D;
  loaded: Loaded;
  prev: Pose;
  baseY: number;      // altura de apoyo (pies en el suelo)
  rotY: number;       // orientación base en solitario
  skin?: number;      // piel de la ficha (para regenerar la cara con daño)
  face?: FaceSpec;    // facciones de la ficha
}

/** Piel del RIVAL: misma base pero distinguida (MMA: shorts azules y
    guantes rojos; LUDUS: armadura de acero en vez de bronce) */
function rivalSpec(spec?: PuppetSpec): PuppetSpec {
  if (!spec) return { torso: 0x51606e, pants: 0x33404e, feet: 0x2b2724 };
  const r = { ...spec };
  if (spec.gloves !== undefined) { r.pants = 0x2a4ab0; r.gloves = 0x8c2f2f; }
  if (spec.helmet !== undefined) {
    r.helmet = 0x8a8f96; r.chestPlate = 0x9aa0a8; r.shoulderPads = 0x8a8f96; r.skirt = 0x45403a;
  }
  return r;
}

/* ── UNA EJECUCIÓN POR CLICK ─────────────────────────────────────
   Los movimientos con animación ya NO van en bucle: se reproducen UNA
   vez al hacer click y se congelan en su fotograma final (los golpes
   acaban de vuelta en guardia; los KO se quedan en la lona). Las
   posiciones (guardias, montada, espalda, clinch…) no tienen "fin":
   siguen con su micro-movimiento de postura. Valor = instante de
   congelado (segundos desde el click). */
const ONE_SHOT: Record<string, number> = {
  // comunes
  caminar: 0.67, correr: 0.49, golpe: 0.9, ko: 2.5, provocar: 1.6, celebracion: 0.79,
  // defensas
  esquiva: 1.4, parada: 1.2, retirada: 1.2, "bloqueo-alto": 1.4, "bloqueo-cuerpo": 1.4, chequeo: 1.4,
  // golpes
  jab: 0.9, cross: 1.15, hook: 1.2, uppercut: 1.2, overhand: 1.3, "gancho-cuerpo": 1.3,
  superman: 1.5, backfist: 1.4, codo: 1.0, "codo-giro": 1.3,
  // patadas y rodillas
  "low-kick": 1.6, "patada-cuerpo": 1.6, circular: 1.6, frontal: 1.4, lateral: 1.5,
  switch: 1.4, rodilla: 1.2, "rodilla-voladora": 1.6,
  // lucha (en solitario; en duelo manda la duración del guion DUO_SEQ)
  sprawl: 2.0, derribo: 2.4, "single-leg": 2.2, ippon: 2.0, suplex: 2.4,
  // suelo
  "ground-pound": 1.26, "pase-guardia": 2.6, kimura: 1.8, americana: 1.8, shrimp: 1.6, upa: 2.0,
  "tap-out": 2.2,
  // reacciones
  golpeado: 1.2, derribado: 1.5, "ko-plano": 2.5, zozobra: 0.9, volcado: 2.0, volado: 1.8,
  "defensa-derribo": 1.4, "flash-kd": 2.4,
};

export default function App() {
  const ref = useRef<HTMLDivElement>(null);
  const q = new URLSearchParams(window.location.search);
  const [modelId, setModelId] = useState(q.get("model") ?? MODELS[0].id);
  const qSet = q.get("set");
  const [moveSet, setMoveSet] = useState<"comun" | "pie" | "suelo">(
    qSet === "pie" || qSet === "suelo" ? qSet : qSet === "mma" ? "pie" : "comun");
  const [move, setMove] = useState<string>(q.get("move") || "guardia");
  const [duo, setDuo] = useState(q.get("duo") === "1");
  const [faceId, setFaceId] = useState(q.get("cara") ?? "base");
  const [status, setStatus] = useState("Cargando…");

  /* ─── MODO REPLAY MMAM ─────────────────────────────────────────
     Reproduce un log de combate de MMAM (src/data/demoFight.ts de
     momento; en producción lo enchufa el motor de turnos de MMAM).
     Cada evento = un paso de escena: movimiento, resultado del
     guion elegido por el ActionResult y quién de los dos ataca. */
  const [replayOn, setReplayOn] = useState(q.get("replay") === "1");
  const [repIdx, setRepIdx] = useState(0);
  const [repPlaying, setRepPlaying] = useState(true);
  const replayOnRef = useRef(replayOn); replayOnRef.current = replayOn;
  const repRef = useRef<{ idx: number; t0: number; playing: boolean; frozen?: number; steps: ReplayStep[] }>(
    { idx: 0, t0: performance.now(), playing: true, steps: [] });

  const startReplay = (from = 0) => {
    // &fight=sub → final por sumisión · &fight=real → log con la forma
    // EXACTA del combatLog de mmam (pasa por el adaptador) · resto: KO
    const sel = q.get("fight");
    const fight = sel === "sub" ? DEMO_FIGHT_SUB
      : sel === "real" ? mmamLogToFight(DEMO_MMAM_REAL)
      : DEMO_FIGHT;
    const steps = resolveReplay(fight);
    const idx = Math.max(0, Math.min(steps.length - 1, from));
    // &rept=2.2 congela el evento 2.2 s adentro (capturas de verificación)
    const at = parseFloat(q.get("rept") ?? "0") || 0;
    repRef.current = at > 0
      ? { idx, t0: performance.now(), playing: false, frozen: at, steps }
      : { idx, t0: performance.now(), playing: true, frozen: 0, steps };
    if (at > 0) setRepPlaying(false);
    setRepIdx(idx);
    setRepPlaying(true);
    setStatus(`REPLAY MMAM · ${steps.length} eventos${at > 0 ? ` · ⏸ t=${at}s` : ""}`);
  };
  const toggleReplay = () => {
    const on = !replayOn;
    setReplayOn(on);
    if (on) {
      setMoveSet("pie");
      setDuo(true);                 // el replay necesita a los dos en escena
      startReplay();
    }
  };
  const repPause = () => {
    const r = repRef.current;
    if (r.playing) { r.frozen = (performance.now() - r.t0) / 1000; r.playing = false; setRepPlaying(false); }
    else { r.t0 = performance.now() - (r.frozen ?? 0) * 1000; r.playing = true; setRepPlaying(true); }
  };
  // &turnos=1 → modo POR TURNOS (como mmam): cada evento se juega
  // UNA vez y la escena se queda quieta en su pose final hasta
  // pulsar ⏭. Es el flujo que tendrá el CombatScreen integrado.
  const turnosRef = useRef(q.get("turnos") === "1");
  const repNext = () => {
    const r = repRef.current;
    if (r.playing || r.idx >= r.steps.length - 1) return;
    r.idx++; r.t0 = performance.now(); r.frozen = 0; r.playing = true;
    setRepIdx(r.idx); setRepPlaying(true);
  };

  const modelRef = useRef(modelId); modelRef.current = modelId;
  const setRef = useRef(moveSet); setRef.current = moveSet;
  const moveRef = useRef(move); moveRef.current = move;
  const duoRef = useRef(duo); duoRef.current = duo;
  const faceRef = useRef(faceId); faceRef.current = faceId;
  // &t=1.23 congela el reloj procedural · &ry=2.1: en solitario anula
  // rotationY del modelo; en duelo fija el acimut de la cámara (capturas)
  const tFreeze = useRef<number | null>(q.get("t") !== null ? parseFloat(q.get("t")!) : null);
  const ryOverride = useRef<number | null>(q.get("ry") !== null ? parseFloat(q.get("ry")!) : null);
  // &collide=0 desactiva el detector de colisiones (comparar antes/después)
  const collideOn = useRef(q.get("collide") !== "0");
  // reproducción por click: qué movimiento se lanzó, cuándo, y cuántas
  // veces seguidas (los guiones alternan resultado con cada click)
  const playRef = useRef<{ move: string; t0: number; clicks: number } | null>(null);
  const playMove = (id: string) => {
    setMove(id);
    playRef.current = {
      move: id,
      t0: performance.now(),
      clicks: playRef.current?.move === id ? playRef.current.clicks + 1 : 0,
    };
  };

  // arranque directo por URL (?replay=1 · &rep=N empieza en el evento N)
  useEffect(() => {
    if (replayOn) {
      setMoveSet("pie"); setDuo(true);
      startReplay(parseInt(q.get("rep") ?? "0", 10) || 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = ref.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x141210);
    scene.fog = new THREE.Fog(0x141210, 16, 34);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 1.7, 4.6);
    camera.lookAt(0, 0.95, 0);

    // cámara ORBITAL: arrastrar gira, rueda acerca, botón derecho desplaza
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.9, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1.2;
    controls.maxDistance = 12;
    controls.maxPolarAngle = Math.PI * 0.52;

    scene.add(new THREE.AmbientLight(0x8a7a68, 1.1));
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.0);
    sun.position.set(5, 8, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x88aaff, 0.7);
    rim.position.set(0, 3, -8);
    scene.add(rim);

    // suelo con rejilla sutil estilo "laboratorio"
    const ground = new THREE.Mesh(
      new THREE.CylinderGeometry(8, 8, 0.3, 48),
      new THREE.MeshStandardMaterial({ color: 0x3a3632, roughness: 1 })
    );
    ground.position.y = -0.15;
    ground.receiveShadow = true;
    scene.add(ground);
    const grid = new THREE.PolarGridHelper(8, 12, 6, 48, 0x5a554e, 0x4a4540);
    grid.position.y = 0.01;
    scene.add(grid);

    let attacker: Fighter | null = null;
    let rival: Fighter | null = null;
    let duoActive = false;
    let loading = false;

    const buildFighter = (id: string, spec?: PuppetSpec, hFactor = 1): Fighter => {
      const f = MODELS.find((m) => m.id === id)!;
      const sp = spec ?? f.spec;
      const model = buildVoxelPuppet(sp);
      model.updateMatrixWorld(true);
      const bbox = new THREE.Box3().setFromObject(model);
      const h = Math.max(0.001, bbox.max.y - bbox.min.y);
      const s = (f.targetHeight * hFactor) / h;
      model.scale.setScalar(s);
      const baseY = -bbox.min.y * s;
      model.position.y = baseY;
      model.rotation.y = f.rotationY;
      model.traverse((o) => { o.castShadow = true; });
      scene.add(model);
      const rig = findRig(model);
      const snapshot = new Map<THREE.Object3D, { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }>();
      model.traverse((o) => snapshot.set(o, { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }));
      return { root: model, loaded: { rig, snapshot }, prev: clonePose(GUARD), baseY, rotY: f.rotationY, skin: sp?.skin, face: sp?.face };
    };

    const loadModel = (id: string) => {
      const f = MODELS.find((m) => m.id === id)!;
      loading = true;
      setStatus(`Cargando ${f.label}…`);
      if (attacker) { scene.remove(attacker.root); attacker = null; }
      if (rival) { scene.remove(rival.root); rival = null; }
      // marioneta propia: 15 bloques rígidos sobre bisagras, sin skinning.
      // La ficha solo aporta la piel (spec); rig y animaciones son comunes.
      const fp = FACE_PRESETS.find((x) => x.id === faceRef.current) ?? FACE_PRESETS[0];
      attacker = buildFighter(id, { ...f.spec, face: fp.face, skin: fp.skin ?? f.spec?.skin, body: fp.body }, fp.heightFactor ?? 1);
      attacker.root.userData.modelId = id;
      attacker.root.userData.faceId = faceRef.current;
      duoActive = duoRef.current;
      if (duoActive) {
        const rs = rivalSpec(f.spec);
        rs.face = { brows: "fruncido", hair: "corto", hairColor: 0x1a1512 }; // rival: cara de duro
        rs.body = fp.body ? { ...fp.body, tattoos: undefined } : undefined; // mismo físico, sin tatuajes
        rival = buildFighter(id, rs, fp.heightFactor ?? 1);
        // en duelo la cámara nace en esquina: se ven los dos perfiles
        camera.position.set(3.4, 1.9, 3.6);
        controls.target.set(0, 0.8, 0);
      } else {
        camera.position.set(0, 1.7, 4.6);
        controls.target.set(0, 0.9, 0);
      }
      controls.update();
      loading = false;
      setStatus(attacker.loaded.rig
        ? `${f.autor} — rig "${attacker.loaded.rig.profile}" detectado${duoActive ? " · RIVAL en escena" : ""}`
        : `${f.autor} — ¡rig NO reconocido!`);
    };

    loadModel(modelRef.current);
    // puntería: dirige el brazo golpeador hacia la CABEZA o el CUERPO del
    // rival. Se funde según lo extendido que esté el codo: en guardia no
    // manda, con el brazo estirado apunta de verdad al objetivo.
    const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
    const vPosA = new THREE.Vector3(), vPosB = new THREE.Vector3();
    const qA = new THREE.Quaternion(), qH = new THREE.Quaternion();
    const aimArm = (f: Fighter, side: "L" | "R", lvl: "head" | "body", tgt: Fighter) => {
      const rig = f.loaded.rig!, rigT = tgt.loaded.rig!;
      const ua = side === "L" ? rig.armUpL : rig.armUpR;
      const joint = lvl === "head" ? rigT.head : rigT.spine[rigT.spine.length - 1];
      joint.getWorldPosition(vA);
      if (lvl === "head") {
        // centro de la cara en espacio LOCAL de la cabeza → mundo: así
        // apunta a la cara también con el rival TUMBADO (ground & pound)
        joint.getWorldQuaternion(qH);
        vC.set(0, 0.22 * tgt.root.scale.x, 0).applyQuaternion(qH);
        vA.add(vC);
      }
      ua.getWorldPosition(vB);
      vA.sub(vB).normalize();
      rig.charRoot.getWorldQuaternion(qA).invert();
      vA.applyQuaternion(qA);                       // dirección deseada en espacio charRoot
      const ax = Math.atan2(-vA.z, -vA.y);          // euler XYZ que apunta esa dirección
      const az = Math.asin(Math.max(-1, Math.min(1, vA.x)));
      const uaPose = side === "L" ? f.prev.uaL : f.prev.uaR;
      const fa = side === "L" ? f.prev.faL : f.prev.faR;
      const blend = Math.max(0, Math.min(1, 1 - Math.abs(fa) / 1.9)) * 0.9;
      if (blend < 0.05) return;
      rotBone(rig, ua,
        uaPose[0] + (ax - uaPose[0]) * blend,
        uaPose[1],
        uaPose[2] + (az - uaPose[2]) * blend);
    };

    // daño facial acumulado (replay MMAM): regenera la textura de la
    // cara solo cuando cambia el nivel — nunca frame a frame
    const applyDmg = (f: Fighter, level: number, bleeding: boolean) => {
      const key = `${Math.round(level * 40)}${bleeding ? "b" : ""}`;
      if (f.root.userData.dmgKey === key) return;
      f.root.userData.dmgKey = key;
      if (f.loaded.rig) applyFaceDamage(f.loaded.rig.head, f.skin, f.face, { level, bleeding });
    };

    const watcher = setInterval(() => {
      if (loading || !attacker) return;
      if (attacker.root.userData.modelId !== modelRef.current || duoActive !== duoRef.current
        || attacker.root.userData.faceId !== faceRef.current) {
        loadModel(modelRef.current);
      }
    }, 200);

    const clock = new THREE.Clock();
    let raf = 0;
    let errCount = 0;
    const t0 = performance.now();
    const loop = () => {
      try {
        const dt = clock.getDelta();
        void dt;
        const mv0 = moveRef.current;
        const seq0 = setRef.current === "comun" ? undefined : DUO_SEQ[mv0];
        const play = playRef.current;
        // reloj de UNA ejecución: arranca en el click y se congela al
        // terminar el movimiento (o el guion completo, en duelo)
        let t = tFreeze.current ?? (performance.now() - t0) / 1000;
        if (tFreeze.current === null) {
          const dur = seq0 && rival ? seq0.T : ONE_SHOT[mv0];
          if (dur !== undefined) {
            const el = play && play.move === mv0 ? (performance.now() - play.t0) / 1000 : 0;
            t = Math.min(el, dur);
          }
        }
        // ═══ REPLAY MMAM: log de combate evento a evento ═══
        const rep = repRef.current;
        if (replayOnRef.current && rep.steps.length > 0 && attacker && attacker.loaded.rig && rival && rival.loaded.rig) {
          let step = rep.steps[rep.idx];
          let tR = rep.playing ? (performance.now() - rep.t0) / 1000 : (rep.frozen ?? step.dur);
          if (rep.playing && tR >= step.dur) {
            if (rep.idx >= rep.steps.length - 1) {
              rep.playing = false; rep.frozen = step.dur; setRepPlaying(false);
              setStatus("REPLAY · FIN DEL COMBATE");
            } else if (turnosRef.current) {
              // modo turnos: se congela en la pose final del evento
              // y espera al click del jugador, como en el CombatScreen
              rep.playing = false; rep.frozen = step.dur; setRepPlaying(false);
              setStatus(`REPLAY · ⏸ turno ${rep.idx + 1}/${rep.steps.length} listo — pulsa ⏭`);
            } else {
              rep.idx++; rep.t0 = performance.now(); tR = 0;
              step = rep.steps[rep.idx];
              setRepIdx(rep.idx);
              setStatus(`REPLAY · Asalto ${step.round} · evento ${rep.idx + 1}/${rep.steps.length}`);
            }
          }
          tR = Math.min(tR, step.dur);

          // daño visual acumulado: las caras cuentan el combate
          applyDmg(attacker, step.dmg[0], step.bleed[0]);
          applyDmg(rival, step.dmg[1], step.bleed[1]);

          // guion: coreografía ad-hoc (contragolpe/flash KD) > DUO_SEQ
          // con el resultado que dicta MMAM > posición continua
          const seqR = DUO_SEQ[step.move];
          const cfgR = DUO[step.move] ?? DUO_DEFAULT;
          let beatA: { move: string; tm: number } | null = null;
          let beatB: { move: string; tm: number } | null = null;
          if (step.seqAtk && step.seqDef) {
            const tt = Math.min(tR, step.dur - 1e-4);
            beatA = duoBeatAt(step.seqAtk, tt);
            beatB = duoBeatAt(step.seqDef, tt);
          } else if (seqR) {
            const tt = Math.min(tR, seqR.T - 1e-4);
            const oc = seqR.outcomes[step.outcome % seqR.outcomes.length];
            beatA = duoBeatAt(oc.atk, tt);
            beatB = duoBeatAt(oc.def, tt);
          }
          // swap: quién de los dos ATACA en este evento
          const fA = step.swap ? rival : attacker;
          const fB = step.swap ? attacker : rival;

          let poseA = beatA ? mmaPoseFor(beatA.move, beatA.tm) : mmaPoseFor(step.move, tR);
          let poseB = beatB ? mmaPoseFor(beatB.move, beatB.tm)
            : mmaPoseFor(cfgR.def, cfgR.pA && cfgR.pD ? tR * (cfgR.pD / cfgR.pA) : tR);
          if (collideOn.current) { poseA = resolvePoseCollisions(poseA); poseB = resolvePoseCollisions(poseB); }
          fA.prev = lerpPose(fA.prev, poseA, 0.4); applyPose(fA.loaded.rig!, fA.prev);
          fB.prev = lerpPose(fB.prev, poseB, 0.4); applyPose(fB.loaded.rig!, fB.prev);

          /* escena FIJA: cada luchador plantado en su sitio, cara a
             cara, del primer al último turno. EXCEPCIÓN de suelo:
             cuando uno queda tumbado, el otro se recoloca hacia su
             CABEZA (si no, se queda a la altura de los pies). El
             cambio se suaviza con lerp para que no dé un salto. */
          const mvA = beatA ? beatA.move : step.move;
          const mvB = beatB ? beatB.move : cfgR.def;
          const aLy = REPLAY_LYING.has(mvA), bLy = REPLAY_LYING.has(mvB);
          const homeA = fA === attacker ? 0.55 : -0.55, dirA = fA === attacker ? 1 : -1;
          const homeB = fB === attacker ? 0.55 : -0.55, dirB = fB === attacker ? 1 : -1;
          let zA = homeA, zB = homeB;
          if (aLy && !bLy) zB = homeA + dirA * 0.25;           // B sobre A: hacia su cabeza
          else if (bLy && !aLy) zA = homeB + dirB * 0.25;      // A sobre B
          else if (aLy && bLy && mvB === "tap-out" && REPLAY_SUB_BOT.has(mvA))
            zB = homeA + dirA * 0.25;                          // el tap se desploma encima
          vPosA.set(0, fA.baseY, zA); fA.root.position.lerp(vPosA, 0.22);
          vPosB.set(0, fB.baseY, zB); fB.root.position.lerp(vPosB, 0.22);
          fA.root.rotation.y = fA === attacker ? Math.PI : 0;
          fB.root.rotation.y = fB === attacker ? Math.PI : 0;

          // puntería hacia quien defiende
          fA.root.updateMatrixWorld(true);
          fB.root.updateMatrixWorld(true);
          const aList = AIM[beatA ? beatA.move : step.move];
          if (aList) for (const a of aList) aimArm(fA, a.side, a.lvl, fB);
          else {
            const bList = AIM[beatB ? beatB.move : cfgR.def];
            if (bList) for (const b of bList) aimArm(fB, b.side, b.lvl, fA);
          }

          controls.update();
          renderer.render(scene, camera);
          raf = requestAnimationFrame(loop);
          return;
        }

        if (attacker && attacker.loaded.rig) {
          // ─── secuencia con guion (golpes y derribos con rival) ───
          // varios RESULTADOS se alternan CLICK A CLICK: defiende / le
          // entra / cae derribado. Los beats mandan sobre la tabla DUO.
          const seq = seq0;
          let beatA: { move: string; tm: number } | null = null;
          let beatB: { move: string; tm: number } | null = null;
          if (seq && rival) {
            const tt = t % seq.T;
            const n = tFreeze.current !== null
              ? Math.floor(t / seq.T)
              : (play && play.move === mv0 ? play.clicks : 0);
            const oc = seq.outcomes[n % seq.outcomes.length];
            beatA = duoBeatAt(oc.atk, tt);
            beatB = duoBeatAt(oc.def, tt);
          }

          let target: Pose;
          // pose de calibración: brazo derecho al frente — debe apuntar a cámara
          if (moveRef.current === "test-frente") target = { ...clonePose(GUARD), twist: 0, uaR: [-1.55, 0, 0], faR: -0.05, uaL: [-0.2, 0, -0.1], faL: -0.3 };
          else if (beatA) target = mmaPoseFor(beatA.move, beatA.tm);
          else target = setRef.current === "comun"
            ? poseFor(moveRef.current as MoveId, t)
            : mmaPoseFor(moveRef.current, t);
          // detector de colisiones EN ESPACIO DE POSE: corrige los ángulos
          // de la pose objetivo antes del lerp → determinista, sin parpadeo
          if (collideOn.current) target = resolvePoseCollisions(target);
          // con reloj congelado (&t=) la pose se aplica directa, sin suavizado
          attacker.prev = tFreeze.current !== null ? target : lerpPose(attacker.prev, target, 0.4);
          applyPose(attacker.loaded.rig, attacker.prev);

          // ─── disposición de escena ───
          const cfg = DUO[moveRef.current] ?? DUO_DEFAULT;

          // reacción del rival (pose): beat de la secuencia, o reloj
          // escalado pD/pA para ir A LA PAR con el ataque
          if (rival && rival.loaded.rig) {
            const pA = cfg.pA ?? 0, pD = cfg.pD ?? 0;
            const tB = pA > 0 && pD > 0 ? t * (pD / pA) : t;
            let targetB = beatB
              ? mmaPoseFor(beatB.move, beatB.tm)
              : setRef.current === "comun" ? mmaPoseFor("guardia-mma", t) : mmaPoseFor(cfg.def, tB);
            if (collideOn.current) targetB = resolvePoseCollisions(targetB);
            rival.prev = tFreeze.current !== null ? targetB : lerpPose(rival.prev, targetB, 0.4);
            applyPose(rival.loaded.rig, rival.prev);
          }

          if (rival) {
            // modo dinámico en secuencias: si alguno está en posición de
            // suelo (montada, tumbado…), la escena pasa a modo "ground"
            let mode = cfg.mode ?? "face";
            let dynTop = cfg.top;
            if (beatA || beatB) {
              const mA = beatA?.move ?? "", mB = beatB?.move ?? "";
              if (GROUND_TOP.has(mA) || GROUND_BOTTOM.has(mB)) { mode = "ground"; dynTop = true; }
              else if (GROUND_BOTTOM.has(mA) || GROUND_TOP.has(mB)) { mode = "ground"; dynTop = false; }
              else mode = cfg.mode ?? "face";   // respeta disposiciones especiales (suplex = "behind")
            }
            if (mode === "face") {
              const d = (cfg.dist ?? 1.1) / 2;
              attacker.root.position.set(0, attacker.baseY, d);
              attacker.root.rotation.y = Math.PI;
              rival.root.position.set(0, rival.baseY, -d);
              rival.root.rotation.y = 0;
            } else if (mode === "ground") {
              // top = arriba (de pie/su rodillas dominando); bottom = tumbado.
              // El de arriba se coloca hacia la CABEZA del de abajo (-Z),
              // no a la altura de los pies.
              const aTop = dynTop !== false;
              attacker.root.position.set(0, attacker.baseY, aTop ? -0.6 : -0.3);
              attacker.root.rotation.y = aTop ? Math.PI : 0;
              rival.root.position.set(0, rival.baseY, aTop ? -0.3 : -0.6);
              rival.root.rotation.y = aTop ? 0 : Math.PI;
            } else { // behind: los dos miran a +Z, atacante detrás
              attacker.root.position.set(0, attacker.baseY, -0.42);
              attacker.root.rotation.y = 0;
              rival.root.position.set(0, rival.baseY, 0.18);
              rival.root.rotation.y = 0;
            }

            // ─── puntería: los golpes buscan la cabeza/cuerpo del rival ───
            attacker.root.updateMatrixWorld(true);
            rival.root.updateMatrixWorld(true);
            const aList = AIM[beatA ? beatA.move : moveRef.current];
            if (aList) for (const a of aList) aimArm(attacker, a.side, a.lvl, rival);
            else {
              const bList = setRef.current === "comun" ? undefined : AIM[beatB ? beatB.move : cfg.def];
              if (bList) for (const b of bList) aimArm(rival, b.side, b.lvl, attacker);
            }
          } else {
            attacker.root.position.set(0, attacker.baseY, 0);
            attacker.root.rotation.y = ryOverride.current ?? attacker.rotY;
          }
        }
        // &ry= en duelo: cámara fija en ese acimut (capturas deterministas)
        if (rival && ryOverride.current !== null) {
          const ry = ryOverride.current, R = 4.9;
          camera.position.set(Math.sin(ry) * R, 1.9, Math.cos(ry) * R);
          camera.lookAt(0, 0.85, 0);
        } else {
          controls.update();
        }
        renderer.render(scene, camera);
      } catch (err) {
        if (errCount >= 0) { errCount++; setStatus("ERR: " + (err as Error).message); }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const resize = () => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => {
      clearInterval(watcher);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      controls.dispose();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="h-dvh flex flex-col bg-[#12100e] text-stone-100">
      <div className="px-4 py-2 bg-black/40 border-b border-stone-700/50">
        <h1 className="text-sm font-black text-amber-400 uppercase tracking-wide">Arena Rig Lab</h1>
        <p className="text-[11px] text-stone-400">
          Motor de animación compartido · LUDUS ⚔ MMA — {status}
        </p>
        <p className="text-[10px] text-stone-500">🖱️ arrastra = girar cámara · rueda = zoom · botón derecho = desplazar</p>
      </div>

      <div ref={ref} className="flex-1 min-h-0 relative">
        {replayOn && (
          <div className="absolute top-2 left-2 right-2 z-10 pointer-events-none space-y-1">
            {repRef.current.steps.slice(Math.max(0, repIdx - 3), repIdx + 1).map((s, i, arr) => {
              const isNow = i === arr.length - 1 && repPlaying;
              return (
                <p key={repIdx - arr.length + 1 + i}
                  className={`text-[11px] leading-snug drop-shadow ${isNow ? "text-amber-300 font-black" : "text-stone-400"}`}>
                  <span className="text-stone-500 font-mono">R{s.round}</span>{" "}{s.label}
                  {s.finish && " 🏁"}
                </p>
              );
            })}
            {!repPlaying && repIdx >= repRef.current.steps.length - 1 && (
              <p className="text-sm font-black text-red-400 uppercase tracking-widest drop-shadow">Fin del combate</p>
            )}
          </div>
        )}
      </div>

      <div className="p-3 bg-black/40 border-t border-stone-700/50 space-y-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase text-stone-500 font-bold">Personaje</p>
            <div className="flex gap-1">
              <button onClick={toggleReplay}
                className={`py-1 px-3 rounded text-[11px] font-black ${replayOn ? "bg-red-500 text-black" : "bg-stone-800"}`}>
                {replayOn ? "🎬 REPLAY: ON" : "🎬 REPLAY"}
              </button>
              <button onClick={() => setDuo(!duo)}
                className={`py-1 px-3 rounded text-[11px] font-black ${duo ? "bg-red-500 text-black" : "bg-stone-800"}`}>
                {duo ? "🆚 RIVAL: ON" : "🆚 RIVAL: OFF"}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MODELS.map((m) => (
              <button key={m.id} onClick={() => setModelId(m.id)}
                className={`py-1.5 px-2 rounded text-[11px] font-bold text-left ${modelId === m.id ? "bg-amber-500 text-black" : "bg-stone-800"}`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] uppercase text-stone-500 font-bold">Cara</p>
          <div className="grid grid-cols-4 gap-1">
            {FACE_PRESETS.map((fp) => (
              <button key={fp.id} onClick={() => setFaceId(fp.id)}
                className={`py-1 rounded text-[10px] font-bold ${faceId === fp.id ? "bg-amber-500 text-black" : "bg-stone-800"}`}>
                {fp.label}
              </button>
            ))}
          </div>
        </div>

        {replayOn ? (
          <div className="space-y-1.5">
            <div className="flex gap-1">
              <button onClick={repPause}
                className="flex-1 py-2 rounded text-[12px] font-black bg-amber-500 text-black">
                {repPlaying ? "⏸ Pausar" : "▶ Seguir"}
              </button>
              <button onClick={repNext}
                disabled={repPlaying || repIdx >= repRef.current.steps.length - 1}
                className={`flex-1 py-2 rounded text-[12px] font-black ${!repPlaying && repIdx < repRef.current.steps.length - 1 ? "bg-sky-500 text-black" : "bg-stone-800 text-stone-600"}`}>
                ⏭ Siguiente turno
              </button>
              <button onClick={() => startReplay()}
                className="flex-1 py-2 rounded text-[12px] font-black bg-stone-800">
                ⟲ Reiniciar combate
              </button>
            </div>
            <p className="text-[10px] text-stone-500">
              Log de MMAM ({repRef.current.steps.length} eventos) → motor arena-rig. Asalto {repRef.current.steps[repIdx]?.round ?? 1} · evento {repIdx + 1}/{repRef.current.steps.length}
            </p>
          </div>
        ) : (
        <div className="space-y-1.5">
          <div className="flex gap-1">
            {([["comun", "Común"], ["pie", "MMA · En pie 🥊"], ["suelo", "MMA · Suelo 🤼"]] as const).map(([s, l]) => (
              <button key={s} onClick={() => { setMoveSet(s); playMove(s === "comun" ? "guardia" : s === "pie" ? "guardia-mma" : "guardia-abajo"); }}
                className={`flex-1 py-1 rounded text-[11px] font-bold ${moveSet === s ? "bg-sky-500 text-black" : "bg-stone-800"}`}>
                {l}
              </button>
            ))}
          </div>
          {moveSet === "comun" ? (
            <div className="grid grid-cols-3 gap-1">
              {MOVES.map((m) => (
                <button key={m.id} onClick={() => playMove(m.id)}
                  className={`py-1.5 rounded text-[11px] font-bold ${move === m.id ? "bg-amber-500 text-black" : "bg-stone-800"}`}>
                  {m.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
              {(Array.from(new Set(MMA_MOVES.filter((m) => m.seccion === moveSet).map((m) => m.grupo))) as string[]).map((g: string) => (
                <div key={g}>
                  <p className="text-[9px] uppercase text-stone-500 font-bold pb-0.5">{g}</p>
                  <div className="grid grid-cols-3 gap-1">
                    {MMA_MOVES.filter((m) => m.seccion === moveSet && m.grupo === g).map((m) => (
                      <button key={m.id} onClick={() => playMove(m.id)}
                        className={`py-1.5 rounded text-[10px] font-bold ${move === m.id ? "bg-amber-500 text-black" : "bg-stone-800"}`}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
