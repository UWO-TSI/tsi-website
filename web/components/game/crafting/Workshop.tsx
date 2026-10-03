"use client";

/**
 * Crafting in the world (specs/crafting.md §4; specs/polish/forage-craft-museum.md 6): the DIY workbench in the
 * clubhouse with its E prompt, the recipe sheet (learned recipes, ingredient counts owned/needed, craft) and today's
 * message bottle on the village beach. Branch drops and rock strikes are forage nodes (islandNodes). Everything goes
 * through /api/crafting; the server decides what you get.
 *
 * Crafting is a moment at the bench, not a sheet's button: once the server has made it, the sheet closes, you step up
 * to the bench and hammer at it (the Craft clip with the hammer in hand), a puff of sawdust and shavings jumping off
 * each blow, then hold the made thing up in a finishing sparkle, and the shared reward card shows it with its art.
 * The bottle stays on the sand until you pick it up (the Pickup clip, at its grab): held up, its cork pops, the note
 * slides out of its neck and unrolls as the reward card's scroll.
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { Piece } from "../interiorShared";
import { GLBProp } from "../NatureModels";
import { useMoveParticles } from "../movement/moveFx";
import { useGlowParticles } from "../GlowFx";
import { constrainClubhouse } from "@/lib/game/clubhouse";
import { villageBottleSpot } from "@/lib/game/islandNodes";
import { setPeacefulTarget } from "@/lib/game/peacefulNear";
import { worldTime } from "@/lib/game/worldClock";
import { installCraftingDemo } from "@/lib/crafting/demo";
import { AudioManager } from "@/lib/game/audio";
import { contactDelay, hitDelays } from "@/lib/game/actTiming";
import { CLIP_BY_NAME } from "@/lib/game/character/look";
import { FINISH_GLINT, FINISH_SPARKS, GLINT_TINT, HAMMER_PUFF, SAWDUST, SAWDUST_TINT } from "@/lib/game/forageFx";
import { seedAt } from "@/lib/game/fx/particles";
import { handOf, liftPose, type Lift } from "@/lib/game/forageLift";
import { prepareModel } from "@/lib/game/modelMaterials";
import { ErrorNote, Loading } from "@/components/gui";
import { isTyping, worldKeysBlocked } from "@/lib/game/useWorldDialog";
import IslandSheet from "../IslandSheet";
import type { RecipeBook, RecipeView } from "@/lib/crafting/service";
import { torontoDay } from "@/lib/wallet/rules";
import { ApiError, apiCall, newKey } from "@/lib/apiClient";
import world from "../DefaultIslandWorld.module.css";
import styles from "./Workshop.module.css";

installCraftingDemo();

// Blender props (art/props-enemies), authored at the character rig's scale: scale 1.3 = CHARACTER_SCALE.
const P = "/assets/game/props/";
const HAMMER_URL = "/assets/game/forage/hammer.glb";

// ── Workbench (clubhouse, against the west wall between the desk and the plants) ──

const BENCH = { x: -7.25, z: 1, halfX: 0.5, halfZ: 0.9 };
const BENCH_APPROACH: [number, number] = [BENCH.x + 1.25, BENCH.z];
/** Where you stand to work at it (its working side faces +x), the height of its top, and where the hammer comes down. */
const CRAFT_SPOT: [number, number] = [BENCH.x + 0.95, BENCH.z];
const BENCH_TOP = 0.585;
const STRIKE_AT: [number, number, number] = [BENCH.x + 0.32, BENCH_TOP, BENCH.z + 0.08];
/** The Craft clip's length (ms) and when its show beat holds the thing up (its phase 0.8). */
const CRAFT_MS = (CLIP_BY_NAME.get("Craft")?.length ?? 2.6) * 1000;
const SHOW_MS = CRAFT_MS * 0.8;

/** The clubhouse's furniture collision plus the bench (member HQ only; the applicant HQ has no bench). */
export function constrainWorkshop(x: number, z: number, nx: number, nz: number): [number, number] {
  const c = constrainClubhouse(x, z, nx, nz);
  const blocked = Math.abs(c[0] - BENCH.x) < BENCH.halfX + 0.25 && Math.abs(c[1] - BENCH.z) < BENCH.halfZ + 0.25;
  if (blocked) { c[0] = x; c[1] = z; }
  return c;
}

