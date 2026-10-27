/**
 * Face Fit (specs/lanes/fit-editor.md): David sets each hairstyle's, whole face's and face accessory's height on the
 * game's own character (Character.tsx, the face painter, the catalogue), bundled by build.mjs. Each change writes the
 * page's db (collection `fit`, one doc per item id: `{ y }` or `{ eyes, mouth }`); scripts/apply-fit.mjs writes an
 * export of it into the catalogue's `fit` map, which the game reads as look.ts FIT. The page writes the same map live.
 */
import { StrictMode, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera, View } from "@react-three/drei";
import Character from "@/components/game/character/Character";
import type { CharacterMotion } from "@/lib/game/character/clips";
import { DEFAULT_LOOK, FACE, FIT, PARTS, type CharacterLook, type Fit } from "@/lib/game/character/look";

type Kind = "hair" | "face" | "acc";
interface Item { id: string; name: string; kind: Kind; look: (skin: number) => CharacterLook; thumbs: string[]; noMouth?: boolean }
type Field = "y" | "eyes" | "mouth";

const ROOT = "assets/characters/v6/", ICONS = "assets/icons/";
const ITEMS: Item[] = [
  ...PARTS.filter(p => p.slot === "back").map((p): Item => ({ id: p.id, name: p.name, kind: "hair", thumbs: [`${ROOT}hair/thumbs/${p.id}.webp`, `${ICONS}${p.id}.webp`],
    look: skin => ({ ...DEFAULT_LOOK, skin, bangs: "", back: p.id }) })),
  ...Object.values(FACE.faces).map((f): Item => ({ id: f.id, name: f.name, kind: "face", thumbs: [`${ICONS}face-${f.id.replace(/_/g, "-")}.webp`], noMouth: !f.mouth,
    look: skin => ({ ...DEFAULT_LOOK, skin, eyes: f.eyes, mouth: f.mouth ?? DEFAULT_LOOK.mouth, extras: f.extras }) })),
  ...PARTS.filter(p => p.slot === "accessory" && p.group === "face").map((p): Item => ({ id: p.id, name: p.name, kind: "acc", thumbs: [`${ICONS}${p.id}.webp`],
    look: skin => ({ ...DEFAULT_LOOK, skin, acc: { face: p.id } }) })),
];
const GROUPS: [Kind, string][] = [["hair", "Hairstyles"], ["face", "Faces"], ["acc", "Face accessories"]];
const FIELDS: Record<Kind, Field[]> = { hair: ["y"], acc: ["y"], face: ["eyes", "mouth"] };
const LABEL: Record<Field, string> = { y: "Height", eyes: "Eyes height", mouth: "Mouth height" };
/** Each step and the reach either way: a head piece in metres, a face part in face canvas units (FACE.canvas_m wide). */
const STEP: Record<Field, number> = { y: 0.0005, eyes: 0.001, mouth: 0.001 };
const REACH: Record<Field, number> = { y: 0.04, eyes: 0.08, mouth: 0.08 };
const CANVAS_MM = ((FACE as unknown as { canvas_m: number }).canvas_m ?? 0.449) * 1000;
const mm = (f: Field, v: number) => {
  const x = f === "y" ? v * 1000 : v * CANVAS_MM;
  return `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(1)} mm`;
};
const round = (v: number) => Math.round(v * 1e4) / 1e4;
const isSet = (id: string) => Object.values(FIT[id] ?? {}).some(v => v);

