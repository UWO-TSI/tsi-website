"use client";

/**
 * /dev/combat?view=progress|runes|kits|missions
 * Not product UI: the island agent owns the in-world HUD, sheets and combat
 * scene. This renders the rules and service outputs so the numbers can be
 * checked by eye.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ENEMIES } from "@/lib/combat/content";
import { RUNES, resample, scoreTrace, type Pt, type Rune, type Score, type TracePt } from "@/lib/combat/incantation";
import { SUBCLASSES } from "@/lib/combat/kits";
import { memoryCombatStore } from "@/lib/combat/memoryStore";
import { EVENT_XP, SESSION_XP, STAT_LABEL, STATS, xpForLevel } from "@/lib/combat/progression";
import * as C from "@/lib/combat/service";
import { damage, WEAPONS } from "@/lib/combat/weapons";
import { FAMILY_COLOR, type Family } from "@/lib/oracle/engine";

const ME = "00000000-0000-4000-8000-000000000001";
const HEX: Record<string, string> = { purple: "#8e6cc9", blue: "#4a8fd4", yellow: "#d9a93a", green: "#5e9e6a" };
const fam = (f: Family) => HEX[FAMILY_COLOR[f]];
const INK = "#293e3b";
const MUTED = "#607069";
const card: React.CSSProperties = { background: "#f8f7e9", color: INK, borderRadius: 20, padding: 18, border: "1px solid #5c746c40", boxShadow: "0 16px 40px #1c302c30" };
const h3: React.CSSProperties = { margin: "0 0 10px", fontSize: 13, letterSpacing: "0.08em", color: MUTED };

const noSub = () => () => {};
export default function CombatHarness() {
  const search = useSyncExternalStore(noSub, () => window.location.search, () => null);
  if (search === null) return null;
  const view = new URLSearchParams(search).get("view") ?? "progress";
  return (
    <main style={{ minHeight: "100dvh", padding: 20, background: "radial-gradient(circle at 50% 20%, #2f4a44, #121a19 75%)", fontFamily: "system-ui, sans-serif", color: INK }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        {view === "progress" ? <Progress /> : null}
        {view === "runes" ? <Runes /> : null}
        {view === "kits" ? <Kits /> : null}
        {view === "missions" ? <Missions /> : null}
      </div>
    </main>
  );
}

type Prog = Extract<Awaited<ReturnType<typeof C.getProgression>>, { ok: true }>["data"];
type Board = Extract<Awaited<ReturnType<typeof C.listMissions>>, { ok: true }>["data"];

// ── Progression, stats, weapons ─────────────────────────────────────────────
function Progress() {
  const [p, setP] = useState<Prog | null>(null);
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      const m = memoryCombatStore();
      m.setFamily(ME, "Warden");
      await m.store.grantXp(ME, 12_400, "admin", "demo", "demo-xp-1");
      await C.allocateStats(m.store, ME, { spirit: 11, arcana: 5, vitality: 4 });
      await C.reportWear(m.store, ME, "sword-driftwood", 58, true, "demo-wear-1");
      const r = await C.getProgression(m.store, ME);
      if (r.ok) setP(r.data);
    })();
  }, []);
  if (!p) return null;
  const levels = Array.from({ length: 20 }, (_, i) => i + 1);
  const max = xpForLevel(20);
  const W = 520, H = 220;
  const x = (l: number) => 30 + ((l - 1) / 19) * (W - 50);
  const y = (xp: number) => H - 26 - (xp / max) * (H - 50);
  const fox = ENEMIES.find((e) => e.key === "shadow-fox")!;
  const golem = ENEMIES.find((e) => e.key === "stone-golem")!;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
      <section style={card}>
        <h3 style={h3}>XP CURVE · 100·L + 25·L² TO NEXT</h3>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%" }}>
          <line x1={30} y1={H - 26} x2={W - 20} y2={H - 26} stroke="#5c746c55" />
          <polyline fill="none" stroke="#5e9e6a" strokeWidth={3} points={levels.map((l) => `${x(l)},${y(xpForLevel(l))}`).join(" ")} />
          {levels.map((l) => <circle key={l} cx={x(l)} cy={y(xpForLevel(l))} r={l === 10 ? 6 : 3} fill={l === 10 ? "#d9a93a" : "#5e9e6a"} />)}
          {[1, 5, 10, 15, 20].map((l) => <text key={l} x={x(l)} y={H - 8} fontSize={11} textAnchor="middle" fill={MUTED}>L{l}</text>)}
          <text x={x(10) + 10} y={y(xpForLevel(10)) - 8} fontSize={12} fill={INK} fontWeight={700}>Level 10 · {xpForLevel(10).toLocaleString()} XP · subclass</text>
          <text x={x(20) - 4} y={y(max) + 16} fontSize={11} textAnchor="end" fill={MUTED}>{max.toLocaleString()} XP</text>
        </svg>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <tbody>
            <Row k="Play sessions to level 10 (≈400 XP each)" v={`≈${Math.ceil(xpForLevel(10) / SESSION_XP)}`} />
            <Row k="Club event check-in" v={`+${EVENT_XP.toLocaleString()} XP`} />
            <Row k="Sessions to 10 with two club events" v={`≈${Math.ceil((xpForLevel(10) - 2 * EVENT_XP) / SESSION_XP)}`} />
            <Row k="Stat points per level" v="3 (max level 50)" />
          </tbody>
        </table>
      </section>

      <section style={card}>
        <h3 style={h3}>CHARACTER SHEET · WARDEN</h3>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <b style={{ fontSize: 26 }}>Level {p.level}</b>
          <span style={{ color: MUTED, fontSize: 13 }}>{p.xp.toLocaleString()} XP · {p.into.toLocaleString()} / {p.needed.toLocaleString()} to {p.level + 1}</span>
        </div>
        <Bar value={p.into / Math.max(1, p.needed)} color="#5e9e6a" />
        <p style={{ margin: "12px 0 6px", fontWeight: 700 }}>{p.points_available} points to spend</p>
        {STATS.map((s) => (
          <div key={s} style={{ display: "grid", gridTemplateColumns: "84px 1fr 34px 60px", alignItems: "center", gap: 8, fontSize: 13, margin: "4px 0" }}>
            <span>{STAT_LABEL[s]}</span>
            <Bar value={p.stats[s] / 20} color={fam("Warden")} />
            <b style={{ textAlign: "right" }}>{p.stats[s]}</b>
            <span style={{ color: MUTED, fontSize: 11 }}>preset {p.preset?.at_level[s]}</span>
          </div>
        ))}
        <p style={{ fontSize: 12, color: MUTED, margin: "10px 0" }}>
          HP {p.derived.max_hp} · energy {p.derived.energy} · crit {(p.derived.crit_chance * 100).toFixed(1)}% · summons {p.derived.summon_capacity} · reset {p.fees.stat_reset} coins
        </p>
        <h3 style={{ ...h3, marginTop: 12 }}>SUBCLASS (FIRST CHOICE FREE, CHANGE {p.fees.subclass_change} COINS)</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
          {p.subclass_choices.map((s) => (
            <div key={s.key} style={{ border: `1.5px solid ${fam("Warden")}`, borderRadius: 12, padding: 8, fontSize: 12, background: "#fff" }}>
              <b>{s.name}</b>
              <div style={{ color: MUTED }}>{s.signature.name}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={card}>
        <h3 style={h3}>WEAPONS · DURABILITY</h3>
        {p.weapons.map((w) => (
          <div key={w.weapon_key} style={{ margin: "0 0 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <b>{w.name} {w.equipped ? <span style={{ color: MUTED, fontWeight: 500 }}>· equipped</span> : null}</b>
              <span>{w.durability} / {w.max_durability}</span>
            </div>
            <Bar value={w.durability / w.max_durability} color={w.broken ? "#c0533f" : w.durability / w.max_durability < 0.3 ? "#d9a93a" : "#5e9e6a"} />
            <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>
              {w.broken ? "Broken: half damage until repaired. " : ""}{w.repair_cost > 0 ? `Repair ${w.repair_cost} coins` : "Full"}
            </div>
          </div>
        ))}
        <p style={{ fontSize: 12, color: MUTED }}>Sword wear shown: 58 hits + one defeat (−9, 10% of max). Defeat costs durability only.</p>
      </section>

      <section style={card}>
        <h3 style={h3}>DAMAGE PER HIT · LEVEL {p.level}, THESE STATS</h3>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ color: MUTED, textAlign: "left", fontSize: 12 }}><th>Weapon</th><th>vs {fox.name}</th><th>vs {golem.name}</th><th style={{ paddingRight: 8 }}>crit</th><th>broken</th></tr>
          </thead>
          <tbody>
            {["sword-driftwood", "staff-oak", "tome-spirits", "staff-rune"].map((k) => {
              const wpn = WEAPONS.find((w) => w.key === k)!;
              const base = { weapon: wpn, durability: 10, stats: p.stats, level: p.level };
              return (
                <tr key={k} style={{ borderTop: "1px solid #5c746c22" }}>
                  <td>{wpn.name} <span style={{ color: MUTED }}>T{wpn.tier}</span></td>
                  <td>{damage({ ...base, enemyDefense: fox.defense })}</td>
                  <td>{damage({ ...base, enemyDefense: golem.defense })}</td>
                  <td>{damage({ ...base, enemyDefense: fox.defense, crit: true })}</td>
                  <td>{damage({ ...base, durability: 0, enemyDefense: fox.defense })}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: MUTED }}>Fox {fox.hp} HP · golem {golem.hp} HP, defense {golem.defense * 100}%</p>
      </section>
    </div>
  );
}

// ── Incantations ─────────────────────────────────────────────────────────────
/** noise: per-point jitter; wobble: a slow drift off the line (a real unsteady hand). */
function traceOf(strokes: Pt[][], opts: { noise?: number; wobble?: number; ms?: number } = {}): TracePt[][] {
  let t = 0;
  let i = 0;
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
  const n = opts.noise ?? 0;
  const w = opts.wobble ?? 0;
  return strokes.map((s) =>
    resample(s, 0.01).map((p) => {
      i += 1;
      return { x: p.x + rnd() * n + w * Math.sin(i * 0.33), y: p.y + rnd() * n + w * Math.cos(i * 0.26), t: (t += opts.ms ?? 8) };
    }),
  );
}
function samples(rune: Rune): { label: string; trace: TracePt[][] }[] {
  const zig: Pt[] = [];
  for (let i = 0; i <= 20; i++) zig.push({ x: i % 2 ? 0.95 : 0.05, y: i / 20 });
  const first = rune.strokes[0];
  return [
    { label: "Clean", trace: traceOf(rune.strokes, { noise: 0.02 }) },
    { label: "Wobbly", trace: traceOf(rune.strokes, { noise: 0.02, wobble: 0.04 }) },
    { label: "Jittery", trace: traceOf(rune.strokes, { noise: 0.09 }) },
    { label: "Half drawn", trace: traceOf(rune.strokes.length > 1 ? rune.strokes.slice(0, 1) : [first.slice(0, 3)], { noise: 0.02 }) },
    { label: "Wrong order", trace: traceOf(rune.strokes.length > 1 ? [...rune.strokes].reverse() : [[...first].reverse()], { noise: 0.02 }) },
    { label: "Scribble", trace: traceOf([zig], { ms: 1 }) },
    { label: "Too slow", trace: traceOf(rune.strokes, { noise: 0.02, ms: 60 }) },
  ];
}
const OUT_COLOR: Record<Score["outcome"], string> = { enhanced: "#d9a93a", cast: "#5e9e6a", fizzle: "#c0533f", timeout: "#8a8a8a" };