/** A craft the server has made, being worked at the bench: walking up, then the blows, the sparkle and the card. */
interface Making { id: string; name: string; kind: string; phase: "walk" | "work"; since: number }
type Pools = { fx: ReturnType<typeof useMoveParticles>; glow: ReturnType<typeof useGlowParticles> };

/** Module scope (outside the frame loop: it sets state and sounds): the blows, the finish and the card. */
function work(m: Making, pools: Pools, player: THREE.Vector3, done: () => void) {
  window.dispatchEvent(new CustomEvent("tsi:act", { detail: { clip: "Craft", at: [BENCH.x, BENCH.z] } }));
  window.dispatchEvent(new CustomEvent("tsi:act-hold", { detail: { url: HAMMER_URL, hold: "hammer", ms: CRAFT_MS - 120 } }));
  const [sx, sy, sz] = STRIKE_AT;
  hitDelays("Craft").forEach((ms, i) => window.setTimeout(() => {
    pools.fx.pool.burst(HAMMER_PUFF, sx, sy + 0.03, sz, sy, 1, 0, 1, SAWDUST_TINT, seedAt(sx, sz, 70 + i));
    pools.fx.pool.burst(SAWDUST, sx, sy + 0.02, sz, sy, 1, 0, 1, SAWDUST_TINT, seedAt(sx, sz, 80 + i));
    AudioManager.playSFX("click", { rate: 0.82 + i * 0.05, gain: 0.7 });
  }, ms));
  // Held up to look at: the finishing sparkle round it, in front of the maker's chest.
  window.setTimeout(() => {
    const yaw = Math.atan2(BENCH.x - player.x, BENCH.z - player.z), at = handOf(player, yaw);
    pools.glow.pool.burst(FINISH_GLINT, at.x, at.y + 0.05, at.z, 0, 0, 0, 1, GLINT_TINT, seedAt(at.x, at.z, 91));
    pools.glow.pool.burst(FINISH_SPARKS, at.x, at.y, at.z, 0, 0, 0, 1, GLINT_TINT, seedAt(at.x, at.z, 92));
  }, SHOW_MS);
  // The shared reward card, with its chime, as the clip lowers it.
  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent("tsi:crafted", { detail: { id: m.id, name: m.name, kind: m.kind } }));
    done();
  }, SHOW_MS + 260);
}

export function Workbench({ player }: { player: React.RefObject<THREE.Vector3> }) {
  const near = useRef(false);
  const fx = useMoveParticles(), glow = useGlowParticles();
  const making = useRef<Making | null>(null);
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ id: string; name: string; kind: string }>).detail;
      making.current = { ...d, phase: "walk", since: performance.now() };
      // Step up to the bench to work at it.
      window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x: CRAFT_SPOT[0], z: CRAFT_SPOT[1] } }));
    };
    window.addEventListener("tsi:craft-begin", on);
    return () => window.removeEventListener("tsi:craft-begin", on);
  }, []);
  useFrame(() => {
    const p = player.current;
    const now = Math.hypot(p.x - BENCH_APPROACH[0], p.z - BENCH_APPROACH[1]) < 1.3;
    if (now !== near.current) { near.current = now; window.dispatchEvent(new CustomEvent("tsi:workbench-near", { detail: now })); }
    const m = making.current;
    // At the bench (or as near as the walk got in a moment): to work. Outside the frame loop, which only notices.
    if (m && m.phase === "walk" && (Math.hypot(p.x - CRAFT_SPOT[0], p.z - CRAFT_SPOT[1]) < 0.14 || performance.now() - m.since > 2200)) {
      m.phase = "work";
      window.setTimeout(() => work(m, { fx, glow }, p, () => { if (making.current === m) making.current = null; }), 0);
    }
  });
  useEffect(() => () => { window.dispatchEvent(new CustomEvent("tsi:workbench-near", { detail: false })); }, []);
  return <Suspense fallback={null}>
    <GLBProp url={`${P}workbench.glb`} scale={1.3} position={[BENCH.x, 0, BENCH.z]} rotation={[0, Math.PI / 2, 0]} />
    <GLBProp url={`${P}branch.glb`} scale={1.3} position={[BENCH.x - 0.1, 0.585, BENCH.z + 0.45]} rotation={[0, 0.4, 0]} />
    <Piece shadows name="cardboard-pile" position={[BENCH.x, 0, BENCH.z - 1.4]} rotY={Math.PI / 2} />
  </Suspense>;
}

