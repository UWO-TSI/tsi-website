/**
 * Residents (specs/lanes/npc-editor.md): David edits every resident's name and role, look, places through the day and
 * lines, on the game's own character (Character.tsx, the creator's catalogue and categories) and the new world's own
 * minimap drawing, bundled by ../fit-editor/build.mjs (`build.mjs npc-editor`). The residents and the checks are
 * web/scripts/residentSources.ts; each change writes the page's db (collection `residents`, one doc per slug holding
 * only the fields that differ from the source); web/scripts/apply-residents.mjs writes an export of it into the sources.
 */
import "../fit-editor/frame";
import { StrictMode, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, View } from "@react-three/drei";
import doc from "@/data/world/world.json";
import Character from "@/components/game/character/Character";
import { useDefaultIslandPlot } from "@/components/game/DefaultIslandMap";
import type { CharacterMotion } from "@/lib/game/character/clips";
import { NATURAL_HAIR, PALETTE, parseLook, partColor, type CharacterLook } from "@/lib/game/character/look";
import { CATEGORIES, choose, colourTarget, isOn, optionName, shownOptions, type Category, type Section } from "@/lib/game/character/creatorCategories";
import { EXPRESSIONS } from "@/lib/game/character/face";
import { MAX_STOPS, POST_TITLES, RESIDENT_ANCHORS, RESIDENT_POSTS } from "@/lib/content/residents";
import { TALK_LIMITS, TIME_TAGS } from "@/lib/content/talk";
import { HOME_LANDMARKS, ROUTINE_SPECIAL, placeAt, residentHome } from "@/lib/game/residentRoutine";
import { LANDMARK_INFO, landmark, landmarkPoint, type LandmarkId } from "@/lib/game/defaultIsland";
import { objectsOf, setVillage, village } from "@/lib/game/villageMap";
import { DROPS } from "@/lib/game/drops";
import { decodeWorld, type WorldDoc } from "@/lib/game/world/format";
import { villageOfWorld } from "@/lib/game/world/village";
import { PHASES, RESIDENTS, STOPS, fieldProblem, nameOf, same, type Field, type Resident, type Schedule, type Values } from "@/scripts/residentSources";
import { Catch, Report } from "../fit-editor/frame";

type Edits = Record<string, Partial<Values>>;
const valuesOf = (r: Resident, e: Edits): Partial<Values> => ({ ...r.base, ...e[r.slug] });
const PLACE_LABEL: Record<string, string> = { ...Object.fromEntries(Object.entries(RESIDENT_ANCHORS).map(([k, a]) => [k, a.label])), home: "Home", bench: "A bench" };
const PHASE_LABEL: Record<string, string> = { dawn: "Dawn", day: "Day", evening: "Evening", night: "Night" };
const EMPTY_PHASE: Record<string, string> = { dawn: "Nothing set: keeps the day's places", day: "Nothing set: the plaza", evening: "Nothing set: keeps the day's places", night: "Nothing set: goes home" };
const stopsOf = (s: Schedule | undefined, phase: string): string[] => { const v = s?.[phase]; return typeof v === "string" ? [v] : Array.isArray(v) ? v : []; };

// ---- the new world, for the map -------------------------------------------------------------------------------------
const bytes = (url: string) => fetch(url).then(r => { if (!r.ok) throw new Error(`${r.status} ${url}`); return r.arrayBuffer(); }).then(b => new Uint8Array(b));
const worldReady = Promise.all([bytes("data/world/height.png"), bytes("data/world/surface.png")])
  .then(([h, s]) => setVillage(villageOfWorld(decodeWorld(doc as unknown as WorldDoc, h, s))));

