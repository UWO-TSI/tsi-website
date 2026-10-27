/**
 * Face Fit (specs/lanes/fit-editor.md): David places each hairstyle and face accessory on the head (three axes) and each
 * whole face's eyes (up, apart) and mouth (up), on the game's own character (Character.tsx, the face painter, the
 * catalogue), bundled by build.mjs: buttons and sliders per axis, the arrow keys on a focused Front or Side view, and
 * dragging in them. Each change writes the page's db (collection `fit`, one doc per item id: `{ x, y, z }` or
 * `{ eyes, mouth, eyesApart }`; an older doc with fewer fields reads the same); scripts/apply-fit.mjs writes an
 * export of it into the catalogue's `fit` map, which the game reads as look.ts FIT. The page writes the same map live.
 */
import { Component, StrictMode, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { createRoot } from "react-dom/client";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, View } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import Character from "@/components/game/character/Character";
import type { CharacterMotion } from "@/lib/game/character/clips";
import { DEFAULT_LOOK, FACE, FIT, PARTS, type CharacterLook, type Fit } from "@/lib/game/character/look";

// ---- running inside the artifact frame -----------------------------------------------------------------------------
/** Any uncaught error, on a line at the top, so David can say what it says. */
const fault = (m: string) => { const el = document.getElementById("fault"); if (el) { el.hidden = false; el.textContent = `Something went wrong: ${m}`; } };
addEventListener("error", e => fault(e.message || String(e.error)));
addEventListener("unhandledrejection", e => fault(String((e.reason as { message?: string })?.message ?? e.reason)));
/**
 * The models are .glb.json files (build.mjs): a GLB in base64. The artifact frame refuses data: and blob: fetches, so
 * each is fetched as the page's own file and handed to the game's loader as the GLB bytes it asked for.
 */
const fileLoad = THREE.FileLoader.prototype.load;
THREE.FileLoader.prototype.load = function (this: THREE.FileLoader, url, onLoad, onProgress, onError) {
  if (!url.endsWith(".glb.json")) return fileLoad.call(this, url, onLoad, onProgress, onError);
  const at = this.manager.resolveURL(this.path + url);
  this.manager.itemStart(at);
  fetch(at).then(r => { if (!r.ok) throw new Error(`${r.status} ${at}`); return r.json() as Promise<string>; })
    .then(b64 => { const s = atob(b64), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); onLoad?.(b.buffer); })
    .catch(e => { onError?.(e); this.manager.itemError(at); })
    .finally(() => this.manager.itemEnd(at));
};
/** A failure inside it shows `fallback` instead of unmounting the page. */
class Catch extends Component<{ children: ReactNode; fallback: (message: string) => ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) { return { error: String((e as { message?: string })?.message ?? e) }; }
  render() { return this.state.error === null ? this.props.children : this.props.fallback(this.state.error); }
}
/** Inside the 3D tree a fallback can't draw DOM: it hands the message to its cell. */
function Report({ message, to }: { message: string; to: (m: string) => void }) {
  useEffect(() => to(message), [message, to]);
  return null;
}

type Kind = "hair" | "face" | "acc";
interface Item { id: string; name: string; kind: Kind; look: (skin: number) => CharacterLook; thumbs: string[]; noMouth?: boolean; noApart?: boolean }
type Field = "x" | "y" | "z" | "eyes" | "mouth" | "eyesApart";