// ── Message bottle (village beach, one a Toronto day) ──

/** Its moment, after the grab (ms): up into the hands, the cork pops, the note slides out, then it's put away. */
const BOTTLE = { lift: 320, pop: 560, slide: 520, hold: 700 } as const;
interface Opening { t0: number; lift: Lift; ok: boolean | null }
interface BottleParts { cork: THREE.Object3D[]; note: THREE.Object3D[] }
/** Module scope (the react compiler forbids writing through hook values): the bottle where its opening has it. */
function openBottle(g: THREE.Group | null, rock: THREE.Group | null, parts: BottleParts | null, o: Opening | null, now: number, rest: [number, number, number]) {
  if (!g) return;
  if (rock && !o) rock.rotation.x = Math.sin(worldTime() * 1.3) * 0.08;
  if (!o) { g.position.set(...rest); g.rotation.set(0, 0.8, 0); g.scale.setScalar(1.3); for (const c of parts?.cork ?? []) { c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); c.visible = true; } for (const n of parts?.note ?? []) n.position.set(0, 0, 0); return; }
  const t = now - o.t0;
  if (rock) rock.rotation.x = 0;
  const out = _bottle;
  liftPose(o.lift, Math.min(now, o.t0 + o.lift.ms - 1), out);
  // Up into the hands, turning to stand cork up (its cork end is the model's -x), then held there.
  const up = Math.min(1, t / BOTTLE.lift);
  g.position.set(out.x, out.y, out.z);
  g.rotation.set(0, 0.8 * (1 - up), -Math.PI / 2 * up);
  // The answer wasn't yes: back down onto the sand.
  if (o.ok === false) { g.scale.setScalar(1.3); return; }
  const k = t - BOTTLE.lift;
  for (const c of parts?.cork ?? []) {
    const e = Math.min(1, Math.max(0, k / BOTTLE.pop));
    // Pop: out of the neck, a hop up and over, spinning.
    c.position.set(-0.12 * e - 0.25 * e * e, 0.18 * Math.sin(Math.PI * e), 0.06 * e);
    c.rotation.set(0, 0, 7 * e);
    c.visible = e < 0.97;
  }
  const s = Math.min(1, Math.max(0, (k - BOTTLE.pop * 0.6) / BOTTLE.slide));
  for (const n of parts?.note ?? []) n.position.set(-0.24 * (1 - (1 - s) ** 2), 0, 0);
  // Then put away: it shrinks into the hands as the scroll unrolls.
  const away = Math.min(1, Math.max(0, (k - BOTTLE.pop * 0.6 - BOTTLE.slide - BOTTLE.hold) / 260));
  g.scale.setScalar(1.3 * (1 - away));
  g.visible = away < 1;
}
const _bottle = { x: 0, y: 0, z: 0, scale: 1 };

function BottleModel({ partsOut }: { partsOut: React.RefObject<BottleParts | null> }) {
  const url = `${P}message-bottle.glb`;
  const { scene } = useGLTF(url);
  const model = useMemo(() => prepareModel(scene, url), [scene, url]);
  useEffect(() => {
    const parts: BottleParts = { cork: [], note: [] };
    model.traverse(o => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const name = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).name;
      if (name === "M_Cork") parts.cork.push(mesh);
      if (name === "M_Paper" || name === "M_Tie") parts.note.push(mesh);
    });
    setParts(partsOut, parts);
    return () => setParts(partsOut, null);
  }, [model, partsOut]);
  return <primitive object={model} />;
}
/** Module scope: the bottle's movable parts, for the frame loop. */
const setParts = (ref: React.RefObject<BottleParts | null>, parts: BottleParts | null) => { (ref as React.MutableRefObject<BottleParts | null>).current = parts; };

