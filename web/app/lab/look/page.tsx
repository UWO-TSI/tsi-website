"use client";

/**
 * /lab/look — look development bench (ledger row 235, specs/look-development.md §2).
 *
 * The real village (DefaultIslandWorld) with one LookPreset driving its
 * lighting, shadows, materials, grade, post and sky. A = the game as shipped
 * (no preset), B = the edited preset. Every value is on screen; "Copy preset
 * JSON" is what comes back into the repo. Dev-only via the lab layout.
 *
 * URL: ?preset=<id> or ?look=<json>, &ab=A. Capture scripts drive
 * window.__look(json) and window.__ab("A" | "B").
 */

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import LookRig, { type LookMetrics } from "@/components/lab/LookRig";
import { useGraphicsSettings } from "@/lib/game/useGraphicsSettings";
import {
  CURRENT, LOOK_PRESETS, MATERIAL_CLASSES, keyFill, kelvinHex, parseLook, sunAngles, sunFromAngles, type LookPreset,
} from "@/lib/game/lookPreset";

const DefaultIslandWorld = dynamic(() => import("@/components/game/DefaultIslandWorld"), { ssr: false });

type Row = { path: string; label: string; min?: number; max?: number; step?: number; kind?: "color" | "bool" };
const HIGH = " · High only";
const SECTIONS: { title: string; rows: Row[] }[] = [
  { title: "Light", rows: [
    { path: "light.sunIntensity", label: "Sun intensity", min: 0, max: 6, step: 0.05 },
    { path: "light.sunColor", label: "Sun colour", kind: "color" },
    { path: "light.fillSky", label: "Fill · sky", kind: "color" },
    { path: "light.fillGround", label: "Fill · ground bounce", kind: "color" },
    { path: "light.hemisphere", label: "Hemisphere", min: 0, max: 2, step: 0.01 },
    { path: "light.ambient", label: "Ambient", min: 0, max: 1, step: 0.01 },
    { path: "light.envIntensity", label: "Environment (IBL)", min: 0, max: 1.5, step: 0.01 },
    { path: "light.rimColor", label: "Rim colour", kind: "color" },
    { path: "light.rimIntensity", label: "Rim / back light", min: 0, max: 3, step: 0.05 },
  ] },
  { title: "Shadows", rows: [
    { path: "shadows.radius", label: "Softness (PCF radius)", min: 0, max: 12, step: 0.5 },
    { path: "shadows.intensity", label: "Opacity", min: 0, max: 1, step: 0.01 },
    { path: "shadows.tint", label: "Tint (black = none)", kind: "color" },
  ] },
  { title: "Ambient occlusion" + HIGH, rows: [
    { path: "ao.enabled", label: "N8AO on", kind: "bool" },
    { path: "ao.radius", label: "Radius", min: 0.2, max: 4, step: 0.1 },
    { path: "ao.intensity", label: "Intensity", min: 0, max: 5, step: 0.1 },
  ] },
  { title: "Materials", rows: MATERIAL_CLASSES.flatMap(c => [
    { path: `materials.${c}.saturation`, label: `${c} · saturation`, min: 0, max: 2, step: 0.01 },
    { path: `materials.${c}.value`, label: `${c} · value`, min: 0.5, max: 1.5, step: 0.01 },
    ...(c === "water" ? [] : [{ path: `materials.${c}.roughness`, label: `${c} · roughness ×`, min: 0.1, max: 2, step: 0.01 }]),
    { path: `materials.${c}.gloss`, label: c === "water" ? "water · sun glint +" : `${c} · toy gloss`, min: 0, max: 1, step: 0.01 },
  ]) },
  { title: "Post", rows: [
    { path: "grade.exposure", label: "Exposure", min: 0.3, max: 2, step: 0.01 },
    { path: "grade.desat", label: "Desaturation (− = saturate)", min: -0.6, max: 0.6, step: 0.005 },
    { path: "grade.vibrance", label: "Vibrance", min: -0.5, max: 1, step: 0.01 },
    { path: "grade.contrast", label: "Contrast", min: 0.6, max: 1.6, step: 0.01 },
    { path: "grade.warmth", label: "Warm (+) / cool (−)", min: -1.5, max: 1.5, step: 0.01 },
    { path: "grade.lift", label: "Black lift", min: 0, max: 1.5, step: 0.01 },
    { path: "grade.vignette", label: "Vignette", min: 0, max: 1, step: 0.01 },
    { path: "post.bloom.enabled", label: "Bloom" + HIGH, kind: "bool" },
    { path: "post.bloom.threshold", label: "Bloom threshold", min: 0, max: 2, step: 0.01 },
    { path: "post.bloom.intensity", label: "Bloom intensity", min: 0, max: 2, step: 0.01 },
    { path: "post.tiltShift.enabled", label: "Tilt-shift DOF" + HIGH, kind: "bool" },
    { path: "post.tiltShift.focusArea", label: "Focus band", min: 0, max: 1, step: 0.01 },
    { path: "post.tiltShift.feather", label: "Feather", min: 0, max: 1, step: 0.01 },
    { path: "post.tiltShift.offset", label: "Band offset", min: -0.5, max: 0.5, step: 0.01 },
  ] },
  { title: "Sky and air", rows: [
    { path: "sky.gradient", label: "Sky gradient", kind: "bool" },
    { path: "sky.top", label: "Sky top", kind: "color" },
    { path: "sky.horizon", label: "Sky horizon", kind: "color" },
    { path: "sky.fog", label: "Fog colour", kind: "color" },
    { path: "sky.fogNear", label: "Fog near", min: 0, max: 80, step: 1 },
    { path: "sky.fogFar", label: "Fog far", min: 10, max: 160, step: 1 },
  ] },
];