const ROOT = "assets/characters/v6/", ICONS = "assets/icons/";
/** The thumbnail files the bundle carries (build.mjs). */
declare const __THUMBS__: string[];
const THUMBS = new Set(__THUMBS__);
const ITEMS: Item[] = [
  ...PARTS.filter(p => p.slot === "back").map((p): Item => ({ id: p.id, name: p.name, kind: "hair", thumbs: [`${ROOT}hair/thumbs/${p.id}.webp`, `${ICONS}${p.id}.webp`],
    look: skin => ({ ...DEFAULT_LOOK, skin, bangs: "", back: p.id }) })),
  ...Object.values(FACE.faces).map((f): Item => ({ id: f.id, name: f.name, kind: "face", thumbs: [`${ICONS}face-${f.id.replace(/_/g, "-")}.webp`], noMouth: !f.mouth,
    noApart: FACE.layers.eyes.items[f.eyes]?.left === null, look: skin => ({ ...DEFAULT_LOOK, skin, eyes: f.eyes, mouth: f.mouth ?? DEFAULT_LOOK.mouth, extras: f.extras }) })),
  ...PARTS.filter(p => p.slot === "accessory" && p.group === "face").map((p): Item => ({ id: p.id, name: p.name, kind: "acc", thumbs: [`${ICONS}${p.id}.webp`],
    look: skin => ({ ...DEFAULT_LOOK, skin, acc: { face: p.id } }) })),
];
const GROUPS: [Kind, string][] = [["hair", "Hairstyles"], ["face", "Faces"], ["acc", "Face accessories"]];
const FIELDS: Record<Kind, Field[]> = { hair: ["y", "z", "x"], acc: ["y", "z", "x"], face: ["eyes", "eyesApart", "mouth"] };
const ALL: Field[] = ["x", "y", "z", "eyes", "mouth", "eyesApart"];
/** Each axis's name and its two directions (x is as you look at the front: + is to your right, the character's left). */
const LABEL: Record<Field, string> = { y: "Up / down", z: "Forward / back", x: "Left / right", eyes: "Eyes up / down", eyesApart: "Eyes apart", mouth: "Mouth up / down" };
const DIRS: Record<Field, [string, string, string, string]> = {
  y: ["down", "up", "▼", "▲"], z: ["back", "forward", "Back", "Fwd"], x: ["left", "right", "◀", "▶"],
  eyes: ["down", "up", "▼", "▲"], mouth: ["down", "up", "▼", "▲"], eyesApart: ["closer", "apart", "▶◀", "◀▶"],
};
/** Each step and the reach either way: a head piece in metres, a face part in face canvas units (FACE.canvas_m wide). */
const STEP: Record<Field, number> = { x: 0.0005, y: 0.0005, z: 0.0005, eyes: 0.001, mouth: 0.001, eyesApart: 0.001 };
const REACH: Record<Field, number> = { x: 0.04, y: 0.04, z: 0.04, eyes: 0.08, mouth: 0.08, eyesApart: 0.08 };
const CANVAS_M = (FACE as unknown as { canvas_m: number }).canvas_m ?? 0.449;
const isFace = (f: Field) => f === "eyes" || f === "mouth" || f === "eyesApart";
/** Metres per unit: a face part's units are face canvas widths. */
const unit = (f: Field) => (isFace(f) ? CANVAS_M : 1);
const mm = (f: Field, v: number) => {
  const x = v * unit(f) * 1000;
  return `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(1)} mm`;
};
const round = (v: number) => Math.round(v * 1e4) / 1e4;
/** A value on its axis's grid, within its reach. */
const snap = (f: Field, v: number) => round(Math.max(-REACH[f], Math.min(REACH[f], Math.round(v / STEP[f]) * STEP[f])));
const isSet = (id: string) => Object.values(FIT[id] ?? {}).some(v => v);

/** The skins it is judged on: a light one and a dark one. */
const SKINS: [number, string][] = [[1, "Light skin"], [10, "Dark skin"]];
/** Front, 3/4 and side (the character faces the camera at yaw 0, and at -90° its face looks to the left), as the /lab/avatar sheets stage them. */
const VIEWS: [number, string][] = [[0, "Front"], [-0.6, "3/4"], [-Math.PI / 2, "Side"]];
/** The camera (Stage): its height of view at the head, in metres, for turning a drag in pixels into metres. */
const CAMERA = { at: [0, 0.86, 1.3] as const, look: [0, 0.8, 0] as const, fov: 30 };
const VIEW_M = 2 * Math.hypot(CAMERA.at[1] - CAMERA.look[1], CAMERA.at[2] - CAMERA.look[2]) * Math.tan((CAMERA.fov * Math.PI) / 360);

