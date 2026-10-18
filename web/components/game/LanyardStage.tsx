"use client";

/**
 * The TSI lanyard in the shop's detail view (specs/merch/tsi-lanyard.md; David, 2026-10-18: "lower the pixelation and
 * can see front and back, and have it horizontal"): laid flat across the stage, its two strands as two horizontal runs
 * (lib/game/lanyardFlat.ts), the outside print along the top and the quote along the bottom, both reading left to right,
 * the D-ring and the snap hook at the right. The view travels slowly along it; drag slides it along yourself and tilts
 * it a little, and a button turns it over for the other two faces. Its own canvas, on the overlay's white studio stage,
 * with a finer pixel finish than the turning stages: the strap is thin, so the pixel size follows how large it is on
 * screen (about 40 canvas pixels across the strap), still pixelated, never eating the type.
 * Where the 3D can't run (lite graphics, or the canvas failing) its sprite shows instead.
 */
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import * as THREE from "three";
import PixelImage from "@/components/economy/PixelImage";
import { useGraphicsSettings } from "@/lib/game/useGraphicsSettings";
import { prepareModel } from "@/lib/game/modelMaterials";
import { iconUrl } from "@/lib/icons/keys";
import { BAR_X, LAY_X0, LAY_X1, STRAP_W, flatLay } from "@/lib/game/lanyardFlat";
import { LANYARD_SLUG, LANYARD_URL } from "./Lanyard";
import s from "./KeychainStage.module.css";

const SPRITE = iconUrl(LANYARD_SLUG);
/** How much of the strap the view holds across (model units: more on a wider stage), and how fast it travels along
 * it (units a second). */
const viewW = (cssWidth: number) => Math.min(2, Math.max(1.15, cssWidth / 520));
const TRAVEL = 0.09, RESUME_S = 2.5;
/** Canvas pixels across the strap: the pixel finish's size for this stage. */
const STRAP_PX = 40;

interface View { x: number; dir: number; tilt: number; flip: number; over: boolean; idleSince: number; down: boolean; lastX: number; lastY: number }
const START_X = 0.85;                                   // the quote's first words in view (the print starts blank)

/** Module scope (three objects written outside React's state): the studio room baked into the scene's environment. */
function lightStudio(gl: THREE.WebGLRenderer, scene: THREE.Scene): () => void {
  const pmrem = new THREE.PMREMGenerator(gl);
  const target = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = target.texture; scene.environmentIntensity = 0.7;
  pmrem.dispose();
  return () => { if (scene.environment === target.texture) scene.environment = null; target.dispose(); };
}
function Studio() {
  const { gl, scene } = useThree();
  useEffect(() => lightStudio(gl, scene), [gl, scene]);
  return null;
}
/** Module scope: frame the camera on the view (the lay's x under it, its tilt and its turn). */
function frame(cam: THREE.PerspectiveCamera, group: THREE.Group, v: View, width: number, aspect: number) {
  const dist = viewW(width) / (2 * Math.tan((cam.fov * Math.PI) / 360) * aspect);
  cam.position.set(v.x, 0, dist); cam.lookAt(v.x, 0, 0);
  group.rotation.x = v.tilt + v.flip * Math.PI;
}

/** Module scope (the frame loop writes the view): travel along it back and forth while left alone, ease the tilt back,
 * turn it over or back. */
function step(v: View, dt: number, w: number): View {
  if (!v.down && performance.now() / 1000 - v.idleSince > RESUME_S) {
    v.x += v.dir * TRAVEL * dt;
    const lo = LAY_X0 + w / 2, hi = LAY_X1 - w / 2;
    if (v.x > hi) { v.x = hi; v.dir = -1; } else if (v.x < lo) { v.x = lo; v.dir = 1; }
  }
  if (!v.down) v.tilt += (0 - v.tilt) * (1 - Math.exp(-dt * 2));
  v.flip += ((v.over ? 1 : 0) - v.flip) * (1 - Math.exp(-dt * 5));
  return v;
}