type Tree = Record<string, unknown>;
const get = (p: LookPreset, path: string) => path.split(".").reduce<unknown>((o, k) => (o as Tree)[k], p);
function withValue(p: LookPreset, path: string, value: unknown): LookPreset {
  const next = structuredClone(p), keys = path.split(".");
  (keys.slice(0, -1).reduce<unknown>((o, k) => (o as Tree)[k], next) as Tree)[keys.at(-1)!] = value;
  return next;
}

function initial(): LookPreset {
  const q = new URLSearchParams(window.location.search);
  try { if (q.get("look")) return parseLook(JSON.parse(q.get("look")!)); } catch { /* fall through to a named preset */ }
  return LOOK_PRESETS.find(p => p.id === q.get("preset")) ?? CURRENT;
}

const box: React.CSSProperties = { position: "absolute", left: 8, top: 8, bottom: 8, width: 300, zIndex: 150, overflowY: "auto", padding: 12,
  background: "rgba(11,14,20,0.9)", color: "#e8eef0", font: "11px 'IBM Plex Mono', monospace", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)" };
const btn: React.CSSProperties = { font: "inherit", padding: "5px 8px", borderRadius: 5, border: "1px solid rgba(255,255,255,0.2)", background: "#1d2530", color: "inherit", cursor: "pointer" };