export function BeachBottle({ player, ground }: { player: React.RefObject<THREE.Vector3>; ground: (x: number, z: number) => number }) {
  const [available, setAvailable] = useState(false);
  const spot = useMemo(() => villageBottleSpot(torontoDay(new Date())), []);
  const rest = useMemo((): [number, number, number] => [spot[0], ground(spot[0], spot[1]) + 0.14, spot[1]], [spot, ground]);
  const group = useRef<THREE.Group>(null), rock = useRef<THREE.Group>(null);
  const parts = useRef<BottleParts | null>(null);
  const opening = useRef<Opening | null>(null);
  const out = useRef(false); // read by the frame loop, so a pickup can't re-arm the prompt before React re-renders
  useEffect(() => { out.current = available; }, [available]);
  useEffect(() => {
    let alive = true;
    apiCall<RecipeBook>("/api/crafting/recipes", "book").then(b => { if (alive) setAvailable(b.bottle.available); }, () => {});
    const onAct = (e: Event) => {
      if ((e as CustomEvent<{ id: string }>).detail.id !== "bottle" || opening.current || !out.current) return;
      out.current = false;
      const p = player.current, yaw = Math.atan2(spot[0] - p.x, spot[1] - p.z);
      const answer = apiCall<{ id: string; name: string }>("/api/crafting/learn", "learned", { source: "bottle" });
      // It leaves the sand at the Pickup's grab, never on the key press.
      window.setTimeout(() => {
        const o: Opening = { t0: performance.now(), ok: null, lift: { t0: performance.now(), from: { x: rest[0], y: rest[1], z: rest[2] }, to: handOf(p, yaw), ms: BOTTLE.lift } };
        opening.current = o;
        void answer.then(learned => {
          o.ok = true;
          // The cork pops a beat after it's up (its sound), the note slides out, and the scroll unrolls (RewardCard).
          const popAt = Math.max(0, o.t0 + BOTTLE.lift - performance.now());
          window.setTimeout(() => AudioManager.playSFX("click", { rate: 1.8, gain: 0.7 }), popAt);
          window.setTimeout(() => window.dispatchEvent(new CustomEvent("tsi:recipe-learned", { detail: { id: learned.id, name: learned.name } })), popAt + BOTTLE.pop * 0.6 + BOTTLE.slide * 0.6);
          window.setTimeout(() => { if (alive) setAvailable(false); opening.current = null; }, popAt + BOTTLE.pop * 0.6 + BOTTLE.slide + BOTTLE.hold + 300);
        }, (err: unknown) => {
          o.ok = false;
          window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: err instanceof ApiError ? err.message : "The cork won't budge. Try again later." } }));
          window.setTimeout(() => { opening.current = null; out.current = true; }, 500);
        });
      }, contactDelay("Pickup"));
    };
    window.addEventListener("tsi:peaceful-act", onAct);
    return () => { alive = false; window.removeEventListener("tsi:peaceful-act", onAct); setPeacefulTarget(null, "bottle"); };
  }, [player, spot, rest]);
  useFrame(() => {
    const d = Math.hypot(player.current.x - spot[0], player.current.z - spot[1]);
    setPeacefulTarget(out.current && !opening.current && d < 1.7 ? bottleTargetAt(d, spot) : null, "bottle");
    openBottle(group.current, rock.current, parts.current, opening.current, performance.now(), rest);
  });
  if (!available) return null;
  return <group ref={group} position={rest} rotation={[0, 0.8, 0]} scale={1.3}>
    <group ref={rock}><Suspense fallback={null}><BottleModel partsOut={parts} /></Suspense></group>
  </group>;
}
/** Its prompt, reused (no allocation in the frame loop): picked up with the Pickup clip. */
const bottleTarget = { id: "bottle", kind: "forage" as const, label: "Open the message bottle", distance: 0, at: [0, 0] as [number, number], clip: "Pickup" as const };
function bottleTargetAt(d: number, spot: [number, number]) { bottleTarget.distance = d; bottleTarget.at[0] = spot[0]; bottleTarget.at[1] = spot[1]; return bottleTarget; }

// ── Recipe sheet ──

