"use client";

/**
 * The world editor (/lab/world; specs/world-editor.md). Minecraft creative mode over the game's own render of the smooth
 * world: fly, aim the crosshair, left-click lowers or removes, right-click raises or places. The hotbar's nine slots
 * hold tools and things to place (1–9; E opens the palette to fill a slot); B toggles cell and brush modes. Edits are
 * undoable (Ctrl+Z, Ctrl+Shift+Z) and saved to web/data/world through the dev route (Ctrl+S); "walk it" (P) drops into
 * the game at the camera with what is on screen, saved or not.
 */
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { PROPOSALS, pendingOf } from "@/lib/game/proposals";
import { setVillage } from "@/lib/game/villageMap";
import { decodeWorld, fromBase64, type WorldDoc } from "@/lib/game/world/format";
import { PALETTE, type EditorItem } from "@/lib/game/world/editorTools";
import { PAINT_SWATCH, cellMapOf, terrainHeight, type WorldTerrain } from "@/lib/game/world/terrain";
import { villageOfWorld } from "@/lib/game/world/village";
import type { IslandMap } from "@/lib/game/grid";
import EditorCanvas, { input, pose } from "./EditorScene";
import {
  acceptProposals, bakeShore, beginStroke, bump, deleteSelected, ed, endStroke, item, loadHotbar, rotate, save, say, scaleSelected, selectSlot,
  selectedObject, setSlotItem, undo, useEditor,
} from "./editorStore";

const DefaultIslandWorld = dynamic(() => import("@/components/game/DefaultIslandWorld"), { ssr: false, loading: () => <p style={{ padding: 32 }}>Preparing the walk…</p> });

const MONO = "ui-monospace, Menlo, monospace";
const PANEL = { background: "rgba(11,14,20,0.82)", color: "#f1ffff", font: `12px ${MONO}`, borderRadius: 6, padding: "6px 10px" } as const;
const MOVE_KEYS = new Set(["w", "a", "s", "d", " ", "q"]);

const itemTag = (it: EditorItem) => (it.type === "brush" ? "tool" : it.type === "paint" ? "paint" : it.type === "road" ? "road" : it.type === "select" ? "select" : it.object.kind === "landmark" || it.object.kind === "house" ? "building" : "place");

function Swatch({ it }: { it: EditorItem }) {
  const color = it.type === "paint" ? `rgb(${PAINT_SWATCH[it.paint].join(",")})` : it.type === "road" ? "#ba9664" : it.type === "brush" ? "#7fd1c0" : it.type === "select" ? "#ffd166" : "#ff8f4a";
  return <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: color, marginRight: 4, verticalAlign: "middle" }} />;
}

function Hotbar() {
  useEditor();
  return <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 4, zIndex: 20 }}>
    {ed.hotbar.map((it, i) => (
      <button key={i} onClick={() => selectSlot(i)} style={{ ...PANEL, width: 92, height: 54, textAlign: "left", cursor: "pointer", border: i === ed.slot ? "2px solid #ffd166" : "2px solid rgba(255,255,255,0.15)", padding: "4px 6px" }}>
        <div style={{ color: "#8a939a", fontSize: 10 }}>{i + 1} · {itemTag(it)}</div>
        <div style={{ fontSize: 11, lineHeight: 1.2 }}><Swatch it={it} />{it.label}</div>
      </button>
    ))}
  </div>;
}