// ---- saving -------------------------------------------------------------------------------------------------------
interface DocRef { set(d: Record<string, unknown>): Promise<void>; delete(): Promise<void> }
type Db = { collection(p: string): { get(): Promise<{ docs: { id: string; data(): Record<string, unknown> | undefined }[] }>; doc(id: string): DocRef } };
type Status = { state: "connecting" | "offline" | "saved" | "saving" } | { state: "error"; message: string };
const STATUS: Record<Exclude<Status["state"], "error">, string> = { connecting: "Connecting…", offline: "Can't save here: changes last until you close the page", saved: "All changes saved", saving: "Saving…" };
const message = (e: unknown) => String((e as { message?: string })?.message ?? e);

function useStore() {
  const [edits, setEdits] = useState<Edits>({});
  const [status, setStatus] = useState<Status>({ state: "connecting" });
  const db = useRef<Db | null>(null), latest = useRef<Edits>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>()), chains = useRef(new Map<string, Promise<void>>()), pending = useRef(0);
  useEffect(() => {
    let live = true;
    const claude = (window as unknown as { claude?: { use(n: string): Promise<unknown> } }).claude;
    (claude ? claude.use("db") : Promise.resolve(null)).then(async d => {
      if (!live) return;
      if (!d) { setStatus({ state: "offline" }); return; }
      db.current = d as Db;
      try {
        const snap = await db.current.collection("residents").get(), out: Edits = {};
        for (const doc of snap.docs) {
          const r = RESIDENTS.find(x => x.slug === doc.id), data = doc.data() ?? {};
          if (!r) continue;
          // only the fields this resident has, and only where they still differ from the source
          const kept = Object.fromEntries(Object.entries(data).filter(([f, v]) => r.fields.includes(f as Field) && !same(v, r.base[f as Field])
            && (f !== "look" || !fieldProblem("look", v))));
          if (Object.keys(kept).length) out[doc.id] = kept as Partial<Values>;
        }
        latest.current = out;
        setEdits(out);
        setStatus({ state: "saved" });
      } catch (e) { setStatus({ state: "error", message: `Couldn't read saved changes: ${message(e)}` }); }
    }, () => live && setStatus({ state: "offline" }));
    return () => { live = false; };
  }, []);
  /** Write a resident's doc a moment after the last change (one write at a time per doc); an empty doc is deleted. */
  const save = (slug: string) => {
    if (!db.current) return;
    clearTimeout(timers.current.get(slug));
    setStatus({ state: "saving" });
    timers.current.set(slug, setTimeout(() => {
      const data = latest.current[slug], ref = db.current!.collection("residents").doc(slug);
      pending.current++;
      const next = (chains.current.get(slug) ?? Promise.resolve()).then(() => (data && Object.keys(data).length ? ref.set(data as Record<string, unknown>) : ref.delete())).then(
        () => { if (--pending.current === 0) setStatus(s => (s.state === "error" ? s : { state: "saved" })); },
        e => { pending.current--; setStatus({ state: "error", message: `Not saved: ${message(e)}` }); });
      chains.current.set(slug, next);
    }, 400));
  };
  /** Set a field; a value equal to the source's is no change. */
  const set = <F extends Field>(r: Resident, field: F, value: Values[F]) => {
    const mine = { ...latest.current[r.slug] };
    if (same(value, r.base[field])) delete mine[field]; else mine[field] = value;
    const next = { ...latest.current };
    if (Object.keys(mine).length) next[r.slug] = mine; else delete next[r.slug];
    latest.current = next;
    setEdits(next);
    save(r.slug);
  };
  return { edits, status, set };
}