function Runes() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {RUNES.map((rune) => (
        <section key={rune.key} style={card}>
          <h3 style={h3}>{rune.name.toUpperCase()} · {rune.difficulty.toUpperCase()} · {rune.strokes.length} STROKE{rune.strokes.length > 1 ? "S" : ""} · {rune.time_limit_ms / 1000}s LIMIT</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: 8 }}>
            {samples(rune).map(({ label, trace }) => {
              const s = scoreTrace(rune, trace);
              return (
                <div key={label} style={{ background: "#fff", borderRadius: 14, padding: 8, border: `2px solid ${OUT_COLOR[s.outcome]}` }}>
                  <svg viewBox="0 0 1 1" style={{ width: "100%", aspectRatio: "1", background: "#f1efdf", borderRadius: 10 }}>
                    {rune.strokes.map((st, i) => <polyline key={i} fill="none" stroke="#b9b39a" strokeWidth={0.05} strokeLinecap="round" strokeLinejoin="round" points={st.map((p) => `${p.x},${p.y}`).join(" ")} />)}
                    {rune.strokes.map((st, i) => <text key={`n${i}`} x={st[0].x} y={st[0].y - 0.03} fontSize={0.06} fill="#8b8468" textAnchor="middle">{i + 1}</text>)}
                    {trace.map((st, i) => <polyline key={`t${i}`} fill="none" stroke="#4a3f7a" strokeWidth={0.012} strokeLinecap="round" points={st.map((p) => `${p.x},${p.y}`).join(" ")} />)}
                  </svg>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 13 }}>
                    <b>{label}</b>
                    <b style={{ color: OUT_COLOR[s.outcome] }}>{s.outcome}</b>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{s.accuracy}<span style={{ fontSize: 12, color: MUTED }}> / 100 · ×{s.potency}</span></div>
                  <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.45 }}>
                    cover {pct(s.parts.coverage)} · close {pct(s.parts.closeness)} · order {pct(s.parts.order)}<br />ink ×{s.parts.ink_ratio.toFixed(2)} · off path {pct(s.parts.off_path)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <p style={{ color: "#dfe6dc", fontSize: 12, margin: 0 }}>Accuracy = 45% coverage + 35% closeness + 20% stroke order, times an ink penalty. Under 50 fizzles; 50 to 94 casts at ×0.5 to ×1; 95+ is enhanced (×1.5).</p>
    </div>
  );
}
const pct = (n: number) => `${Math.round(n * 100)}%`;