// ---- saving -------------------------------------------------------------------------------------------------------
type Db = { collection(p: string): { get(): Promise<{ docs: { id: string; data(): Record<string, unknown> | undefined }[] }>; doc(id: string): { set(d: Record<string, unknown>): Promise<void> } } };
type Status = { state: "connecting" } | { state: "offline" } | { state: "saved" } | { state: "saving" } | { state: "error"; message: string };

function useStore(onLoaded: () => void) {
  const [status, setStatus] = useState<Status>({ state: "connecting" });
  const db = useRef<Db | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const chains = useRef(new Map<string, Promise<void>>());
  const pending = useRef(0);
  useEffect(() => {
    let live = true;
    const claude = (window as unknown as { claude?: { use(n: string): Promise<unknown> } }).claude;
    (claude ? claude.use("db") : Promise.resolve(null)).then(async d => {
      if (!live) return;
      if (!d) { setStatus({ state: "offline" }); return; }
      db.current = d as Db;
      try {
        const snap = await db.current.collection("fit").get();
        for (const doc of snap.docs) {
          const data = doc.data() ?? {}, fit: Fit = {};
          for (const k of ALL) if (typeof data[k] === "number" && Number.isFinite(data[k])) fit[k] = data[k] as number;
          if (ITEMS.some(i => i.id === doc.id)) FIT[doc.id] = fit;
        }
        onLoaded();
        setStatus({ state: "saved" });
      } catch (e) { setStatus({ state: "error", message: `Couldn't read saved values: ${(e as { message?: string }).message ?? e}` }); }
    }, () => live && setStatus({ state: "offline" }));
    return () => { live = false; };
  }, [onLoaded]);
  /** Write an item's doc a moment after the last change (one write at a time per doc). */
  const save = (item: Item) => {
    if (!db.current) return;
    clearTimeout(timers.current.get(item.id));
    setStatus({ state: "saving" });
    timers.current.set(item.id, setTimeout(() => {
      const data = Object.fromEntries(FIELDS[item.kind].map(f => [f, FIT[item.id]?.[f] ?? 0]));
      pending.current++;
      const next = (chains.current.get(item.id) ?? Promise.resolve()).then(() => db.current!.collection("fit").doc(item.id).set(data)).then(
        () => { if (--pending.current === 0) setStatus(s => (s.state === "error" ? s : { state: "saved" })); },
        e => { pending.current--; setStatus({ state: "error", message: `Not saved: ${(e as { message?: string }).message ?? e}` }); });
      chains.current.set(item.id, next);
    }, 300));
  };
  return { status, save };
}

