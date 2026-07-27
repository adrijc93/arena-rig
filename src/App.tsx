import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { BVHLoader } from "three/examples/jsm/loaders/BVHLoader.js";
import { applyPose, clonePose, findRig, GUARD, lerpPose, mirrorPose } from "./rig/poseDriver";
import type { Pose, Rig } from "./rig/poseDriver";
import { bakeClip, removeDrift, sampleBaked } from "./rig/baker";
import type { BakedClip } from "./rig/baker";
import { MOVES, poseFor } from "./rig/moves";
import type { MoveId } from "./rig/moves";
import { MMA_MOVES, mmaPoseFor } from "./rig/mmaMoves";
import { MODELS } from "./rig/manifest";

/* ════════════════════════════════════════════════════════════════
   ARENA RIG LAB — banco de pruebas del motor de animación.
   Elige modelo → elige driver (nuestro procedural o clips mocap)
   → elige movimiento. Base compartida de LUDUS y el proyecto MMA.
   ════════════════════════════════════════════════════════════════ */

type Driver = "procedural" | "mocap" | "baked";

interface Loaded {
  rig: Rig | null;
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
  snapshot: Map<THREE.Object3D, { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }>;
}

/* Mocap real de lucha — dataset CMU (Carnegie Mellon), licencia libre
   (uso/modificación/redistribución permitidos; no reventa del dato crudo).
   Se hornean a Poses y se reproducen por nuestro motor (driver "Horneado"). */
const CMU_CLIPS: { file: string; label: string }[] = [
  { file: "cmu/13_17.bvh", label: "Boxeo I" },
  { file: "cmu/14_01.bvh", label: "Boxeo II" },
  { file: "cmu/14_02.bvh", label: "Boxeo III" },
  { file: "cmu/76_01.bvh", label: "Puñetazo" },
  { file: "cmu/74_03.bvh", label: "Patadas" },
  { file: "cmu/86_01.bvh", label: "Patadas+puños+saltos" },
  { file: "cmu/02_07.bvh", label: "Espada ⚔ (LUDUS)" },
];