// ── Subclass kits ────────────────────────────────────────────────────────────
function Kits() {
  const families: Family[] = ["Arcane", "Ranger", "Vanguard", "Warden"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
      {families.map((f) => (
        <section key={f} style={{ ...card, padding: 14, borderTop: `6px solid ${fam(f)}` }}>
          <h3 style={{ ...h3, color: fam(f) }}>{f.toUpperCase()}</h3>
          {SUBCLASSES.filter((s) => s.family === f).map((s) => (
            <div key={s.key} style={{ background: "#fff", borderRadius: 12, padding: 10, marginBottom: 8, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <b style={{ fontSize: 14 }}>{s.name}</b>
                <span style={{ color: MUTED }}>{s.weapon_affinity.join(" / ")}</span>
              </div>
              <div style={{ marginTop: 4 }}>
                <b>{s.signature.name}</b> · {s.signature.cooldown_s}s · {s.signature.energy} energy · ×{s.signature.power}
                {s.signature.incantation ? <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 8, background: "#ece4f7", color: "#5b4a86" }}>rune: {s.signature.incantation}</span> : null}
              </div>
              <div style={{ color: MUTED }}>{s.signature.description}</div>
              <div style={{ marginTop: 4 }}><b>{s.passive.name}</b> ({s.passive.value}) <span style={{ color: MUTED }}>{s.passive.description}</span></div>
              {s.starter_note ? <div style={{ marginTop: 4, color: "#8a5a1e" }}>{s.starter_note}</div> : null}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

// ── Mission board ────────────────────────────────────────────────────────────
function Missions() {
  const [board, setBoard] = useState<Board | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const m = useMemo(() => memoryCombatStore(), []);
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      const now = new Date();
      const lines: string[] = [];
      const start = async (k: string) => {
        const r = await C.startMission(m.store, ME, k, `demo-${k}`, now);
        return r.ok ? r.data.progress_id : "";
      };
      const fox = await start("hunt-foxes");
      const kills = Array.from({ length: 6 }, (_, i) => ({ id: `k${i}`, type: "kill" as const, enemy: "shadow-fox" }));
      await C.missionProgress(m.store, ME, fox, kills);
      await C.missionProgress(m.store, ME, fox, kills); // retried batch: no double count
      const a = await C.completeMission(m.store, ME, fox);
      const b = await C.completeMission(m.store, ME, fox);
      if (a.ok && b.ok) lines.push(`Fox trouble turned in twice: +${a.data.xp_awarded} XP, +${a.data.coins_awarded} coins, second call replayed=${b.data.replayed}. Wallet ${m.coinsOf(ME)} coins.`);
      const crab = await start("hunt-crabs");
      await C.missionProgress(m.store, ME, crab, kills.slice(0, 3).map((k) => ({ ...k, enemy: "thorn-crab" })));
      const lantern = await start("fetch-lantern");
      await C.missionProgress(m.store, ME, lantern, [{ id: "p1", type: "pickup", item: "old-lantern" }]);
      const circle = await start("survive-circle");
      await C.missionProgress(m.store, ME, circle, [1, 2, 3].map((w) => ({ id: `w${w}`, type: "wave_cleared" as const, wave: w })));
      const walk = await start("escort-botanist");
      const esc = await C.missionProgress(m.store, ME, walk, [{ id: "c1", type: "checkpoint", n: 1 }, { id: "d1", type: "escort_down" }]);
      if (esc.ok) lines.push(`The botanist's walk: checkpoint 1, then the botanist went down → ${esc.data.state}. Restartable now.`);
      const again = await C.startMission(m.store, ME, "hunt-foxes", "demo-again", now);
      if (!again.ok) lines.push(`Starting Fox trouble again: "${again.error}"`);
      const r = await C.listMissions(m.store, ME, now);
      if (r.ok) setBoard(r.data);
      setLog(lines);
    })();
  }, [m]);
  if (!board) return null;
  const T_COLOR: Record<string, string> = { hunt: "#c0533f", fetch: "#4a8fd4", survive: "#8e6cc9", escort: "#5e9e6a" };
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section style={card}>
        <h3 style={h3}>MISSION BOARD · 10 MISSIONS · 4 TEMPLATES</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
          {board.map((d) => {
            const state = d.open ? d.open.state : d.cooldown_until ? "cooldown" : "available";
            const pr = d.open?.progress;
            const goal = Number(d.params.count ?? d.params.waves ?? d.params.checkpoints ?? 0);
            return (
              <div key={d.key} style={{ background: "#fff", borderRadius: 14, padding: 10, borderLeft: `5px solid ${T_COLOR[d.template]}`, opacity: state === "cooldown" ? 0.6 : 1 }}>
                <div style={{ fontSize: 11, color: T_COLOR[d.template], fontWeight: 800, letterSpacing: "0.06em" }}>{d.template.toUpperCase()} · {d.zone.toUpperCase()}</div>
                <b style={{ fontSize: 15 }}>{d.title}</b>
                <div style={{ fontSize: 12, color: MUTED }}>{Object.entries(d.params).map(([k, v]) => `${k} ${v}`).join(" · ")}</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>{d.rewards.xp} XP · {d.rewards.coins} coins</div>
                <div style={{ fontSize: 12, marginTop: 6, fontWeight: 700 }}>
                  {state === "available" ? "Available" : null}
                  {state === "cooldown" ? `Cooldown until ${new Date(d.cooldown_until!).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}` : null}
                  {state === "active" ? `Active · ${d.template === "fetch" ? (pr?.carrying ? "carrying the item" : "find the item") : `${pr?.counter ?? 0} / ${goal}`}` : null}
                  {state === "ready" ? "Ready to turn in" : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section style={card}>
        <h3 style={h3}>IDEMPOTENCY LOG</h3>
        {log.map((l) => <p key={l} style={{ margin: "4px 0", fontSize: 13 }}>{l}</p>)}
      </section>
    </div>
  );
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 8, borderRadius: 4, background: "#e4e8dc", overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: "100%", background: color }} />
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr style={{ borderTop: "1px solid #5c746c22" }}>
      <td style={{ padding: "5px 0" }}>{k}</td>
      <td style={{ textAlign: "right", fontWeight: 700 }}>{v}</td>
    </tr>
  );
}