// ---- the views ------------------------------------------------------------------------------------------------------
/** A view's screen axes in the head's axes (x its left, y up, z forward) and its height in metres at the head. */
interface Frame { right: readonly number[]; up: readonly number[]; metres: number }
/** Front: right is x. Side (the face looks left): right is back. */
const FRAMES: Record<"Front" | "Side", Frame> = { Front: { right: [1, 0, 0], up: [0, 1, 0], metres: VIEW_M }, Side: { right: [0, 0, -1], up: [0, 1, 0], metres: VIEW_M } };
/** The look-around view's camera, handed out to the page (its axes for a move). */
function Expose({ to }: { to: React.MutableRefObject<THREE.Camera | null> }) {
  const camera = useThree(st => st.camera);
  useEffect(() => { to.current = camera; }, [camera, to]);
  return null;
}
function Stage({ look, yaw, orbit }: { look: CharacterLook; yaw: number; orbit?: { camera: React.MutableRefObject<THREE.Camera | null>; enabled: boolean } }) {
  const motion = useRef<CharacterMotion>({ speed: 0, yaw, lift: 0, pose: null, play: null, face: { eyeFrame: "open" }, talk: 0 });
  return <>
    <PerspectiveCamera makeDefault fov={CAMERA.fov} position={[...CAMERA.at]} onUpdate={c => c.lookAt(...CAMERA.look)} />
    {orbit && <><OrbitControls makeDefault target={[...CAMERA.look]} enablePan={false} enableDamping={false} enabled={orbit.enabled}
      minDistance={0.35} maxDistance={3} minPolarAngle={0} maxPolarAngle={Math.PI} /><Expose to={orbit.camera} /></>}
    <ambientLight intensity={1.1} color="#fff6e6" />
    <hemisphereLight args={["#fff8ec", "#b7c7a8", 0.9]} />
    <directionalLight position={[1.6, 2.6, 2.2]} intensity={1.7} color="#fff1d8" />
    <Suspense fallback={null}><Character look={look} motion={motion} scale={1} faceSize={1024} lod={false} keepFace /></Suspense>
  </>;
}
/** Moving the item from a view: the drag as the change from where it began (`h` metres right on screen, `v` up, `side` the screen side it began on); `done` once it ends; `step` an arrow key's whole steps. */
interface Mover { start(): void; to(f: Frame, h: number, v: number, side: number): void; done(): void; step(f: Frame, h: number, v: number): void }
interface Drag { x: number; y: number; side: number; frame: Frame; perPx: number; moved: boolean }
function Cell({ look, yaw, label, reference, move, frame, orbit, moveMode }: { look: CharacterLook; yaw: number; label: string; reference?: boolean;
  move?: Mover; frame?: () => Frame;
  /** The look-around view: a plain drag turns its camera; Shift-drag, or `moveMode`, moves the item. */
  orbit?: React.MutableRefObject<THREE.Camera | null>; moveMode?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const drag = useRef<Drag | null>(null);
  const end = () => { if (drag.current?.moved) move!.done(); drag.current = null; };
  const handlers = move && frame && {
    tabIndex: 0, "aria-label": `${label} view: ${orbit ? "drag to look around, Shift-drag to move" : "drag or use the arrow keys to move"}`,
    onKeyDown(e: React.KeyboardEvent) {
      const d = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] } as Record<string, [number, number]>)[e.key];
      if (!d || orbit) return;
      e.preventDefault();
      move.step(frame(), d[0] * (e.shiftKey ? 10 : 1), d[1] * (e.shiftKey ? 10 : 1));
    },
    // in the capture phase, so a move never reaches the look-around controls underneath
    onPointerDownCapture(e: React.PointerEvent<HTMLElement>) {
      if (e.button !== 0 || (orbit && !e.shiftKey && !moveMode)) return;
      e.stopPropagation();
      const r = e.currentTarget.querySelector(".view")!.getBoundingClientRect(), f = frame();
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.focus();
      drag.current = { x: e.clientX, y: e.clientY, side: e.clientX < r.left + r.width / 2 ? -1 : 1, frame: f, perPx: f.metres / r.height, moved: false };
      move.start();
    },
    onPointerMove(e: React.PointerEvent) {
      const d = drag.current;
      if (!d) return;
      d.moved = true;
      move.to(d.frame, (e.clientX - d.x) * d.perPx, -(e.clientY - d.y) * d.perPx, d.side);
    },
    onPointerUp: end, onPointerCancel: end,
  };
  return <figure className={`cell${reference ? " ref" : ""}${move ? " move" : ""}${orbit ? " orbit" : ""}`} {...handlers}>
    <View className="view"><Catch fallback={m => <Report message={m} to={setError} />}>
      <Stage look={look} yaw={yaw} orbit={orbit && { camera: orbit, enabled: !moveMode }} />
    </Catch></View>
    {error && <p className="cell-error" role="alert">Couldn&apos;t draw this: {error}</p>}
    <figcaption>{label}</figcaption>
  </figure>;
}
/** The look-around camera's frame: its right and up, and its height of view at the head. */
const orbitFrame = (camera: THREE.Camera | null): Frame => {
  if (!(camera instanceof THREE.PerspectiveCamera)) return FRAMES.Front;
  const m = camera.matrixWorld, at = new THREE.Vector3(...CAMERA.look);
  return { right: new THREE.Vector3().setFromMatrixColumn(m, 0).toArray(), up: new THREE.Vector3().setFromMatrixColumn(m, 1).toArray(),
    metres: 2 * camera.position.distanceTo(at) * Math.tan((camera.fov * Math.PI) / 360) };
};