// ---- 3D ---------------------------------------------------------------------------------------------------------------
/** Head and shoulders for the list, the whole body for the big view (the character is about a metre tall). */
const FRAMING = { face: { at: [0, 0.82, 0.95], look: [0, 0.74, 0], fov: 28 }, body: { at: [0, 0.62, 2.7], look: [0, 0.5, 0], fov: 30 } } as const;
function Stage({ look, framing, orbit }: { look: CharacterLook; framing: keyof typeof FRAMING; orbit?: boolean }) {
  const motion = useRef<CharacterMotion>({ speed: 0, yaw: 0, lift: 0, pose: null, play: null, face: { eyeFrame: "open" }, talk: 0 });
  const f = FRAMING[framing];
  return <>
    <PerspectiveCamera makeDefault fov={f.fov} position={[...f.at]} onUpdate={c => c.lookAt(f.look[0], f.look[1], f.look[2])} />
    {orbit && <OrbitControls makeDefault target={[...f.look]} enablePan={false} enableDamping={false} minDistance={0.6} maxDistance={4.5} minPolarAngle={0} maxPolarAngle={Math.PI} />}
    <ambientLight intensity={1.1} color="#fff6e6" />
    <hemisphereLight args={["#fff8ec", "#b7c7a8", 0.9]} />
    <directionalLight position={[1.6, 2.6, 2.2]} intensity={1.7} color="#fff1d8" />
    <Suspense fallback={null}><Character look={look} motion={motion} scale={1} faceSize={framing === "face" ? 256 : 1024} lod={false} keepFace /></Suspense>
  </>;
}
function Portrait({ look, framing, orbit, className }: { look: CharacterLook; framing: keyof typeof FRAMING; orbit?: boolean; className: string }) {
  const [error, setError] = useState<string | null>(null);
  return <div className={`portrait ${className}`}>
    <View className="view"><Catch fallback={m => <Report message={m} to={setError} />}><Stage look={look} framing={framing} orbit={orbit} /></Catch></View>
    {error && <p className="cell-error" role="alert" title={error}>Couldn&apos;t draw: {error}</p>}
  </div>;
}