function Lay({ view }: { view: { current: View } }) {
  const { scene } = useGLTF(LANYARD_URL);
  const parts = useMemo(() => {
    const model = prepareModel(scene, LANYARD_URL);
    let map: THREE.Texture | null = null;
    model.traverse(o => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m?.name?.startsWith("M_Lanyard") && m.map) map = m.map; });
    const lay = flatLay(), g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(lay.position, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(lay.normal, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(lay.uv, 2));
    g.setIndex(new THREE.BufferAttribute(lay.index, 1));
    const strap = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map, roughness: 0.62, metalness: 0 }));
    const hardware = model.getObjectByName("lanyard_hardware")!.clone(true);
    hardware.position.set(BAR_X + 0.011, 0, 0);
    hardware.rotation.set(0, 0, Math.PI / 2);           // it hangs along −y in the model: here it points along +x
    // the tab's stitching across both runs
    const stitch = new THREE.Mesh(new THREE.BoxGeometry(0.006, STRAP_W * 0.92, 0.0105), new THREE.MeshStandardMaterial({ color: "#1b2236", roughness: 1 }));
    stitch.position.set(BAR_X - 0.13, 0, 0);
    const group = new THREE.Group();
    group.add(strap, hardware, stitch);
    return { group, strap };
  }, [scene]);
  useEffect(() => () => { parts.strap.geometry.dispose(); (parts.strap.material as THREE.Material).dispose(); }, [parts]);
  useFrame(({ camera, size }, dt) => {
    const v = step(view.current, Math.min(dt, 0.1), viewW(size.width));
    frame(camera as THREE.PerspectiveCamera, parts.group, v, size.width, size.width / size.height);
  });
  return <primitive object={parts.group} />;
}

/** The sprite when the 3D fails to start. */
class Fallback extends Component<{ sprite: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.sprite : this.props.children; }
}

export default function LanyardStage({ className, pictureClassName }: { className?: string; pictureClassName?: string }) {
  const [{ liteMode }] = useGraphicsSettings();
  const view = useRef<View>({ x: START_X, dir: 1, tilt: 0, flip: 0, over: false, idleSince: -Infinity, down: false, lastX: 0, lastY: 0 });
  const [over, setOver] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const [dpr, setDpr] = useState(0.5);
  // The pixel size from the strap's size on screen: STRAP_PX canvas pixels across it, between a third and three quarters.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setDpr(Math.min(0.75, Math.max(0.33, STRAP_PX / Math.max(1, (STRAP_W / viewW(el.clientWidth)) * el.clientWidth))));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const sprite = <div className={className}><PixelImage src={SPRITE} px={72} className={pictureClassName} label="TSI lanyard" /></div>;
  if (liteMode) return sprite;
  return <Fallback sprite={sprite}>
    <div ref={box} className={className} role="img" aria-label="TSI lanyard, laid flat: the outside print above, the quote below; drag to slide along it" style={{ touchAction: "none", cursor: "grab" }}
      onPointerDown={e => { const v = view.current; v.down = true; v.lastX = e.clientX; v.lastY = e.clientY; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
      onPointerMove={e => {
        const v = view.current;
        if (!v.down) return;
        const w = Math.max(1, e.currentTarget.clientWidth), vw = viewW(w);
        v.x = Math.min(LAY_X1 - vw / 2, Math.max(LAY_X0 + vw / 2, v.x - ((e.clientX - v.lastX) / w) * vw));
        v.tilt = Math.max(-0.35, Math.min(0.35, v.tilt + (e.clientY - v.lastY) * 0.004));
        v.lastX = e.clientX; v.lastY = e.clientY; v.idleSince = performance.now() / 1000;
      }}
      onPointerUp={e => { view.current.down = false; view.current.idleSince = performance.now() / 1000; (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); }}
      onPointerCancel={() => { view.current.down = false; }}>
      <Canvas dpr={dpr} camera={{ position: [START_X, 0, 2], fov: 30, near: 0.05, far: 20 }} gl={{ antialias: false, alpha: true }} style={{ imageRendering: "pixelated" }}
        onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace; }}>
        <ambientLight intensity={0.35} />
        <hemisphereLight args={["#ffffff", "#d9dbe0", 0.55]} />
        <directionalLight position={[2.4, 3.0, 3.2]} intensity={2.3} />
        <directionalLight position={[-3.0, 1.0, 2.4]} intensity={0.85} />
        <directionalLight position={[0.4, 2.4, -3.6]} intensity={1.8} />
        <Studio />
        <Suspense fallback={null}><Lay view={view} /></Suspense>
      </Canvas>
    </div>
    <button type="button" className={s.capButton} aria-pressed={over} data-testid="lanyard-over"
      onClick={() => { view.current.over = !view.current.over; setOver(view.current.over); }}>
      {over ? "Turn it back" : "Turn it over"}
    </button>
  </Fallback>;
}
