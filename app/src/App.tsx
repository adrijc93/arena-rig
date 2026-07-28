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
import { buildVoxelPuppet, FACE_PRESETS } from "./rig/voxelPuppet";
import type { PuppetSpec } from "./rig/voxelPuppet";
import { DUO, DUO_DEFAULT, DUO_SEQ, duoBeatAt } from "./rig/duo";

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
const GROUND_BOTTOM = new Set(["guardia-abajo", "media-guardia", "sumision", "triangulo", "shrimp", "upa", "derribado", "ko-plano"]);

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

    const buildFighter = (id: string, spec?: PuppetSpec): Fighter => {
      const f = MODELS.find((m) => m.id === id)!;
      const model = buildVoxelPuppet(spec ?? f.spec);
      model.updateMatrixWorld(true);
      const bbox = new THREE.Box3().setFromObject(model);
      const h = Math.max(0.001, bbox.max.y - bbox.min.y);
      const s = f.targetHeight / h;
      model.scale.setScalar(s);
      const baseY = -bbox.min.y * s;
      model.position.y = baseY;
      model.rotation.y = f.rotationY;
      model.traverse((o) => { o.castShadow = true; });
      scene.add(model);
      const rig = findRig(model);
      const snapshot = new Map<THREE.Object3D, { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }>();
      model.traverse((o) => snapshot.set(o, { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }));
      return { root: model, loaded: { rig, snapshot }, prev: clonePose(GUARD), baseY, rotY: f.rotationY };
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
      attacker = buildFighter(id, { ...f.spec, face: fp.face, skin: fp.skin ?? f.spec?.skin });
      attacker.root.userData.modelId = id;
      attacker.root.userData.faceId = faceRef.current;
      duoActive = duoRef.current;
      if (duoActive) {
        const rs = rivalSpec(f.spec);
        rs.face = { brows: "fruncido", hair: "corto", hairColor: 0x1a1512 }; // rival: cara de duro
        rival = buildFighter(id, rs);
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
        const t = tFreeze.current ?? (performance.now() - t0) / 1000;
        if (attacker && attacker.loaded.rig) {
          // ─── secuencia con guion (golpes y derribos con rival) ───
          // varios RESULTADOS se alternan ciclo a ciclo: defiende / le
          // entra / cae derribado. Los beats mandan sobre la tabla DUO.
          const seq = setRef.current === "comun" ? undefined : DUO_SEQ[moveRef.current];
          let beatA: { move: string; tm: number } | null = null;
          let beatB: { move: string; tm: number } | null = null;
          if (seq && rival) {
            const tt = t % seq.T;
            const oc = seq.outcomes[Math.floor(t / seq.T) % seq.outcomes.length];
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
              else mode = "face";
            }
            if (mode === "face") {
              const d = (cfg.dist ?? 1.1) / 2;
              attacker.root.position.set(0, attacker.baseY, d);
              attacker.root.rotation.y = Math.PI;
              rival.root.position.set(0, rival.baseY, -d);
              rival.root.rotation.y = 0;
            } else if (mode === "ground") {
              // top = arriba (de pie/su rodillas dominando); bottom = tumbado
              const aTop = dynTop !== false;
              attacker.root.position.set(0, attacker.baseY, aTop ? 0.42 : -0.3);
              attacker.root.rotation.y = aTop ? Math.PI : 0;
              rival.root.position.set(0, rival.baseY, aTop ? -0.3 : 0.42);
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

      <div ref={ref} className="flex-1 min-h-0" />

      <div className="p-3 bg-black/40 border-t border-stone-700/50 space-y-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase text-stone-500 font-bold">Personaje</p>
            <button onClick={() => setDuo(!duo)}
              className={`py-1 px-3 rounded text-[11px] font-black ${duo ? "bg-red-500 text-black" : "bg-stone-800"}`}>
              {duo ? "🆚 RIVAL: ON" : "🆚 RIVAL: OFF"}
            </button>
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

        <div className="space-y-1.5">
          <div className="flex gap-1">
            {([["comun", "Común"], ["pie", "MMA · En pie 🥊"], ["suelo", "MMA · Suelo 🤼"]] as const).map(([s, l]) => (
              <button key={s} onClick={() => { setMoveSet(s); setMove(s === "comun" ? "guardia" : s === "pie" ? "guardia-mma" : "guardia-abajo"); }}
                className={`flex-1 py-1 rounded text-[11px] font-bold ${moveSet === s ? "bg-sky-500 text-black" : "bg-stone-800"}`}>
                {l}
              </button>
            ))}
          </div>
          {moveSet === "comun" ? (
            <div className="grid grid-cols-3 gap-1">
              {MOVES.map((m) => (
                <button key={m.id} onClick={() => setMove(m.id)}
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
                      <button key={m.id} onClick={() => setMove(m.id)}
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
      </div>
    </div>
  );
}