// ---- small pieces ---------------------------------------------------------------------------------------------------
/** A field's box: its label, what it was when changed, a reset, and what's wrong with it. */
function Box({ label, changed, was, onReset, problem, children }: { label: string; changed: boolean; was?: ReactNode; onReset: () => void; problem?: string | null; children: ReactNode }) {
  return <div className={`box${changed ? " changed" : ""}`}>
    <div className="box-head">
      <span className="box-label">{label}</span>
      {changed && <button type="button" className="reset" onClick={onReset} aria-label={`Reset ${label}`}>Reset</button>}
    </div>
    {children}
    {changed && was !== undefined && <div className="was"><span>Was:</span> {was}</div>}
    {problem && <p className="problem" role="alert">{problem}. Fix this before it's applied.</p>}
  </div>;
}
/** A list of lines, each editable, with an add and a remove. */
function Lines({ lines, onChange, label, max, add = "Add a line" }: { lines: string[]; onChange: (l: string[]) => void; label: string; max: number; add?: string }) {
  return <div className="lines">
    {lines.map((l, i) => <div className="line" key={i}>
      <textarea rows={Math.max(1, Math.ceil(l.length / 70))} aria-label={`${label} ${i + 1}`} value={l} maxLength={TALK_LIMITS.chars}
        onChange={e => onChange(lines.map((x, j) => (j === i ? e.target.value : x)))} />
      <button type="button" className="icon" aria-label={`Remove ${label.toLowerCase()} ${i + 1}`} onClick={() => onChange(lines.filter((_, j) => j !== i))}>✕</button>
    </div>)}
    {lines.length < max && <button type="button" className="add" onClick={() => onChange([...lines, ""])}>+ {add}</button>}
  </div>;
}
const list = (xs: string[]) => (xs.length ? <ol className="was-lines">{xs.map((x, i) => <li key={i}>{x}</li>)}</ol> : <em>none</em>);

// ---- look ---------------------------------------------------------------------------------------------------------
const ALL = () => true;
/** What a category shows as worn (names of the worn options, then its colour), to say what it was. */
function wornIn(cat: Category, look: CharacterLook): string {
  const names = cat.sections.flatMap(s => shownOptions(s, "wardrobe", ALL).filter(id => id !== null && isOn(look, s, id)).map(id => optionName(s, id)));
  const colour = swatchValue(cat, look);
  return [...names, ...(colour === null ? [] : [colour === NATURAL_HAIR ? "natural colour" : `colour ${colour + 1}`])].join(", ") || "none";
}
function swatchValue(cat: Category, look: CharacterLook): number | null {
  if (cat.swatch === "skin") return look.skin;
  if (cat.swatch === "hair") return look.hair;
  const t = colourTarget(cat, look, null);
  return t ? partColor(look, t) : null;
}
function setSwatch(cat: Category, look: CharacterLook, i: number): CharacterLook {
  if (cat.swatch === "skin") return { ...look, skin: i };
  if (cat.swatch === "hair") { const next = { ...look, hair: i }; delete next.hairColor; return next; }
  const t = colourTarget(cat, look, null);
  return t ? { ...look, colors: { ...look.colors, [t]: i } } : look;
}
/** A category back to the source's: each section's option, then its colour. */
function resetCategory(cat: Category, look: CharacterLook, base: CharacterLook): CharacterLook {
  let out = look;
  for (const s of cat.sections) {
    const opts = shownOptions(s, "wardrobe", ALL);
    if ("face" in s.source && s.source.face === "extras") { out = { ...out, extras: base.extras }; continue; }
    const want = opts.find(id => isOn(base, s, id)), now = opts.find(id => isOn(out, s, id));
    if (want !== undefined && want !== now) out = choose(out, s, want);
    else if (want === undefined && now !== undefined && now !== null && s.source && "slot" in s.source && s.source.slot === "accessory") out = choose(out, s, now);
  }
  if (cat.swatch === "skin") out = { ...out, skin: base.skin };
  if (cat.swatch === "hair") { out = { ...out, hair: base.hair }; if (base.hairColor) out.hairColor = base.hairColor; }
  if (cat.swatch === "outfit") for (const id of cat.sections.flatMap(s => s.options)) if (id && base.colors[id] !== undefined) out = { ...out, colors: { ...out.colors, [id]: base.colors[id] } };
  return parseLook(out);
}
/** None is an option where the game lets you wear nothing: shoes, a one-piece, each accessory group. */
const noneAllowed = (s: Section) => "slot" in s.source && (s.source.slot === "accessory" || s.source.slot === "onepiece" || s.source.slot === "shoes");
function SectionPick({ section, look, onChange }: { section: Section; look: CharacterLook; onChange: (l: CharacterLook) => void }) {
  const opts = shownOptions(section, "wardrobe", ALL);
  if ("face" in section.source && section.source.face === "extras") {
    return <div className="checks">{opts.map(id => <label key={id!}><input type="checkbox" checked={look.extras.includes(id!)} onChange={() => onChange(choose(look, section, id))} /> {optionName(section, id)}</label>)}</div>;
  }
  const worn = opts.find(id => id !== null && isOn(look, section, id)) ?? null;
  return <select aria-label={section.label} value={worn ?? ""} onChange={e => {
    const id = e.target.value || null;
    if (id) onChange(parseLook(choose(look, section, id)));
    else if (worn) onChange(parseLook("slot" in section.source && section.source.slot === "accessory" ? choose(look, section, worn) : choose(look, section, null)));
  }}>
    {(noneAllowed(section) || worn === null) && <option value="">None</option>}
    {opts.filter((id): id is string => id !== null).map(id => <option key={id} value={id}>{optionName(section, id)}</option>)}
  </select>;
}
const SWATCHES = { skin: PALETTE.skin, hair: PALETTE.hair, outfit: PALETTE.outfit } as const;
function LookEditor({ look, base, onChange }: { look: CharacterLook; base: CharacterLook; onChange: (l: CharacterLook) => void }) {
  return <div className="look">
    {CATEGORIES.map(cat => {
      const now = wornIn(cat, look), was = wornIn(cat, base), value = swatchValue(cat, look);
      return <Box key={cat.id} label={cat.label} changed={now !== was} was={was} onReset={() => onChange(resetCategory(cat, look, base))}>
        <div className="picks">
          {cat.sections.map(s => <label key={s.id} className="pick">{cat.sections.length > 1 && <span>{s.label}</span>}<SectionPick section={s} look={look} onChange={onChange} /></label>)}
        </div>
        {cat.swatch && value !== null && <div className="swatches" role="radiogroup" aria-label={`${cat.label} colour`}>
          {cat.swatch === "hair" && <button type="button" role="radio" aria-checked={value === NATURAL_HAIR} className="swatch natural" title="The hairstyle's own colours" onClick={() => onChange(setSwatch(cat, look, NATURAL_HAIR))}>N</button>}
          {SWATCHES[cat.swatch].map((hex, i) => <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`Colour ${i + 1}`} className="swatch" style={{ background: hex }}
            onClick={() => onChange(setSwatch(cat, look, i))} />)}
        </div>}
      </Box>;
    })}
  </div>;
}

