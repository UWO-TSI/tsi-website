"use client";

/**
 * Crafting in the world (specs/crafting.md §4): the DIY workbench in the
 * clubhouse with its E prompt, the recipe sheet (learned recipes, ingredient
 * counts owned/needed, craft, result card) and today's message bottle on the
 * village beach. Branch drops and rock strikes are forage nodes (islandNodes).
 * Everything goes through /api/crafting; the server decides what you get.
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Piece } from "../interiorShared";
import { GLBProp } from "../NatureModels";
import { AudioManager } from "@/lib/game/audio";
import { constrainClubhouse } from "@/lib/game/clubhouse";
import { villageBottleSpot } from "@/lib/game/islandNodes";
import { setPeacefulTarget } from "@/lib/game/peacefulNear";
import { worldTime } from "@/lib/game/worldClock";
import { installCraftingDemo } from "@/lib/crafting/demo";
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

// ── Workbench (clubhouse, against the west wall between the desk and the plants) ──

const BENCH = { x: -7.25, z: 1, halfX: 0.5, halfZ: 0.9 };
const BENCH_APPROACH: [number, number] = [BENCH.x + 1.25, BENCH.z];

/** The clubhouse's furniture collision plus the bench (member HQ only; the applicant HQ has no bench). */
export function constrainWorkshop(x: number, z: number, nx: number, nz: number): [number, number] {
  const c = constrainClubhouse(x, z, nx, nz);
  const blocked = Math.abs(c[0] - BENCH.x) < BENCH.halfX + 0.25 && Math.abs(c[1] - BENCH.z) < BENCH.halfZ + 0.25;
  if (blocked) { c[0] = x; c[1] = z; }
  return c;
}

export function Workbench({ player }: { player: React.RefObject<THREE.Vector3> }) {
  const near = useRef(false);
  useFrame(() => {
    const now = Math.hypot(player.current.x - BENCH_APPROACH[0], player.current.z - BENCH_APPROACH[1]) < 1.3;
    if (now !== near.current) { near.current = now; window.dispatchEvent(new CustomEvent("tsi:workbench-near", { detail: now })); }
  });
  useEffect(() => () => { window.dispatchEvent(new CustomEvent("tsi:workbench-near", { detail: false })); }, []);
  return <Suspense fallback={null}>
    <GLBProp url={`${P}workbench.glb`} scale={1.3} position={[BENCH.x, 0, BENCH.z]} rotation={[0, Math.PI / 2, 0]} />
    <GLBProp url={`${P}branch.glb`} scale={1.3} position={[BENCH.x - 0.1, 0.585, BENCH.z + 0.45]} rotation={[0, 0.4, 0]} />
    <Piece shadows name="cardboard-pile" position={[BENCH.x, 0, BENCH.z - 1.4]} rotY={Math.PI / 2} />
  </Suspense>;
}

// ── Message bottle (village beach, one a Toronto day) ──

export function BeachBottle({ player, ground }: { player: React.RefObject<THREE.Vector3>; ground: (x: number, z: number) => number }) {
  const [available, setAvailable] = useState(false);
  const spot = useMemo(() => villageBottleSpot(torontoDay(new Date())), []);
  const rock = useRef<THREE.Group>(null);
  const out = useRef(false); // read by the frame loop, so a pickup can't re-arm the prompt before React re-renders
  useEffect(() => { out.current = available; }, [available]);
  useEffect(() => {
    let alive = true;
    apiCall<RecipeBook>("/api/crafting/recipes", "book").then(b => { if (alive) setAvailable(b.bottle.available); }, () => {});
    const onAct = (e: Event) => {
      if ((e as CustomEvent<{ id: string }>).detail.id !== "bottle") return;
      out.current = false;
      setAvailable(false);
      apiCall<{ name: string }>("/api/crafting/learn", "learned", { source: "bottle" }).then(
        learned => { AudioManager.playSFX("confirm"); window.dispatchEvent(new CustomEvent("tsi:recipe-learned", { detail: { name: learned.name } })); },
        (e: unknown) => window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text: e instanceof ApiError ? e.message : "The cork won't budge. Try again later." } })));
    };
    window.addEventListener("tsi:peaceful-act", onAct);
    return () => { alive = false; window.removeEventListener("tsi:peaceful-act", onAct); setPeacefulTarget(null, "bottle"); };
  }, []);
  useFrame(() => {
    const d = Math.hypot(player.current.x - spot[0], player.current.z - spot[1]);
    setPeacefulTarget(out.current && d < 1.7 ? { id: "bottle", kind: "forage", label: "Open the message bottle", distance: d } : null, "bottle");
    if (rock.current) rock.current.rotation.x = Math.sin(worldTime() * 1.3) * 0.08;
  });
  if (!available) return null;
  return <group position={[spot[0], ground(spot[0], spot[1]) + 0.14, spot[1]]} rotation={[0, 0.8, 0]} scale={1.3}>
    <group ref={rock}><Suspense fallback={null}><GLBProp url={`${P}message-bottle.glb`} /></Suspense></group>
  </group>;
}