export default function App() {
  const ref = useRef<HTMLDivElement>(null);
  const q = new URLSearchParams(window.location.search);
  const [modelId, setModelId] = useState(q.get("model") ?? MODELS[0].id);
  const [driver, setDriver] = useState<Driver>(
    q.get("driver") === "mocap" ? "mocap" : q.get("driver") === "baked" ? "baked" : "procedural");
  const qSet = q.get("set");
  const [moveSet, setMoveSet] = useState<"comun" | "pie" | "suelo">(
    qSet === "pie" || qSet === "suelo" ? qSet : qSet === "mma" ? "pie" : "comun");
  const [move, setMove] = useState<string>(q.get("move") || "guardia");
  const [clip, setClip] = useState(q.get("clip") ?? "Idle_Loop");
  // clips disponibles: se AUTODESCUBREN del archivo al cargar (así un pack
  // nuevo, p.ej. UAL Pro, aparece entero sin tocar código)
  const [clipsAvail, setClipsAvail] = useState<string[]>(() => MODELS.find((m) => m.id === (q.get("model") ?? MODELS[0].id))!.clips);
  const [mirror, setMirror] = useState(q.get("mirror") === "1"); // espejo zurdo (driver horneado)
  const [status, setStatus] = useState("Cargando…");

  const modelRef = useRef(modelId); modelRef.current = modelId;
  const driverRef = useRef(driver); driverRef.current = driver;
  const setRef = useRef(moveSet); setRef.current = moveSet;
  const moveRef = useRef(move); moveRef.current = move;
  const clipRef = useRef(clip); clipRef.current = clip;
  const mirrorRef = useRef(mirror); mirrorRef.current = mirror;
  // &t=1.23 congela el reloj procedural · &ry=2.1 anula rotationY (depuración / capturas)
  const tFreeze = useRef<number | null>(q.get("t") !== null ? parseFloat(q.get("t")!) : null);
  const ryOverride = useRef<number | null>(q.get("ry") !== null ? parseFloat(q.get("ry")!) : null);
  const skelRef = useRef(q.get("skel") === "1"); // &skel=1 muestra el esqueleto BVH crudo

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

    let current: { root: THREE.Object3D; loaded: Loaded; action: THREE.AnimationAction | null; prev: Pose } | null = null;
    let loading = false;
    const bakedCache = new Map<string, BakedClip>(); // "modelo:clip" → frames horneados
    /* mocap CMU: se carga el BVH, se detecta su rig y se hornea a Poses con
       referencia = postura del fotograma 0 (casa con el idle del maniquí).
       SIN snapshot de neutralización: los huesos no mapeados (LHipJoint,
       Neck1, dedos…) se ABSORBEN en el Δ del padre mapeado → más fidelidad. */
    interface CmuEntry {
      bc: BakedClip;
      raw: { g: THREE.Group; helper: THREE.SkeletonHelper; mixer: THREE.AnimationMixer; action: THREE.AnimationAction };
    }
    const cmuCache = new Map<string, CmuEntry | "loading">(); // "cmu/xx_yy.bvh" → horneado + esqueleto crudo
    let rawShown: CmuEntry["raw"] | null = null; // esqueleto de referencia visible (&skel=1)
    const ensureCmu = (clipId: string) => {
      if (cmuCache.has(clipId)) return;
      cmuCache.set(clipId, "loading");
      setStatus(`Cargando mocap CMU ${clipId.split("/")[1]}…`);
      new BVHLoader().load("models/" + clipId, (res) => {
        const root = res.skeleton.bones[0];
        const rigCmu = findRig(root); // rest = pose canónica (rotaciones en cero)
        if (!rigCmu) { cmuCache.delete(clipId); setStatus("CMU: rig no reconocido"); return; }
        const mixerCmu = new THREE.AnimationMixer(root);
        const action = mixerCmu.clipAction(res.clip);
        // El OFFSET raíz del BVH es (0,0,0): la base de traslación hay que
        // medirla en el primer fotograma (cadera a su altura real de pie).
        action.play(); mixerCmu.update(0);
        // Referencia de rotación = POSTURA del fotograma 0 (guardia natural
        // de pie), NO el cero del archivo: así casa con el rest calibrado del
        // maniquí (idle, piernas abiertas) y no quedan offsets en cadera/piernas.
        rigCmu.rest.forEach((_, b) => rigCmu.rest.set(b, b.quaternion.clone()));
        rigCmu.hipsBaseX = root.position.x;
        rigCmu.hipsBaseY = root.position.y;
        rigCmu.hipsBaseZ = root.position.z;
        rigCmu.unit = root.position.y / 1.02;
        // escala del esqueleto de referencia: caja de las posiciones de mundo
        // de los huesos en el FOTOGRAMA 0 (antes de hornear, que deja el
        // esqueleto en el último fotograma)
        root.updateMatrixWorld(true);
        const bb = new THREE.Box3();
        root.traverse((o) => bb.expandByPoint(o.getWorldPosition(new THREE.Vector3())));
        const sh = 1.85 / Math.max(0.01, bb.max.y - bb.min.y);
        const g = new THREE.Group();
        g.add(root);
        g.scale.setScalar(sh);
        g.position.set(-1.4, -bb.min.y * sh, 0);
        action.stop();
        const bc = bakeClip(rigCmu, mixerCmu, action, 30);
        removeDrift(bc); // el boxeo recorre metros: lo dejamos en el sitio
        // referencia visual: el esqueleto BVH crudo a la izquierda (&skel=1),
        // escalado a la altura del maniquí, con su propio mixer independiente
        g.visible = false;
        scene.add(g);
        // el helper DIBUJA las posiciones de mundo de los huesos: debe colgar
        // de la escena; si cuelga de g, la transformación de g se aplica 2 veces
        const helper = new THREE.SkeletonHelper(root);
        helper.visible = false;
        scene.add(helper);
        const rawMixer = new THREE.AnimationMixer(root);
        cmuCache.set(clipId, { bc, raw: { g, helper, mixer: rawMixer, action: rawMixer.clipAction(res.clip) } });
        setStatus(`CMU ${clipId.split("/")[1]} horneado: ${bc.frames.length} fotogramas (${((bc.frames.length - 1) / bc.fps).toFixed(1)}s)`);
      }, undefined, () => { cmuCache.delete(clipId); setStatus("Error cargando " + clipId); });
    };

    const loadModel = (id: string) => {
      const f = MODELS.find((m) => m.id === id)!;
      loading = true;
      setStatus(`Cargando ${f.label}…`);
      if (current) { scene.remove(current.root); current = null; }
      new GLTFLoader().load(f.file, (gltf) => {
        const model = gltf.scene;
        model.userData.modelId = id;
        f.hide.forEach((n) => model.traverse((o) => { if (o.name === n || o.name === n.replace(/\./g, "")) o.visible = false; }));
        model.updateMatrixWorld(true);
        // escala automática a la altura objetivo
        const bbox = new THREE.Box3();
        const tb = new THREE.Box3();
        model.traverse((o) => {
          if ((o as THREE.SkinnedMesh).isSkinnedMesh || ((o as THREE.Mesh).isMesh && o.visible)) {
            tb.setFromObject(o);
            if (!tb.isEmpty()) bbox.union(tb);
          }
        });
        const h = Math.max(0.001, bbox.max.y - bbox.min.y);
        const s = f.targetHeight / h;
        model.scale.setScalar(s);
        model.position.y = -bbox.min.y * s;
        model.rotation.y = ryOverride.current ?? f.rotationY;
        model.traverse((o) => {
          o.castShadow = true;
          if ((o as THREE.SkinnedMesh).isSkinnedMesh) o.frustumCulled = false;
        });
        scene.add(model);

        const mixer = new THREE.AnimationMixer(model);
        const actions: Record<string, THREE.AnimationAction> = {};
        gltf.animations.forEach((c) => { actions[c.name] = mixer.clipAction(c); });
        let rig: Rig | null = null;
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          // calibración: si el bind pose es A-pose/T-pose, usar el primer
          // fotograma del clip de idle como pose base (brazos abajo).
          // Se restauran las posiciones después (los clips traen root motion).
          let saved: Map<THREE.Object3D, { p: THREE.Vector3; s: THREE.Vector3 }> | null = null;
          if (f.calibrateClip && actions[f.calibrateClip]) {
            saved = new Map();
            model.traverse((o) => saved!.set(o, { p: o.position.clone(), s: o.scale.clone() }));
            actions[f.calibrateClip].play();
            mixer.update(0.05);
          }
          rig = findRig(model);
          if (f.calibrateClip && actions[f.calibrateClip]) {
            actions[f.calibrateClip].stop();
            saved!.forEach((v, o) => { o.position.copy(v.p); o.scale.copy(v.s); });
            if (rig) rig.hipsBaseY = rig.hips.position.y;
          }
          // foto completa del estado calibrado: el horno vuelve aquí tras muestrear
          const snapshot = new Map<THREE.Object3D, { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }>();
          model.traverse((o) => snapshot.set(o, { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }));
          current = { root: model, loaded: { rig, mixer, actions, snapshot }, action: null, prev: clonePose(GUARD) };
          loading = false;
          setClipsAvail(Object.keys(actions)); // autodescubrir clips del archivo
          setStatus(rig
            ? `${f.autor} — rig "${rig.profile}" detectado (${Object.keys(actions).length} clips)`
            : `${f.autor} — ¡rig NO reconocido! solo clips`);
        };
        if (f.clipSource) {
          // los clips viven en otro archivo con el mismo rig (p.ej. Mannequin_F ← UAL2)
          new GLTFLoader().load(f.clipSource, (g2) => {
            g2.animations.forEach((c) => { actions[c.name] = mixer.clipAction(c); });
            finish();
          }, undefined, () => finish());
        } else {
          finish();
        }
      }, undefined, () => {
        loading = false;
        setStatus("Error cargando el modelo");
      });
    };

    loadModel(modelRef.current);
    const watcher = setInterval(() => {
      if (!loading && current && current.root.userData.modelId !== modelRef.current) {
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
        const t = tFreeze.current ?? (performance.now() - t0) / 1000;
        if (current) {
          const { loaded } = current;
          // apagar el esqueleto de referencia al salir de CMU/horneado/&skel
          if (rawShown && (driverRef.current !== "baked" || !skelRef.current || !clipRef.current.startsWith("cmu/"))) {
            rawShown.g.visible = false;
            rawShown.helper.visible = false;
            rawShown = null;
          }
          if (driverRef.current === "mocap") {
            const want = loaded.actions[clipRef.current];
            if (want && want !== current.action) {
              current.action?.fadeOut(0.25);
              want.reset().fadeIn(0.25).play();
              current.action = want;
            }
            loaded.mixer.update(dt);
          } else if (driverRef.current === "baked") {
            if (current.action) { current.action.stop(); current.action = null; }
            if (loaded.rig) {
              const clipId = clipRef.current;
              const isCmu = clipId.startsWith("cmu/");
              let bc: BakedClip | undefined;
              if (isCmu) {
                const e = cmuCache.get(clipId);
                if (!e) ensureCmu(clipId);
                else if (e !== "loading") {
                  bc = e.bc;
                  // esqueleto crudo de referencia (&skel=1): verdad absoluta
                  if (skelRef.current) {
                    if (rawShown !== e.raw) {
                      if (rawShown) { rawShown.g.visible = false; rawShown.helper.visible = false; }
                      rawShown = e.raw;
                      e.raw.g.visible = true;
                      e.raw.helper.visible = true;
                      e.raw.action.reset().play();
                    }
                    // con reloj congelado (&t=), el esqueleto se sincroniza al mismo t
                    if (tFreeze.current !== null) {
                      e.raw.action.paused = true;
                      e.raw.action.time = t % e.raw.action.getClip().duration;
                      e.raw.mixer.update(0);
                    } else {
                      e.raw.mixer.update(dt);
                    }
                  }
                }
              } else {
                const key = modelRef.current + ":" + clipId;
                bc = bakedCache.get(key);
                if (!bc && loaded.actions[clipId]) {
                  bc = bakeClip(loaded.rig, loaded.mixer, loaded.actions[clipId], 30, loaded.snapshot);
                  loaded.snapshot.forEach((v, o) => { o.position.copy(v.p); o.quaternion.copy(v.q); o.scale.copy(v.s); });
                  bakedCache.set(key, bc);
                }
              }
              if (bc) {
                let pose = sampleBaked(bc, t);
                if (mirrorRef.current) pose = mirrorPose(pose);
                current.prev = tFreeze.current !== null ? pose : lerpPose(current.prev, pose, 0.65);
                // CMU y el rig calibrado comparten referencia "de pie, brazos
                // abajo" (el cero del BVH NO es T-pose; el bind T-pose sumaba
                // 90° de error en hombros → brazos en vertical)
                applyPose(loaded.rig, current.prev);
              }
            }
          } else {
            if (current.action) { current.action.stop(); current.action = null; }
            if (loaded.rig) {
              let target: Pose;
              // pose de calibración: brazo derecho al frente — debe apuntar a cámara
              if (moveRef.current === "test-frente") target = { ...clonePose(GUARD), twist: 0, uaR: [-1.55, 0, 0], faR: -0.05, uaL: [-0.2, 0, -0.1], faL: -0.3 };
              else target = setRef.current === "comun"
                ? poseFor(moveRef.current as MoveId, t)
                : mmaPoseFor(moveRef.current, t);
              // con reloj congelado (&t=) la pose se aplica directa, sin suavizado
              current.prev = tFreeze.current !== null ? target : lerpPose(current.prev, target, 0.4);
              applyPose(loaded.rig, current.prev);
            }
          }
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
      </div>

      <div ref={ref} className="flex-1 min-h-0" />

      <div className="p-3 bg-black/40 border-t border-stone-700/50 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <p className="text-[10px] uppercase text-stone-500 font-bold">Modelo</p>
            <div className="flex flex-col gap-1">
              {MODELS.map((m) => (
                <button key={m.id} onClick={() => { setModelId(m.id); setClip(m.clips[0]); setClipsAvail(m.clips); }}
                  className={`py-1.5 px-2 rounded text-[11px] font-bold text-left ${modelId === m.id ? "bg-amber-500 text-black" : "bg-stone-800"}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase text-stone-500 font-bold">Driver</p>
            <div className="flex gap-1">
              {(["procedural", "mocap", "baked"] as const).map((d) => (
                <button key={d} onClick={() => setDriver(d)}
                  className={`flex-1 py-1.5 rounded text-[11px] font-bold ${driver === d ? "bg-emerald-500 text-black" : "bg-stone-800"}`}>
                  {d === "procedural" ? "Nuestro código" : d === "mocap" ? "Clip mocap" : "Horneado"}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-stone-500 leading-snug">
              {driver === "procedural"
                ? "Cada hueso lo mueve nuestra biblioteca de poses."
                : driver === "mocap"
                  ? "Clip original del pack (referencia de calidad)."
                  : "El clip mocap convertido a Poses: pasa por nuestro motor."}
            </p>
            {driver === "baked" && (
              <label className="flex items-center gap-1.5 text-[11px] text-stone-300 cursor-pointer">
                <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} />
                Espejo zurdo (mismo clip, guardia cambiada)
              </label>
            )}
          </div>
        </div>

        {driver === "procedural" ? (
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
        ) : (
          <div className="space-y-1.5">
            <div className="grid grid-cols-3 gap-1 max-h-32 overflow-y-auto">
              {clipsAvail.map((c) => (
                <button key={c} onClick={() => setClip(c)}
                  className={`py-1.5 rounded text-[10px] font-bold ${clip === c ? "bg-emerald-500 text-black" : "bg-stone-800"}`}>
                  {c}
                </button>
              ))}
            </div>
            {driver === "baked" && (
              <div>
                <p className="text-[9px] uppercase text-stone-500 font-bold pb-0.5">Mocap real · dataset CMU (libre)</p>
                <div className="grid grid-cols-3 gap-1 max-h-24 overflow-y-auto">
                  {CMU_CLIPS.map((c) => (
                    <button key={c.file} onClick={() => setClip(c.file)}
                      className={`py-1.5 rounded text-[10px] font-bold ${clip === c.file ? "bg-emerald-500 text-black" : "bg-stone-800"}`}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
