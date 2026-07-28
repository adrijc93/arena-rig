import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { applyPose, clonePose, findRig, GUARD, lerpPose } from "./rig/poseDriver";
import type { Pose, Rig } from "./rig/poseDriver";
import { MOVES, poseFor } from "./rig/moves";
import type { MoveId } from "./rig/moves";
import { MMA_MOVES, mmaPoseFor } from "./rig/mmaMoves";
import { MODELS } from "./rig/manifest";
import { buildVoxelPuppet } from "./rig/voxelPuppet";

/* ════════════════════════════════════════════════════════════════
   ARENA RIG LAB — banco de pruebas del motor de animación.
   Todos los personajes son pieles de la marioneta voxel y todas
   las animaciones son PROCEDURALES (nuestra biblioteca de poses).
   Elige personaje → elige movimiento. Base compartida de LUDUS y MMA.
   ════════════════════════════════════════════════════════════════ */

interface Loaded {
  rig: Rig | null;
  mixer: THREE.AnimationMixer;
  snapshot: Map<THREE.Object3D, { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }>;
}

export default function App() {
  const ref = useRef<HTMLDivElement>(null);
  const q = new URLSearchParams(window.location.search);
  const [modelId, setModelId] = useState(q.get("model") ?? MODELS[0].id);
  const qSet = q.get("set");
  const [moveSet, setMoveSet] = useState<"comun" | "pie" | "suelo">(
    qSet === "pie" || qSet === "suelo" ? qSet : qSet === "mma" ? "pie" : "comun");
  const [move, setMove] = useState<string>(q.get("move") || "guardia");
  const [status, setStatus] = useState("Cargando…");

  const modelRef = useRef(modelId); modelRef.current = modelId;
  const setRef = useRef(moveSet); setRef.current = moveSet;
  const moveRef = useRef(move); moveRef.current = move;
  // &t=1.23 congela el reloj procedural · &ry=2.1 anula rotationY (depuración / capturas)
  const tFreeze = useRef<number | null>(q.get("t") !== null ? parseFloat(q.get("t")!) : null);
  const ryOverride = useRef<number | null>(q.get("ry") !== null ? parseFloat(q.get("ry")!) : null);

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

    let current: { root: THREE.Object3D; loaded: Loaded; prev: Pose } | null = null;
    let loading = false;

    const loadModel = (id: string) => {
      const f = MODELS.find((m) => m.id === id)!;
      loading = true;
      setStatus(`Cargando ${f.label}…`);
      if (current) { scene.remove(current.root); current = null; }
      // marioneta propia: 15 bloques rígidos sobre bisagras, sin skinning.
      // La ficha solo aporta la piel (spec); rig y animaciones son comunes.
      const model = buildVoxelPuppet(f.spec);
      model.userData.modelId = id;
      model.updateMatrixWorld(true);
      const bbox = new THREE.Box3().setFromObject(model);
      const h = Math.max(0.001, bbox.max.y - bbox.min.y);
      const s = f.targetHeight / h;
      model.scale.setScalar(s);
      model.position.y = -bbox.min.y * s;
      model.rotation.y = ryOverride.current ?? f.rotationY;
      model.traverse((o) => { o.castShadow = true; });
      scene.add(model);
      const mixer = new THREE.AnimationMixer(model);
      const rig = findRig(model);
      const snapshot = new Map<THREE.Object3D, { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }>();
      model.traverse((o) => snapshot.set(o, { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }));
      current = { root: model, loaded: { rig, mixer, snapshot }, prev: clonePose(GUARD) };
      loading = false;
      setStatus(rig
        ? `${f.autor} — rig "${rig.profile}" detectado`
        : `${f.autor} — ¡rig NO reconocido!`);
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
        void dt;
        const t = tFreeze.current ?? (performance.now() - t0) / 1000;
        if (current && current.loaded.rig) {
          let target: Pose;
          // pose de calibración: brazo derecho al frente — debe apuntar a cámara
          if (moveRef.current === "test-frente") target = { ...clonePose(GUARD), twist: 0, uaR: [-1.55, 0, 0], faR: -0.05, uaL: [-0.2, 0, -0.1], faL: -0.3 };
          else target = setRef.current === "comun"
            ? poseFor(moveRef.current as MoveId, t)
            : mmaPoseFor(moveRef.current, t);
          // con reloj congelado (&t=) la pose se aplica directa, sin suavizado
          current.prev = tFreeze.current !== null ? target : lerpPose(current.prev, target, 0.4);
          applyPose(current.loaded.rig, current.prev);
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
        <div className="space-y-1">
          <p className="text-[10px] uppercase text-stone-500 font-bold">Personaje</p>
          <div className="grid grid-cols-3 gap-1">
            {MODELS.map((m) => (
              <button key={m.id} onClick={() => setModelId(m.id)}
                className={`py-1.5 px-2 rounded text-[11px] font-bold text-left ${modelId === m.id ? "bg-amber-500 text-black" : "bg-stone-800"}`}>
                {m.label}
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