// ── Recipe sheet and result card ──

type Card = { title: string; name: string; note: string };

export default function CraftingSheet() {
  const [open, setOpen] = useState(false);
  const [near, setNear] = useState(false);
  const [book, setBook] = useState<RecipeBook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState<Card | null>(null);
  const pending = useRef<{ id: string; key: string } | null>(null); // a failed request retries with its key

  const load = useCallback(() => apiCall<RecipeBook>("/api/crafting/recipes", "book").then(
    b => { setBook(b); setError(null); },
    (e: unknown) => setError(e instanceof ApiError ? (e.status === 401 ? "Sign in to use the workbench." : e.message) : "The workbench isn't set up yet.")), []);
  const show = useCallback(() => { setOpen(true); setCard(null); void load(); }, [load]);

  useEffect(() => {
    const onNear = (e: Event) => setNear((e as CustomEvent<boolean>).detail);
    const onLearned = (e: Event) => setCard({ title: "Recipe learned", name: (e as CustomEvent<{ name: string }>).detail.name, note: "The tide brought you a new recipe. Craft it at the workbench in HQ." });
    window.addEventListener("tsi:workbench-near", onNear);
    window.addEventListener("tsi:recipe-learned", onLearned);
    return () => { window.removeEventListener("tsi:workbench-near", onNear); window.removeEventListener("tsi:recipe-learned", onLearned); };
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      // The open sheet takes E and Escape itself (lib/game/useWorldDialog); under any other dialog the bench waits.
      if (e.repeat || worldKeysBlocked() || isTyping(e.target as Element)) return;
      if (e.key.toLowerCase() === "e" && near && !open) show();
      if (e.key === "Escape") setCard(null);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [near, open, show]);

  const craft = async (r: RecipeView) => {
    if (busy) return;
    setBusy(true);
    if (pending.current?.id !== r.id) pending.current = { id: r.id, key: `craft:${newKey()}` };
    try {
      const done = await apiCall<{ name: string }>("/api/crafting/craft", "craft", { recipe_id: r.id, idempotency_key: pending.current.key });
      pending.current = null;
      AudioManager.playSFX("confirm");
      window.dispatchEvent(new CustomEvent("tsi:crafted", { detail: { id: r.id } }));
      setCard({ title: "Crafted", name: done.name, note: r.kind === "weapon" ? "It's in your gear rack for the ruins." : "It's in your pockets." });
      void load();
    } catch (e) {
      if (e instanceof ApiError) pending.current = null; // answered: the next press is a new craft
      setError(e instanceof ApiError ? e.message : "The workbench wobbled. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const selected = book?.recipes.find(r => r.id === pick) ?? book?.recipes[0] ?? null;
  const resultCard = card && <div className={styles.card} role="status" data-testid="craft-result">
    <p className={styles.cardTitle}>{card.title}</p>
    <p className={styles.cardName}>{card.name}</p>
    <p>{card.note}</p>
    <button onClick={() => setCard(null)}>Nice</button>
  </div>;

  return <>
    {!open && near && !card && <button className={world.interact} onClick={show}><kbd>E</kbd>Use the workbench</button>}
    {!open && resultCard}
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
    {resultCard}
    </IslandSheet>
  </>;
}