export default function LookLab() {
  const [edited, setEdited] = useState<LookPreset>(CURRENT);
  const [ab, setAb] = useState<"A" | "B">("B");
  const [open, setOpen] = useState(true);
  const [metrics, setMetrics] = useState<Record<string, LookMetrics>>({});
  const [paste, setPaste] = useState("");
  const [graphics] = useGraphicsSettings();
  const slot = ab === "A" ? "A · game as shipped" : `B · ${edited.name}`;
  useEffect(() => {
    // One-time read of the URL once mounted on the client (the page is client-only).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEdited(initial()); if (new URLSearchParams(window.location.search).get("ab") === "A") setAb("A");
    const w = window as unknown as Tree;
    w.__look = (v: unknown) => setEdited(parseLook(v));
    w.__ab = (v: "A" | "B") => setAb(v);
    w.__metrics = () => metricsRef;
  }, []);
  const active = ab === "B" ? edited : undefined;
  const ratios = useMemo(() => keyFill(active ?? CURRENT), [active]);
  const sun = sunAngles(edited.light.sunPosition);
  const set = (path: string, value: unknown) => setEdited(p => withValue(p, path, value));
  const onMetrics = (m: LookMetrics) => { metricsRef[slot] = m; setMetrics({ ...metricsRef }); };

  return (
    <div style={{ position: "relative", width: "100%", height: "calc(100vh - 40px)", overflow: "hidden" }}>
      <DefaultIslandWorld preset={active}><LookRig preset={active ?? null} onMetrics={onMetrics} /></DefaultIslandWorld>
      {!open ? <button style={{ ...btn, position: "absolute", left: 8, top: 8, zIndex: 150 }} onClick={() => setOpen(true)}>Look lab</button> : (
        <aside style={box} aria-label="Look lab" data-look-panel>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <strong style={{ color: "#FFD166" }}>LOOK LAB</strong>
            <button style={btn} onClick={() => setOpen(false)}>Hide</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {LOOK_PRESETS.map(p => <button key={p.id} style={{ ...btn, borderColor: edited.id === p.id ? "#FFD166" : undefined }} onClick={() => { setEdited(p); setAb("B"); }}>{p.name}</button>)}
          </div>
          <div style={{ display: "flex", gap: 4, margin: "8px 0" }}>
            <button style={{ ...btn, flex: 1, background: ab === "A" ? "#426b5b" : btn.background }} onClick={() => setAb(v => (v === "A" ? "B" : "A"))} data-testid="ab">A/B: {ab}</button>
            <button style={{ ...btn, flex: 1 }} onClick={() => { const json = JSON.stringify(edited, null, 2); void navigator.clipboard?.writeText(json).catch(() => setPaste(json)); }}>Copy preset JSON</button>
          </div>
          <output style={{ display: "block", whiteSpace: "pre-line", lineHeight: 1.6, color: "#c9d1d6" }} data-testid="look-readout">
            {`${slot}\nkey ${ratios.key.toFixed(2)} · fill ${ratios.fill.toFixed(2)} → key:fill ${ratios.keyFill.toFixed(2)}:1\nlit:shadow ${ratios.litShadow.toFixed(2)}:1 (flat ground, linear)\n`}
            {Object.entries(metrics).map(([k, m]) => `${k}: ${m.fps} FPS · ${m.frameMs.toFixed(1)} ms · ${m.calls} draws · ${Math.round(m.triangles / 1000)}k tris`).join("\n")}
            {graphics.liteMode ? "\nLight tier: AO, tilt-shift and bloom are off." : ""}
          </output>
          <fieldset style={{ border: 0, padding: 0, margin: "10px 0 0" }}>
            <legend style={{ color: "#FFD166" }}>Sun</legend>
            <Slider label="Temperature (sets colour)" min={2000} max={10000} step={100} value={NaN} onChange={k => set("light.sunColor", kelvinHex(k))} />
            <Slider label="Elevation °" min={5} max={85} step={0.5} value={sun.elevation} onChange={e => set("light.sunPosition", sunFromAngles(e, sun.azimuth))} />
            <Slider label="Azimuth ° (0 = +x, 90 = +z)" min={-180} max={180} step={1} value={sun.azimuth} onChange={a => set("light.sunPosition", sunFromAngles(sun.elevation, a))} />
          </fieldset>
          {SECTIONS.map(section => <fieldset key={section.title} style={{ border: 0, padding: 0, margin: "10px 0 0" }}>
            <legend style={{ color: "#FFD166" }}>{section.title}</legend>
            {section.title === "Post" && <label style={{ display: "flex", justifyContent: "space-between" }}>Tone mapping
              <select value={edited.post.toneMapping} onChange={e => set("post.toneMapping", e.target.value)}>
                {["neutral", "aces", "agx"].map(t => <option key={t} value={t}>{t}</option>)}
              </select></label>}
            {section.rows.map(row => {
              const value = get(edited, row.path);
              if (row.kind === "color") return <label key={row.path} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>{row.label} <span>{String(value)} <input type="color" value={String(value)} onChange={e => set(row.path, e.target.value)} /></span></label>;
              if (row.kind === "bool") return <label key={row.path} style={{ display: "flex", justifyContent: "space-between" }}>{row.label}<input type="checkbox" checked={Boolean(value)} onChange={e => set(row.path, e.target.checked)} /></label>;
              return <Slider key={row.path} label={row.label} min={row.min!} max={row.max!} step={row.step!} value={Number(value)} onChange={v => set(row.path, v)} />;
            })}
          </fieldset>)}
          <details style={{ marginTop: 10 }}>
            <summary>Load preset JSON</summary>
            <textarea value={paste} onChange={e => setPaste(e.target.value)} rows={6} style={{ width: "100%", font: "inherit", background: "#0b0e14", color: "inherit" }} />
            <button style={btn} onClick={() => { try { setEdited(parseLook(JSON.parse(paste))); setAb("B"); } catch { setPaste("Not valid JSON."); } }}>Load</button>
          </details>
        </aside>
      )}
    </div>
  );
}

/** Last metrics per slot, readable by capture scripts without a render. */
const metricsRef: Record<string, LookMetrics> = {};

function Slider({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return <label style={{ display: "block", margin: "4px 0" }}>
    <span style={{ display: "flex", justifyContent: "space-between" }}>{label}<span>{Number.isNaN(value) ? "" : +value.toFixed(3)}</span></span>
    <input type="range" min={min} max={max} step={step} value={Number.isNaN(value) ? (min + max) / 2 : value} onChange={e => onChange(Number(e.target.value))} style={{ width: "100%" }} />
  </label>;
}