function Palette() {
  useEditor();
  if (!ed.palette) return null;
  return <div style={{ position: "absolute", inset: "60px 10% 90px", zIndex: 30, ...PANEL, padding: 16, overflow: "auto" }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
      <b style={{ color: "#ffd166" }}>Palette: click an item to put it in slot {ed.slot + 1} (1–9 picks the slot)</b>
      <button onClick={() => { ed.palette = false; bump(); }} style={{ ...PANEL, cursor: "pointer" }}>Close (E)</button>
    </div>
    {PALETTE.map(g => <div key={g.group} style={{ marginBottom: 10 }}>
      <div style={{ color: "#7fd1c0", margin: "4px 0" }}>{g.group}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {g.items.map(it => <button key={it.label} onClick={() => setSlotItem(ed.slot, it)}
          style={{ ...PANEL, cursor: "pointer", border: ed.hotbar[ed.slot].label === it.label ? "1px solid #ffd166" : "1px solid rgba(255,255,255,0.15)" }}><Swatch it={it} />{it.label}</button>)}
      </div>
    </div>)}
  </div>;
}

const CONTROLS: [string, string][] = [
  ["Click the view", "fly (pointer lock); Esc lets go"], ["WASD · Space · Shift", "fly; Space up, Shift down; hold Q to go faster"],
  ["Left click", "lower / remove (hold to keep going)"], ["Right click", "raise / place (hold to keep going)"],
  ["1–9", "hotbar slot"], ["E", "palette: choose what the slot holds"], ["B", "cell mode ⇄ brush mode"],
  ["Scroll", "brush size (cell mode: N × N)"], ["Shift + scroll", "strength (cell mode: the step)"], ["H", "hard edge ⇄ soft (banks, quays)"],
  ["Alt + click · middle click", "sample the level height"], ["R · Shift + R", "turn the ghost or the selection"], ["+ · −", "scale the selection"],
  ["Delete · X", "delete the selection"], ["Ctrl+Z · Ctrl+Shift+Z", "undo · redo"], ["O · Tab", "overhead view"], ["Ctrl+S", "save to web/data/world"],
  ["P", "walk it: play from the camera"], ["?", "these controls"],
];

function Info({ onWalk, onSave }: { onWalk: () => void; onSave: () => void }) {
  useEditor();
  const it = item(), sel = selectedObject(), cell = ed.mode === "cell";
  const pending = PROPOSALS.filter(p => p.target === "world-map").map((p, i) => ({ p, i, n: pendingOf(p, ed.objects).length })).filter(x => x.n);
  return <>
    <div style={{ position: "absolute", top: 8, left: 8, zIndex: 20, ...PANEL, maxWidth: 520 }}>
      <div><b style={{ color: "#ffd166" }}>WORLD EDITOR</b> · <b>{cell ? "Cell mode" : "Brush mode"}</b> (B) · {it.label}{ed.dirty ? <span style={{ color: "#ff8f6a" }}> · unsaved</span> : ""}</div>
      <div style={{ color: "#c9d1d6" }}>
        {cell ? `square ${ed.cellN} × ${ed.cellN} · step ${ed.cellStep.toFixed(2)}` : `size ${ed.radius.toFixed(1)} · strength ${ed.strength.toFixed(2)} · ${ed.hard ? "hard edge" : "soft edge"}`}
        {ed.levelTarget !== null ? ` · level ${ed.levelTarget.toFixed(2)}` : ""}{ed.road ? " · laying a road" : ""}
      </div>
      <div style={{ color: "#8a939a" }}>
        {ed.hit ? `aim ${ed.hit.x.toFixed(1)}, ${ed.hit.z.toFixed(1)} · height ${ed.hit.y.toFixed(2)}` : "aim: sky"} · {ed.stats.fps} FPS (worst {ed.stats.frameMs} ms{ed.stats.editMs ? `, edit ${ed.stats.editMs} ms` : ""}) · {ed.stats.draws} draws · {(ed.stats.triangles / 1000).toFixed(0)}k tris · undo {ed.history.depth}
      </div>
      {sel && <div style={{ color: "#ffd166" }}>selected {sel.kind} {sel.id}{sel.model ? ` (${sel.model})` : ""} · R turn · +/− scale · X delete · right-drag moves</div>}
    </div>
    <div style={{ position: "absolute", top: 8, right: 8, zIndex: 20, display: "flex", gap: 6 }}>
      <button onClick={onSave} style={{ ...PANEL, cursor: "pointer", color: ed.dirty ? "#ffd166" : "#c9d1d6" }}>{ed.saving ? "Saving…" : "Save (Ctrl+S)"}</button>
      <button onClick={onWalk} style={{ ...PANEL, cursor: "pointer" }}>Walk it (P)</button>
      <button onClick={() => { ed.overhead = !ed.overhead; bump(); }} style={{ ...PANEL, cursor: "pointer" }}>{ed.overhead ? "Fly view (O)" : "Overhead (O)"}</button>
      <button onClick={() => { ed.help = !ed.help; bump(); }} style={{ ...PANEL, cursor: "pointer" }}>?</button>
    </div>
    {pending.length > 0 && <div style={{ position: "absolute", top: 50, right: 8, zIndex: 20, ...PANEL, maxWidth: 300 }}>
      <div style={{ color: "#7fd1c0" }}>Proposals waiting for you</div>
      {pending.map(({ p, i, n }) => <div key={p.title}>{p.title}: {n} <button onClick={() => acceptProposals(i)} style={{ ...PANEL, padding: "1px 6px", cursor: "pointer" }}>Accept</button></div>)}
    </div>}
    {ed.help && <div style={{ position: "absolute", bottom: 80, left: 8, zIndex: 20, ...PANEL, maxWidth: 420 }}>
      {CONTROLS.map(([k, v]) => <div key={k}><span style={{ color: "#ffd166", display: "inline-block", minWidth: 150 }}>{k}</span>{v}</div>)}
    </div>}
    {ed.status && <div style={{ position: "absolute", bottom: 76, right: 8, zIndex: 20, ...PANEL }}>{ed.status}</div>}
    {!ed.locked && !ed.palette && !ed.overhead && <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, 40px)", zIndex: 15, ...PANEL, pointerEvents: "none" }}>Click the view to fly · Esc to let go</div>}
    <div style={{ position: "absolute", top: "50%", left: "50%", width: 16, height: 16, marginLeft: -8, marginTop: -8, zIndex: 15, pointerEvents: "none" }}>
      <div style={{ position: "absolute", left: 7, top: 0, width: 2, height: 16, background: "rgba(255,255,255,0.9)" }} />
      <div style={{ position: "absolute", top: 7, left: 0, width: 16, height: 2, background: "rgba(255,255,255,0.9)" }} />
    </div>
  </>;
}

export default function WorldEditor() {
  const [loaded, setLoaded] = useState<{ terrain: WorldTerrain; ocean: IslandMap } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [walking, setWalking] = useState(false);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);

  // Load the files through the dev route (never the bundled copy: a save would hot-reload this page).
  useEffect(() => {
    let live = true;
    loadHotbar();
    fetch("/api/lab/world", { cache: "no-store" }).then(r => r.json()).then((body: { json?: string; height?: string; surface?: string; error?: string }) => {
      if (!live) return;
      if (body.error || !body.json || !body.height || !body.surface) throw new Error(body.error ?? "the world didn't load");
      const world = decodeWorld(JSON.parse(body.json) as WorldDoc, fromBase64(body.height), fromBase64(body.surface));
      ed.world = world;
      ed.objects = world.objects;
      bakeShore();
      const spawn = world.objects.find(o => o.kind === "spawn" && o.id === "default");
      if (spawn) { pose.x = spawn.x + 8; pose.z = spawn.z - 10; pose.y = terrainHeight(world.terrain, spawn.x, spawn.z) + 14; pose.over.x = spawn.x; pose.over.z = spawn.z; }
      setLoaded({ terrain: world.terrain, ocean: cellMapOf(world.terrain) });
    }).catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
  }, []);

  const walk = useCallback(() => {
    if (!ed.world) return;
    endStroke();
    if (document.pointerLockElement) document.exitPointerLock();
    // Drop in where the camera is (over the sea: where it is aimed).
    const t = ed.world.terrain, over = terrainHeight(t, ed.camera.x, ed.camera.z) > t.seaLevel ? ed.camera : ed.hit ?? ed.camera;
    setVillage(villageOfWorld({ terrain: t, objects: ed.objects, annotations: ed.world.annotations }));
    const q = new URLSearchParams(window.location.search);
    q.set("at", `${over.x.toFixed(1)},${over.z.toFixed(1)}`);
    window.history.replaceState(null, "", `?${q}`);
    ed.walking = true;
    setWalking(true);
  }, []);
  const back = useCallback(() => {
    const q = new URLSearchParams(window.location.search);
    q.delete("at");
    window.history.replaceState(null, "", `?${q}`);
    ed.walking = false;
    setWalking(false);
  }, []);
  const doSave = useCallback(() => { void save(); }, []);

  // Keys, the mouse and pointer lock.
  useEffect(() => {
    if (!loaded || walking) return;
    const down = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key, mod = e.ctrlKey || e.metaKey;
      if (mod && key === "s") { e.preventDefault(); void save(); return; }
      if (mod && key === "z") { e.preventDefault(); undo(e.shiftKey); return; }
      if (mod && key === "y") { e.preventDefault(); undo(true); return; }
      if (mod) return;
      if (MOVE_KEYS.has(key) || key === "Shift") { input.keys.add(key); if (key === " ") e.preventDefault(); return; }
      if (/^[1-9]$/.test(key)) { selectSlot(Number(key) - 1); return; }
      if (key === "e") { ed.palette = !ed.palette; if (ed.palette && document.pointerLockElement) document.exitPointerLock(); bump(); return; }
      if (key === "Escape" && ed.palette) { ed.palette = false; bump(); return; }
      if (key === "b") { ed.mode = ed.mode === "brush" ? "cell" : "brush"; say(ed.mode === "cell" ? "Cell mode: whole cells, a step at a time" : "Brush mode: soft round tools"); return; }
      if (key === "h") { ed.hard = !ed.hard; bump(); return; }
      if (key === "o" || key === "Tab") { e.preventDefault(); ed.overhead = !ed.overhead; bump(); return; }
      if (key === "r") { rotate((e.shiftKey ? -1 : 1) * Math.PI / 12); return; }
      if (key === "=" || key === "+") { scaleSelected(1.1); return; }
      if (key === "-" || key === "_") { scaleSelected(1 / 1.1); return; }
      if (key === "Delete" || key === "Backspace" || key === "x") { deleteSelected(); return; }
      if (key === "p") { walk(); return; }
      if (key === "?" || key === "F1") { e.preventDefault(); ed.help = !ed.help; bump(); return; }
    };
    const up = (e: KeyboardEvent) => { const key = e.key.length === 1 ? e.key.toLowerCase() : e.key; input.keys.delete(key); };
    const blur = () => { input.keys.clear(); endStroke(); };
    const el = canvas;
    const mouseDown = (e: MouseEvent) => {
      if (ed.palette) return;
      if (!ed.locked && !ed.overhead) { el?.requestPointerLock(); return; }
      if (e.button === 1) { e.preventDefault(); beginStroke(0, true); return; }
      if (e.button === 0 || e.button === 2) beginStroke(e.button as 0 | 2, e.altKey);
    };
    const mouseUp = () => endStroke();
    const move = (e: MouseEvent) => { if (ed.locked) { input.dx += e.movementX; input.dy += e.movementY; } };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const d = Math.sign(e.deltaY || e.deltaX), cell = ed.mode === "cell";
      if (e.shiftKey) {
        if (cell) ed.cellStep = Math.max(0.25, Math.min(3, Math.round((ed.cellStep - d * 0.25) * 4) / 4));
        else ed.strength = Math.max(0.05, Math.min(1, Math.round((ed.strength - d * 0.05) * 100) / 100));
      } else if (cell) ed.cellN = Math.max(1, Math.min(9, ed.cellN - d));
      else ed.radius = Math.max(0.5, Math.min(40, Math.round((ed.radius * (d > 0 ? 1 / 1.15 : 1.15)) * 10) / 10));
      bump();
    };
    const lock = () => { ed.locked = document.pointerLockElement === el; if (!ed.locked) endStroke(); bump(); };
    const menu = (e: Event) => e.preventDefault();
    const beforeUnload = (e: BeforeUnloadEvent) => { if (ed.dirty) e.preventDefault(); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("pointerlockchange", lock);
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", mouseUp);
    el?.addEventListener("mousedown", mouseDown);
    el?.addEventListener("wheel", wheel, { passive: false });
    el?.addEventListener("contextmenu", menu);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("pointerlockchange", lock);
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", mouseUp);
      el?.removeEventListener("mousedown", mouseDown);
      el?.removeEventListener("wheel", wheel);
      el?.removeEventListener("contextmenu", menu);
    };
  }, [loaded, walking, walk, canvas]);

  // The automation hook (the evidence shots drive the editor headless, where there is no pointer lock).
  useEffect(() => {
    (window as unknown as { __worldEditor?: unknown }).__worldEditor = { ed, pose, input, beginStroke, endStroke, selectSlot, setSlotItem, undo, palette: PALETTE, bump };
  }, []);

  if (error) return <p style={{ padding: 32, font: `14px ${MONO}`, color: "#ff8f6a" }}>The world editor could not load web/data/world: {error}</p>;
  if (!loaded) return <p style={{ padding: 32, font: `14px ${MONO}` }}>Loading the world…</p>;
  if (walking) return <div style={{ position: "fixed", inset: "40px 0 0 0" }}>
    <button onClick={back} style={{ ...PANEL, position: "fixed", top: 48, left: "50%", transform: "translateX(-50%)", zIndex: 400, cursor: "pointer", color: "#ffd166" }}>Back to the editor</button>
    <DefaultIslandWorld />
  </div>;
  return <div style={{ position: "fixed", inset: "40px 0 0 0", background: "#0b0e14", userSelect: "none" }}>
    <EditorCanvas terrain={loaded.terrain} ocean={loaded.ocean} onCanvas={setCanvas} />
    <Info onWalk={walk} onSave={doSave} />
    <Hotbar />
    <Palette />
  </div>;
}