// ---- where and when -----------------------------------------------------------------------------------------------
/** Where a place is on the new world, or why it isn't. */
function placeOn(key: string): { at: [number, number] } | { skipped: string } {
  if (key === "home" || key === "bench") return { skipped: "" };
  const at = placeAt(key, village());
  if (at) return { at };
  return { skipped: key === "oracle" && !DROPS.oracle ? "sealed until the temple opens" : "not on the new map" };
}
function homeAt(slug: string, v: Partial<Values>): { id: LandmarkId; at: [number, number] | null } {
  const id = residentHome({ post: v.post, schedule: v.schedule }, village());
  const l = landmark(id, village());
  return { id, at: landmarkPoint(id, "door", village()) ?? (l ? [l.x, l.z] : null) };
}
function WorldMap({ slug, values, phase }: { slug: string; values: Partial<Values>; phase: string }) {
  const plot = useDefaultIslandPlot();
  const stops = stopsOf(values.schedule, phase), home = homeAt(slug, values);
  const pins = stops.map((k, i) => ({ k, i, p: placeOn(k) }));
  const benches = stops.includes("bench") ? objectsOf("bench", village()) : [];
  const [x0, z0, w] = plot.viewBox.split(" ").map(Number), r = w / 48;
  return <figure className="map">
    <svg viewBox={plot.viewBox} role="img" aria-label={`The new world's map: ${PHASE_LABEL[phase]} places`}>
      <rect x={x0} y={z0} width="100%" height="100%" fill="var(--sea)" />
      {plot.content}
      {benches.map((b, i) => <circle key={i} cx={-b.x} cy={-b.z} r={r * 0.55} fill="var(--bench)" stroke="#fff" strokeWidth={r * 0.18}><title>A bench</title></circle>)}
      {home.at && <g transform={`translate(${-home.at[0]} ${-home.at[1]})`}>
        <rect x={-r} y={-r} width={r * 2} height={r * 2} rx={r * 0.4} fill="var(--home)" stroke="#fff" strokeWidth={r * 0.2} /><text y={r * 0.42} fontSize={r * 1.2} textAnchor="middle" fill="#fff">H</text>
        <title>Home: {LANDMARK_INFO[home.id].label}</title></g>}
      {pins.map(({ k, i, p }) => "at" in p && <g key={i} transform={`translate(${-p.at[0]} ${-p.at[1]})`}>
        <circle r={r} fill="var(--pin)" stroke="#fff" strokeWidth={r * 0.2} /><text y={r * 0.42} fontSize={r * 1.2} textAnchor="middle" fill="#fff">{i + 1}</text>
        <title>{i + 1}. {PLACE_LABEL[k]}</title></g>)}
    </svg>
    <figcaption>{PHASE_LABEL[phase]}: numbered pins in the order walked, H is home{benches.length ? ", the dots are the benches (the nearest free one, under a lamp after dark)" : ""}. North is to the right.</figcaption>
  </figure>;
}
function Places({ r, values, set }: { r: Resident; values: Partial<Values>; set: (s: Schedule) => void }) {
  const [phase, setPhase] = useState("day");
  const [ready, setReady] = useState(false);
  useEffect(() => { let live = true; worldReady.then(() => live && setReady(true)); return () => { live = false; }; }, []);
  const s = values.schedule ?? {}, base = r.base.schedule ?? {};
  const write = (key: string, v: string | string[] | undefined) => { const next = { ...s }; if (v === undefined || (Array.isArray(v) && !v.length)) delete next[key]; else next[key] = v; set(next); };
  const skipped = ready ? [...new Set(PHASES.flatMap(p => stopsOf(s, p)))].map(k => [k, placeOn(k)] as const).filter((x): x is readonly [string, { skipped: string }] => "skipped" in x[1] && !!x[1].skipped) : [];
  const home = typeof s.home === "string" ? s.home : "";
  const resolved = ready ? homeAt(r.slug, values).id : null;
  return <div className="places">
    <div className="phases">
      <Box label="Home" changed={home !== (base.home ?? "")} was={base.home ? LANDMARK_INFO[base.home as LandmarkId]?.label : "by role"} onReset={() => write("home", base.home as string | undefined)}>
        <select aria-label="Home" value={home} onChange={e => write("home", e.target.value || undefined)}>
          <option value="">By role ({LANDMARK_INFO[(resolved ?? "hq") as LandmarkId].label})</option>
          {HOME_LANDMARKS.map(id => <option key={id} value={id}>{LANDMARK_INFO[id].label}</option>)}
        </select>
        {resolved && home && resolved !== home && <p className="note">On the new world they lodge at {LANDMARK_INFO[resolved].label} until the temple opens.</p>}
      </Box>
      {PHASES.map(p => {
        const stops = stopsOf(s, p), was = stopsOf(base, p);
        return <Box key={p} label={PHASE_LABEL[p]} changed={!same(stops, was)} was={was.map(k => PLACE_LABEL[k]).join(", ") || EMPTY_PHASE[p]} onReset={() => write(p, base[p])}>
          <div className={`stops${phase === p ? " shown" : ""}`} onFocus={() => setPhase(p)} onClick={() => setPhase(p)}>
            {!stops.length && <p className="note">{EMPTY_PHASE[p]}</p>}
            {stops.map((k, i) => <span className="stop" key={i}>
              <span className="n">{i + 1}</span>
              <select aria-label={`${PHASE_LABEL[p]} place ${i + 1}`} value={k} onChange={e => write(p, stops.map((x, j) => (j === i ? e.target.value : x)))}>
                {STOPS.map(o => <option key={o} value={o}>{PLACE_LABEL[o]}</option>)}
              </select>
              <button type="button" className="icon" aria-label={`Remove ${PHASE_LABEL[p]} place ${i + 1}`} onClick={() => write(p, stops.filter((_, j) => j !== i))}>✕</button>
            </span>)}
            {stops.length < MAX_STOPS && <select className="add" aria-label={`Add a ${PHASE_LABEL[p]} place`} value="" onChange={e => e.target.value && write(p, [...stops, e.target.value])}>
              <option value="">+ Add a place</option>
              {STOPS.map(o => <option key={o} value={o}>{PLACE_LABEL[o]}</option>)}
            </select>}
          </div>
        </Box>;
      })}
      <p className="note">{ROUTINE_SPECIAL.home.label}; {ROUTINE_SPECIAL.bench.label.toLowerCase()}. They walk the places in order, staying a while at each, and repeat.</p>
    </div>
    <div className="map-side">
      <div className="tabs" role="tablist" aria-label="Map shows">
        {PHASES.map(p => <button key={p} type="button" role="tab" aria-selected={phase === p} onClick={() => setPhase(p)}>{PHASE_LABEL[p]}</button>)}
      </div>
      {ready ? <Catch fallback={m => <p className="problem" role="alert">The map failed: {m}</p>}><WorldMap slug={r.slug} values={values} phase={phase} /></Catch> : <p className="note">Loading the map…</p>}
      {skipped.length > 0 && <p className="note skipped">Skipped on the new world: {skipped.map(([k, p]) => `${PLACE_LABEL[k]} (${p.skipped})`).join(", ")}. David can place an anchor for a place in /lab/map.</p>}
    </div>
  </div>;
}