export default function CraftingSheet() {
  const [open, setOpen] = useState(false);
  const [near, setNear] = useState(false);
  const [book, setBook] = useState<RecipeBook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // At the bench making something: no prompt until it's done.
  const [making, setMaking] = useState(false);
  const pending = useRef<{ id: string; key: string } | null>(null); // a failed request retries with its key

  const load = useCallback(() => apiCall<RecipeBook>("/api/crafting/recipes", "book").then(
    b => { setBook(b); setError(null); },
    (e: unknown) => setError(e instanceof ApiError ? (e.status === 401 ? "Sign in to use the workbench." : e.message) : "The workbench isn't set up yet.")), []);
  const show = useCallback(() => { setOpen(true); void load(); }, [load]);

  useEffect(() => {
    const onNear = (e: Event) => setNear((e as CustomEvent<boolean>).detail);
    const onDone = () => setMaking(false);
    window.addEventListener("tsi:workbench-near", onNear);
    window.addEventListener("tsi:crafted", onDone);
    return () => { window.removeEventListener("tsi:workbench-near", onNear); window.removeEventListener("tsi:crafted", onDone); };
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      // The open sheet takes E and Escape itself (lib/game/useWorldDialog); under any other dialog the bench waits.
      if (e.repeat || worldKeysBlocked() || isTyping(e.target as Element)) return;
      if (e.key.toLowerCase() === "e" && near && !open && !making) show();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [near, open, making, show]);

  const craft = async (r: RecipeView) => {
    if (busy) return;
    setBusy(true);
    if (pending.current?.id !== r.id) pending.current = { id: r.id, key: `craft:${newKey()}` };
    try {
      const done = await apiCall<{ name: string }>("/api/crafting/craft", "craft", { recipe_id: r.id, idempotency_key: pending.current.key });
      pending.current = null;
      // Made: the sheet puts itself away and you work it at the bench (Workbench); the reward card shows it at the end.
      setOpen(false);
      setMaking(true);
      window.dispatchEvent(new CustomEvent("tsi:craft-begin", { detail: { id: r.id, name: done.name, kind: r.kind } }));
      void load();
    } catch (e) {
      if (e instanceof ApiError) pending.current = null; // answered: the next press is a new craft
      setError(e instanceof ApiError ? e.message : "The workbench wobbled. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const selected = book?.recipes.find(r => r.id === pick) ?? book?.recipes[0] ?? null;

  return <>
    {!open && near && !making && <button className={world.interact} onClick={show}><kbd>E</kbd>Use the workbench</button>}
    <IslandSheet open={open} title="Workbench" onClose={() => setOpen(false)} testId="crafting-sheet" keys="e" size="lg">
    {error && <ErrorNote onRetry={() => void load()}>{error}</ErrorNote>}
    {!book ? (error ? null : <Loading label="Laying out your recipes…" />) : <>
      <p className={styles.count}>{book.recipes.length} of {book.total} recipes known</p>
      <div className={styles.body}>
        <ul className={styles.list} aria-label="Recipes">{book.recipes.map(r => <li key={r.id}>
          <button aria-pressed={selected?.id === r.id} onClick={() => { setPick(r.id); setError(null); }}>
            <span>{r.name}</span><i data-ready={r.can_craft} data-owned={r.owned} aria-label={r.owned ? "owned" : r.can_craft ? "ready" : "missing materials"} />
          </button>
        </li>)}</ul>
        {selected && <div className={styles.detail}>
          <h3>{selected.name}{selected.qty > 1 ? ` ×${selected.qty}` : ""}</h3>
          <small>{selected.source === "starter" ? "Everyone knows this one." : selected.source === "bottle" ? "From a message bottle." : selected.source === "shop" ? "From a recipe card." : selected.source === "catch" ? "From a rare catch." : "Taught by a resident."}</small>
          <ul className={styles.ingredients} aria-label="Ingredients">{selected.ingredients.map(i => <li key={i.key} data-short={i.have < i.need}>
            {i.icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={i.icon} alt="" width={22} height={22} />
            ) : <b aria-hidden="true" />}
            <span>{i.name}</span><output>{i.have}/{i.need}</output>
          </li>)}</ul>
          <button className={styles.craft} disabled={!selected.can_craft || busy} onClick={() => craft(selected)}>
            {selected.owned ? "Already yours" : busy ? "Crafting…" : "Craft"}
          </button>
        </div>}
      </div>
    </>}
    </IslandSheet>
  </>;
}
