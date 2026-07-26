import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { applyPose, clonePose, findRig, GUARD, lerpPose } from "./rig/poseDriver";
import type { Pose, Rig } from "./rig/poseDriver";
import { MOVES, poseFor } from "./rig/moves";
import type { MoveId } from "./rig/moves";
import { MODELS } from "./rig/manifest";

/* ════════════════════════════════════════════════════════════════
   ARENA RIG LAB — banco de pruebas del motor de animación.
   Elige modelo → elige driver (nuestro procedural o clips mocap)
   → elige movimiento. Base compartida de LUDUS y el proyecto MMA.
   ════════════════════════════════════════════════════════════════ */

type Driver = "procedural" | "mocap";

interface Loaded {
  rig: Rig | null;
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
}

export default function App() {
  const ref = useRef<HTMLDivElement>(null);
  const q = new URLSearchParams(window.location.search);
  const [modelId, setModelId] = useState(q.get("model") ?? MODELS[0].id);
  const [driver, setDriver] = useState<Driver>(q.get("driver") === "mocap" ? "mocap" : "procedural");
  const [move, setMove] = useState<MoveId>((q.get("move") as MoveId) || "guardia");
  const [clip, setClip] = useState(q.get("clip") ?? "Idle_Loop");
  const [status, setStatus] = useState("Cargando…");

  const modelRef = useRef(modelId); modelRef.current = modelId;
  const driverRef = useRef(driver); driverRef.current = driver;
  const moveRef = useRef(move); moveRef.current = move;
  const clipRef = useRef(clip); clipRef.current = clip;

  const ficha = MODELS.find((m) => m.id === modelId)!;

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
        model.rotation.y = f.rotationY;
        model.traverse((o) => {
          o.castShadow = true;
          if ((o as THREE.SkinnedMesh).isSkinnedMesh) o.frustumCulled = false;
        });
        scene.add(model);

        const mixer = new THREE.AnimationMixer(model);
        const actions: Record<string, THREE.AnimationAction> = {};
        gltf.animations.forEach((c) => { actions[c.name] = mixer.clipAction(c); });
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
        const rig = findRig(model);
        if (f.calibrateClip && actions[f.calibrateClip]) {
          actions[f.calibrateClip].stop();
          saved!.forEach((v, o) => { o.position.copy(v.p); o.scale.copy(v.s); });
          if (rig) rig.hipsBaseY = rig.hips.position.y;
        }
        current = { root: model, loaded: { rig, mixer, actions }, action: null, prev: clonePose(GUARD) };
        loading = false;
        setStatus(rig
          ? `${f.autor} — rig "${rig.profile}" detectado (${gltf.animations.length} clips)`
          : `${f.autor} — ¡rig NO reconocido! solo clips`);
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
        const t = (performance.now() - t0) / 1000;
        if (current) {
          const { loaded } = current;
          if (driverRef.current === "mocap") {
            const want = loaded.actions[clipRef.current];
            if (want && want !== current.action) {
              current.action?.fadeOut(0.25);
              want.reset().fadeIn(0.25).play();
              current.action = want;
            }
            loaded.mixer.update(dt);
          } else {
            if (current.action) { current.action.stop(); current.action = null; }
            if (loaded.rig) {
              current.prev = lerpPose(current.prev, poseFor(moveRef.current, t), 0.4);
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
                <button key={m.id} onClick={() => { setModelId(m.id); setClip(m.clips[0]); }}
                  className={`py-1.5 px-2 rounded text-[11px] font-bold text-left ${modelId === m.id ? "bg-amber-500 text-black" : "bg-stone-800"}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase text-stone-500 font-bold">Driver</p>
            <div className="flex gap-1">
              {(["procedural", "mocap"] as const).map((d) => (
                <button key={d} onClick={() => setDriver(d)}
                  className={`flex-1 py-1.5 rounded text-[11px] font-bold ${driver === d ? "bg-emerald-500 text-black" : "bg-stone-800"}`}>
                  {d === "procedural" ? "Nuestro código" : "Clip mocap"}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-stone-500 leading-snug">
              {driver === "procedural"
                ? "Cada hueso lo mueve nuestra biblioteca de poses."
                : "Clip original del pack (referencia de calidad)."}
            </p>
          </div>
        </div>

        {driver === "procedural" ? (
          <div className="grid grid-cols-3 gap-1">
            {MOVES.map((m) => (
              <button key={m.id} onClick={() => setMove(m.id)}
                className={`py-1.5 rounded text-[11px] font-bold ${move === m.id ? "bg-amber-500 text-black" : "bg-stone-800"}`}>
                {m.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1 max-h-32 overflow-y-auto">
            {ficha.clips.map((c) => (
              <button key={c} onClick={() => setClip(c)}
                className={`py-1.5 rounded text-[10px] font-bold ${clip === c ? "bg-emerald-500 text-black" : "bg-stone-800"}`}>
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