// ---- what they say -----------------------------------------------------------------------------------------------------
function Talk({ talk, onChange }: { talk: string[][]; onChange: (t: string[][]) => void }) {
  return <div className="talk">
    {talk.map((c, i) => <fieldset key={i} className="conversation">
      <legend>Conversation {i + 1}</legend>
      <Lines lines={c} label={`Conversation ${i + 1}, box`} max={TALK_LIMITS.lines} add="Add a box" onChange={l => onChange(talk.map((x, j) => (j === i ? l : x)))} />
      <button type="button" className="remove" onClick={() => onChange(talk.filter((_, j) => j !== i))}>Remove conversation {i + 1}</button>
    </fieldset>)}
    {talk.length < TALK_LIMITS.conversations && <button type="button" className="add" onClick={() => onChange([...talk, [""]])}>+ Add a conversation</button>}
  </div>;
}

// ---- the page -----------------------------------------------------------------------------------------------------
function ResidentPage({ r, values, set }: { r: Resident; values: Partial<Values>; set: <F extends Field>(f: F, v: Values[F]) => void }) {
  const has = (f: Field) => r.fields.includes(f);
  const box = (f: Field, label: string, was: ReactNode, child: ReactNode) => has(f) &&
    <Box label={label} changed={!same(values[f], r.base[f])} was={was} onReset={() => set(f, r.base[f] as Values[typeof f])} problem={fieldProblem(f, values[f])}>{child}</Box>;
  const [viewKey, setViewKey] = useState(0);
  return <article className="resident" aria-label={nameOf(r, values)}>
    <section className="top">
      <div className="around">
        <Portrait key={viewKey} look={values.look!} framing="body" orbit className="big" />
        <div className="around-tools"><span>Drag to turn, wheel or pinch to zoom</span><button type="button" onClick={() => setViewKey(k => k + 1)}>Reset view</button></div>
      </div>
      <div className="panel">
        <h2>Name and role</h2>
        {!has("display_name") && <p className="note">The {r.role.toLowerCase()} has no name tag or lines in the game: only the look is set here.</p>}
        {box("display_name", "Name", r.base.display_name, <input type="text" aria-label="Name" value={values.display_name ?? ""} maxLength={80} onChange={e => set("display_name", e.target.value)} />)}
        {box("post", "Role", POST_TITLES[r.base.post as keyof typeof POST_TITLES], <select aria-label="Role" value={values.post} onChange={e => set("post", e.target.value)}>
          {RESIDENT_POSTS.map(p => <option key={p} value={p}>{POST_TITLES[p]}</option>)}</select>)}
        {box("tone", "Tone", r.base.tone || "none", <><input type="text" aria-label="Tone" list="tones" value={values.tone ?? ""} maxLength={40} onChange={e => set("tone", e.target.value)} />
          <datalist id="tones">{["warm", "dry", "earnest", "playful"].map(t => <option key={t} value={t} />)}</datalist></>)}
        {box("bio", "Bio", r.base.bio, <textarea aria-label="Bio" rows={3} value={values.bio ?? ""} maxLength={1000} onChange={e => set("bio", e.target.value)} />)}
        {r.slug === "cafe-owner" && <p className="note">Rosa keeps the café: she works behind its counter, and sweeps out front until it opens.</p>}
        {(r.slug === "sushi-chef" || r.slug === "sushi-server") && <p className="note">Works behind the sushi bar&apos;s counter on the bar&apos;s own hours.</p>}
      </div>
    </section>
    <section className="panel">
      <h2>Look</h2>
      <LookEditor look={values.look!} base={r.base.look!} onChange={l => set("look", l)} />
    </section>
    {has("schedule") && <section className="panel">
      <h2>Where and when</h2>
      <Places r={r} values={values} set={s => set("schedule", s)} />
    </section>}
    {(has("canned_dialogue") || has("talk")) && <section className="panel">
      <h2>What they say</h2>
      <p className="note">Mood tags at the start of a box set the face: {EXPRESSIONS.filter(e => e !== "neutral").map(e => `[${e}]`).join(" ")}. A time tag says when a line is said: {TIME_TAGS.map(t => `@${t}`).join(" ")} (or two, as @evening,night). {"{name}"} is the member&apos;s island name.</p>
      {box("canned_dialogue", r.slug === "cafe-owner" ? "Lines in the café" : "Idle lines (said in passing)", list(r.base.canned_dialogue ?? []),
        <Lines lines={values.canned_dialogue ?? []} label="Line" max={30} onChange={l => set("canned_dialogue", l)} />)}
      {box("sweeper_lines", "Lines out front (before the café opens)", list(r.base.sweeper_lines ?? []),
        <Lines lines={values.sweeper_lines ?? []} label="Out front line" max={30} onChange={l => set("sweeper_lines", l)} />)}
      {box("talk", "Conversations (when you talk to them)", <ol className="was-lines">{(r.base.talk ?? []).map((c, i) => <li key={i}>{c.join(" / ")}</li>)}</ol>,
        <Talk talk={values.talk ?? []} onChange={t => set("talk", t)} />)}
    </section>}
  </article>;
}