/** The skins it is judged on: a light one and a dark one. */
const SKINS: [number, string][] = [[1, "Light skin"], [10, "Dark skin"]];
/** Front, 3/4 and side (the character faces the camera at yaw 0), as the /lab/avatar sheets stage them. */
const VIEWS: [number, string][] = [[0, "Front"], [-0.6, "3/4"], [-Math.PI / 2, "Side"]];

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
          for (const k of ["y", "eyes", "mouth"] as Field[]) if (typeof data[k] === "number" && Number.isFinite(data[k])) fit[k] = data[k] as number;
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
function Stage({ look, yaw }: { look: CharacterLook; yaw: number }) {
  const motion = useRef<CharacterMotion>({ speed: 0, yaw, lift: 0, pose: null, play: null, face: { eyeFrame: "open" }, talk: 0 });
  return <>
    <PerspectiveCamera makeDefault fov={30} position={[0, 0.86, 1.3]} onUpdate={c => c.lookAt(0, 0.8, 0)} />
    <ambientLight intensity={1.1} color="#fff6e6" />
    <hemisphereLight args={["#fff8ec", "#b7c7a8", 0.9]} />
    <directionalLight position={[1.6, 2.6, 2.2]} intensity={1.7} color="#fff1d8" />
    <Suspense fallback={null}><Character look={look} motion={motion} scale={1} faceSize={1024} lod={false} keepFace /></Suspense>
  </>;
}
function Cell({ look, yaw, label, reference }: { look: CharacterLook; yaw: number; label: string; reference?: boolean }) {
  return <figure className={reference ? "cell ref" : "cell"}>
    <View className="view"><Stage look={look} yaw={yaw} /></View>
    <figcaption>{label}</figcaption>
  </figure>;
}

// ---- controls -------------------------------------------------------------------------------------------------------
function Lift({ field, value, disabled, onChange }: { field: Field; value: number; disabled?: boolean; onChange: (v: number) => void }) {
  const s = STEP[field], r = REACH[field], set = (v: number) => onChange(round(Math.max(-r, Math.min(r, v))));
  return <div className="lift">
    <div className="lift-head"><span className="lift-label">{LABEL[field]}</span><output>{disabled ? "no mouth" : mm(field, value)}</output></div>
    <div className="lift-row">
      <button type="button" aria-label={`${LABEL[field]} down`} disabled={disabled} onClick={() => set(value - s)}>▼</button>
      <input type="range" aria-label={LABEL[field]} min={-r} max={r} step={s} value={value} disabled={disabled} onChange={e => set(Number(e.target.value))} />
      <button type="button" aria-label={`${LABEL[field]} up`} disabled={disabled} onClick={() => set(value + s)}>▲</button>
      <button type="button" className="reset" disabled={disabled || value === 0} onClick={() => set(0)}>Reset</button>
    </div>
  </div>;
}

function Thumb({ item }: { item: Item }) {
  const [at, setAt] = useState(0);
  if (at >= item.thumbs.length) return <span className="thumb none" aria-hidden>{item.name.slice(0, 1)}</span>;
  return <img className="thumb" src={item.thumbs[at]} alt="" width={40} height={40} onError={() => setAt(at + 1)} />;
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
  const change = (field: Field, v: number) => {
    FIT[item.id] = { ...FIT[item.id], [field]: v };
    bump();
    save(item);
  };
  const reference = item.kind === "face" ? "Default face" : "Default hair";
  return <div ref={root} className="app">
    <header>
      <h1>Face Fit</h1>
      <p className={`status ${status.state}`} role="status">{status.state === "error" ? status.message : STATUS[status.state]}</p>
    </header>
    <div className="body">
      <nav aria-label="Items">
        {GROUPS.map(([kind, title]) => <section key={kind}>
          <h2>{title}</h2>
          <ul>{ITEMS.filter(i => i.kind === kind).map(i => <li key={i.id}>
            <button type="button" aria-current={i.id === current} onClick={() => setCurrent(i.id)}>
              <Thumb item={i} /><span className="name">{i.name}</span>{isSet(i.id) && <span className="badge">set</span>}
            </button>
          </li>)}</ul>
        </section>)}
      </nav>
      <main>
        <div className="controls">
          <h2>{item.name}</h2>
          {FIELDS[item.kind].map(f => <Lift key={f} field={f} value={FIT[item.id]?.[f] ?? 0} disabled={f === "mouth" && item.noMouth} onChange={v => change(f, v)} />)}
        </div>
        {SKINS.map(([skin, label], s) => <section key={skin} className="row" aria-label={label}>
          <h3>{label}</h3>
          <div className="cells">
            {VIEWS.map(([yaw, view]) => <Cell key={view} look={looks[s]} yaw={yaw} label={view} />)}
            <Cell look={{ ...DEFAULT_LOOK, skin }} yaw={0} label={reference} reference />
          </div>
        </section>)}
      </main>
    </div>
    <Canvas className="port" eventSource={root as React.RefObject<HTMLElement>} gl={{ antialias: true, alpha: true }} dpr={[1, 2]}>
      <View.Port />
    </Canvas>
  </div>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