// ---- controls -------------------------------------------------------------------------------------------------------
function Axis({ field, value, disabled, onChange }: { field: Field; value: number; disabled?: string; onChange: (v: number) => void }) {
  const s = STEP[field], r = REACH[field], set = (v: number) => onChange(snap(field, v)), [neg, pos, negIcon, posIcon] = DIRS[field];
  return <div className="lift">
    <div className="lift-head"><span className="lift-label">{LABEL[field]}</span><output>{disabled ?? mm(field, value)}</output></div>
    <div className="lift-row">
      <button type="button" aria-label={`${LABEL[field]}: ${neg}`} disabled={!!disabled} onClick={() => set(value - s)}>{negIcon}</button>
      <input type="range" aria-label={LABEL[field]} min={-r} max={r} step={s} value={value} disabled={!!disabled} onChange={e => set(Number(e.target.value))} />
      <button type="button" aria-label={`${LABEL[field]}: ${pos}`} disabled={!!disabled} onClick={() => set(value + s)}>{posIcon}</button>
      <button type="button" className="reset" aria-label={`Reset ${LABEL[field]}`} disabled={!!disabled || value === 0} onClick={() => set(0)}>Reset</button>
    </div>
  </div>;
}

function Thumb({ item }: { item: Item }) {
  const [at, setAt] = useState(0);
  const thumbs = item.thumbs.filter(t => THUMBS.has(t));
  if (at >= thumbs.length) return <span className="thumb none" aria-hidden>{item.name.slice(0, 1)}</span>;
  return <img className="thumb" src={thumbs[at]} alt="" width={40} height={40} onError={() => setAt(at + 1)} />;
}

const STATUS: Record<Status["state"], string> = { connecting: "Connecting…", offline: "Can't save here: changes last until you close the page", saved: "All changes saved", saving: "Saving…", error: "" };