function App() {
  const root = useRef<HTMLDivElement>(null);
  const { edits, status, set } = useStore();
  const [current, setCurrent] = useState(RESIDENTS[0].slug);
  const [query, setQuery] = useState("");
  const r = RESIDENTS.find(x => x.slug === current)!;
  const values = useMemo(() => valuesOf(r, edits), [r, edits]);
  const q = query.trim().toLowerCase();
  const shown = RESIDENTS.filter(x => !q || [nameOf(x, valuesOf(x, edits)), x.role, x.slug].some(s => s.toLowerCase().includes(q)));
  const changed = Object.keys(edits).length;
  return <div ref={root} className="app">
    <header>
      <h1>Residents</h1>
      <p className={`status ${status.state}`} role="status">{status.state === "error" ? status.message : STATUS[status.state]}{changed ? ` · ${changed} changed` : ""}</p>
    </header>
    <div className="body">
      <Catch fallback={m => <p className="failed" role="alert">The list failed: {m}</p>}><nav aria-label="Residents">
        <input type="search" className="search" placeholder="Search residents" aria-label="Search residents" value={query} onChange={e => setQuery(e.target.value)} />
        <ul>{shown.map(x => { const v = valuesOf(x, edits); return <li key={x.slug}>
          <button type="button" aria-current={x.slug === current} onClick={() => setCurrent(x.slug)}>
            <Portrait look={v.look!} framing="face" className="small" />
            <span className="who"><span className="name">{nameOf(x, v)}</span><span className="role">{x.fields.includes("post") ? POST_TITLES[v.post as keyof typeof POST_TITLES] : x.role}</span></span>
            {edits[x.slug] && <span className="badge">changed</span>}
          </button>
        </li>; })}</ul>
        {!shown.length && <p className="note">No resident matches.</p>}
      </nav></Catch>
      <Catch key={current} fallback={m => <p className="failed" role="alert">This resident failed: {m}</p>}><main>
        <ResidentPage r={r} values={values} set={(f, v) => set(r, f, v)} />
      </main></Catch>
    </div>
    <Catch fallback={m => <p className="failed" role="alert">3D drawing failed: {m}</p>}><Canvas className="port" eventSource={root as React.RefObject<HTMLElement>} gl={{ antialias: true, alpha: true }} dpr={[1, 2]}>
      <View.Port />
    </Canvas></Catch>
  </div>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><Catch fallback={m => <p className="failed" role="alert">Residents failed: {m}</p>}><App /></Catch></StrictMode>);