function App() {
  const [current, setCurrent] = useState(ITEMS[0].id);
  const [rev, setRev] = useState(0);
  const bump = useMemo(() => () => setRev(r => r + 1), []);
  const { status, save } = useStore(bump);
  const item = ITEMS.find(i => i.id === current)!;
  // a new look object per change: Character re-resolves its parts (the lift is in the body's key) and re-paints the face
  const looks = useMemo(() => SKINS.map(([skin]) => item.look(skin)), [item, rev]); // eslint-disable-line react-hooks/exhaustive-deps
  const root = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<"eyes" | "mouth">("eyes");
  const off = (f: Field) => (f === "mouth" && item.noMouth ? "no mouth" : f === "eyesApart" && item.noApart ? "one-piece eyes" : undefined);
  const write = (fit: Fit, commit: boolean) => {
    FIT[item.id] = fit;
    bump();
    if (commit) save(item);
  };
  const change = (field: Field, v: number) => write({ ...FIT[item.id], [field]: v }, true);
  /**
   * A move on screen (metres right and up) in a view's frame, onto `base`: a head piece moves along its axes by it; a
   * face moves its target up by the screen move's up part, and the eyes apart by its sideways part (outward from the
   * side the drag began on).
   */
  const moved = (base: Fit, f: Frame, h: number, v: number, side: number): Fit => {
    const out = { ...base }, add = (k: Field, metres: number) => { if (metres && !off(k)) out[k] = snap(k, (base[k] ?? 0) + metres / unit(k)); };
    const along = (i: number) => h * f.right[i] + v * f.up[i];
    if (item.kind !== "face") (["x", "y", "z"] as const).forEach((k, i) => add(k, along(i)));
    else { add(target, along(1)); if (target === "eyes") add("eyesApart", along(0) * side); }
    return out;
  };
  const begun = useRef<Fit>({});
  const move: Mover = {
    start() { begun.current = { ...FIT[item.id] }; },
    to: (f, h, v, side) => write(moved(begun.current, f, h, v, side), false),
    done() { save(item); },
    /** Arrow keys: whole steps; right is apart for the eyes. */
    step: (f, h, v) => { const m = item.kind === "face" ? STEP.eyes * CANVAS_M : STEP.y; write(moved({ ...FIT[item.id] }, f, h * m, v * m, 1), true); },
  };
  const [moveMode, setMoveMode] = useState(false);
  const [orbitKey, setOrbitKey] = useState(0);
  const orbitCamera = useRef<THREE.Camera | null>(null);
  const anySet = isSet(item.id);
  const reference = item.kind === "face" ? "Default face" : "Default hair";
  return <div ref={root} className="app">
    <header>
      <h1>Face Fit</h1>
      <p className={`status ${status.state}`} role="status">{status.state === "error" ? status.message : STATUS[status.state]}</p>
    </header>
    <div className="body">
      <Catch fallback={m => <p className="failed" role="alert">The list failed: {m}</p>}><nav aria-label="Items">
        {GROUPS.map(([kind, title]) => <section key={kind}>
          <h2>{title}</h2>
          <ul>{ITEMS.filter(i => i.kind === kind).map(i => <li key={i.id}>
            <button type="button" aria-current={i.id === current} onClick={() => setCurrent(i.id)}>
              <Thumb item={i} /><span className="name">{i.name}</span>{isSet(i.id) && <span className="badge">set</span>}
            </button>
          </li>)}</ul>
        </section>)}
      </nav></Catch>
      <Catch fallback={m => <p className="failed" role="alert">The views failed: {m}</p>}><main>
        <div className="controls">
          <h2>{item.name}</h2>
          {FIELDS[item.kind].map(f => <Axis key={f} field={f} value={FIT[item.id]?.[f] ?? 0} disabled={off(f)} onChange={v => change(f, v)} />)}
          {item.kind === "face" && <fieldset className="target">
            <legend>Dragging and arrow keys move</legend>
            <label><input type="radio" name="target" checked={target === "eyes"} onChange={() => setTarget("eyes")} /> Eyes</label>
            <label><input type="radio" name="target" checked={target === "mouth"} disabled={item.noMouth} onChange={() => setTarget("mouth")} /> Mouth</label>
          </fieldset>}
          <div className="hint">
            <p>Drag the big view to look around (wheel or pinch to zoom). To move the item: Shift-drag there or turn on Move, drag the Front or Side views, or use the buttons, sliders and arrow keys (Shift for 10 steps).</p>
            <button type="button" className="reset" disabled={!anySet} onClick={() => write(Object.fromEntries(FIELDS[item.kind].map(f => [f, 0])), true)}>Reset all</button>
          </div>
        </div>
        <section className="around" aria-label="Look around">
          <Cell key={orbitKey} look={looks[0]} yaw={0} label="Look around" move={move} frame={() => orbitFrame(orbitCamera.current)} orbit={orbitCamera} moveMode={moveMode} />
          <div className="around-tools">
            <label><input type="checkbox" checked={moveMode} onChange={e => setMoveMode(e.target.checked)} /> Move</label>
            <button type="button" onClick={() => setOrbitKey(k => k + 1)}>Reset view</button>
          </div>
        </section>
        {SKINS.map(([skin, label], s) => <section key={skin} className="row" aria-label={label}>
          <h3>{label}</h3>
          <div className="cells">
            {VIEWS.map(([yaw, view]) => <Cell key={view} look={looks[s]} yaw={yaw} label={view} move={view === "3/4" ? undefined : move} frame={view === "3/4" ? undefined : () => FRAMES[view as "Front" | "Side"]} />)}
            <Cell look={{ ...DEFAULT_LOOK, skin }} yaw={0} label={reference} reference />
          </div>
        </section>)}
      </main></Catch>
    </div>
    <Catch fallback={m => <p className="failed" role="alert">3D drawing failed: {m}</p>}><Canvas className="port" eventSource={root as React.RefObject<HTMLElement>} gl={{ antialias: true, alpha: true }} dpr={[1, 2]}>
      <View.Port />
    </Canvas></Catch>
  </div>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><Catch fallback={m => <p className="failed" role="alert">Face Fit failed: {m}</p>}><App /></Catch></StrictMode>);
