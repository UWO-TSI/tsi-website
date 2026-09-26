"use client";

/**
 * /dev/oracle?view=quiz|tie|result|name|settings
 * Not product UI: the island agent builds the in-world quiz sheet, ceremony
 * and settings sheet. This renders the service outputs so the contract can
 * be checked by eye.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { memoryIdentityStore } from "@/lib/identity/memoryStore";
import { checkWorldName, setWorldName, updateSettings } from "@/lib/identity/service";
import { ACTION_LABEL, applySettings, DEFAULT_SETTINGS, MENU_ACTIONS, TEXT_SIZES, type AccountSettings } from "@/lib/identity/settings";
import { DICHOTOMIES, FAMILY_COLOR } from "@/lib/oracle/engine";
import { STATEMENTS } from "@/lib/oracle/items";
import { answerBatch, finishReading, startReading, type AttemptView, type FinishOutcome } from "@/lib/oracle/service";

const ME = "00000000-0000-4000-8000-000000000001";
const HEX: Record<string, string> = { purple: "#8e6cc9", blue: "#4a8fd4", yellow: "#d9a93a", green: "#5e9e6a" };
const LABELS = ["Strongly disagree", "Disagree", "Not sure", "Agree", "Strongly agree"];
const POLE_NAME: Record<string, string> = { E: "Outward", I: "Inward", S: "Concrete", N: "Abstract", T: "Logic", F: "Values", J: "Planned", P: "Open" };
const card: React.CSSProperties = { background: "#f8f7e9", color: "#293e3b", borderRadius: 20, padding: 20, border: "1px solid #5c746c40", boxShadow: "0 16px 40px #1c302c30" };

const noSub = () => () => {};
export default function OracleHarness() {
  const search = useSyncExternalStore(noSub, () => window.location.search, () => null);
  return search === null ? null : <Body view={new URLSearchParams(search).get("view") ?? "quiz"} />;
}

function Body({ view }: { view: string }) {
  const m = useMemo(() => memoryIdentityStore(), []);
  const [attempt, setAttempt] = useState<AttemptView | null>(null);
  const [progress, setProgress] = useState<{ answered: number; beat: number | null }>({ answered: 0, beat: null });
  const [result, setResult] = useState<FinishOutcome | null>(null);
  const ran = useRef(false); // dev strict mode runs effects twice; the demo should run once
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      const now = new Date();
      const s = await startReading(m.store, ME, "demo-start-0001", now);
      if (!s.ok) return;
      setAttempt(s.data);
      const want = view === "tie" ? "ISTJ" : "INFP";
      const ans = s.data.items.map((it, i) => {
        const st = STATEMENTS.find((x) => x.id === it.id)!;
        const letter = want[DICHOTOMIES.indexOf(st.dichotomy)];
        const strength = view === "tie" && st.dichotomy === "EI" ? 0 : i % 3 === 0 ? 1 : 2;
        return { item_id: it.id, value: st.pole === letter ? strength : -strength };
      });
      const upTo = view === "quiz" ? 30 : 64;
      const p = await answerBatch(m.store, ME, s.data.attempt_id, ans.slice(0, upTo));
      if (p.ok) setProgress({ answered: p.data.answered, beat: p.data.keeper_beat });
      if (view === "result" || view === "tie") {
        const f = await finishReading(m.store, ME, s.data.attempt_id, undefined);
        if (f.ok) setResult(f.data);
      }
    })();
  }, [m, view]);

  return (
    <main style={{ minHeight: "100dvh", padding: 24, display: "grid", placeItems: "center", background: "radial-gradient(circle at 50% 30%, #3b3257, #151421 70%)", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ width: "min(640px, 100%)" }}>
        {view === "quiz" && attempt ? <Quiz attempt={attempt} progress={progress} /> : null}
        {(view === "result" || view === "tie") && result ? <Result result={result} /> : null}
        {view === "name" ? <NamePicker m={m} /> : null}
        {view === "settings" ? <Settings m={m} /> : null}
      </div>
    </main>
  );
}

function Quiz({ attempt, progress }: { attempt: AttemptView; progress: { answered: number; beat: number | null } }) {
  const next = attempt.items[progress.answered];
  return (
    <section style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#607069", fontWeight: 700 }}>
        <span>THE ORACLE ASKS</span>
        <span>{progress.answered} / {attempt.total}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "#e4e8dc", margin: "8px 0 18px" }}>
        <div style={{ width: `${(progress.answered / attempt.total) * 100}%`, height: "100%", borderRadius: 3, background: "#8e6cc9" }} />
      </div>
      {progress.beat ? <p style={{ margin: "0 0 14px", fontStyle: "italic", color: "#5b4a86" }}>Keeper (beat {progress.beat}): “Thirty answers in. The mist is starting to clear.”</p> : null}
      <h2 style={{ fontSize: 22, lineHeight: 1.35, margin: "0 0 18px" }}>{next.text}</h2>
      <div style={{ display: "grid", gap: 8 }}>
        {LABELS.map((l, i) => (
          <button key={l} style={{ minHeight: 48, borderRadius: 14, border: "1.5px solid #5c746c40", background: i === 3 ? "#ece4f7" : "#fff", borderColor: i === 3 ? "#8e6cc9" : undefined, fontSize: 15, fontWeight: 600, color: "#293e3b" }}>{l}</button>
        ))}
      </div>
      <p style={{ fontSize: 12, color: "#607069", marginTop: 14 }}>64 statements · answers saved in batches · resume any time</p>
    </section>
  );
}

function Result({ result }: { result: FinishOutcome }) {
  if (result.status === "needs_tie_breakers") {
    return (
      <section style={card}>
        <h2 style={{ marginTop: 0 }}>The Oracle hesitates…</h2>
        <p style={{ color: "#607069" }}>One side of you came out exactly even. Choose quickly:</p>
        {result.tie_breakers.map((t) => (
          <div key={t.id} style={{ marginBottom: 12 }}>
            <b>{t.prompt}</b>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              {t.options.map((o) => <button key={o.label} style={{ flex: 1, minHeight: 44, borderRadius: 12, border: "1px solid #5c746c55", background: "#fff" }}>{o.label}</button>)}
            </div>
          </div>
        ))}
      </section>
    );
  }
  const hex = HEX[result.color] ?? "#888";
  return (
    <section style={{ ...card, textAlign: "center", boxShadow: `0 0 80px ${hex}66, 0 16px 40px #0006` }}>
      <div style={{ width: 96, height: 96, margin: "0 auto 12px", borderRadius: "50%", background: `radial-gradient(circle, ${hex}, ${hex}33 70%)`, display: "grid", placeItems: "center", color: "#fff", fontSize: 38, fontWeight: 800 }}>{result.family[0]}</div>
      <div style={{ fontSize: 12, letterSpacing: "0.12em", fontWeight: 800, color: hex }}>{result.color.toUpperCase()} · {result.type}</div>
      <h2 style={{ fontSize: 30, margin: "4px 0 6px" }}>{result.family}</h2>
      <p style={{ margin: "0 0 16px", color: "#607069" }}>{result.aura_new ? "A new aura is yours." : "Your aura is already yours."}</p>
      <div style={{ display: "grid", gap: 8, textAlign: "left" }}>
        {result.dichotomies.map((d) => {
          const [a, b] = d.dichotomy.split("");
          const lean = (d.score / d.max) * 50;
          return (
            <div key={d.dichotomy} style={{ display: "grid", gridTemplateColumns: "80px 1fr 80px", gap: 8, alignItems: "center", fontSize: 12.5 }}>
              <span style={{ fontWeight: d.letter === a ? 800 : 400 }}>{POLE_NAME[a]}</span>
              <div style={{ position: "relative", height: 10, background: "#e4e8dc", borderRadius: 5 }}>
                <div style={{ position: "absolute", top: 0, bottom: 0, left: lean >= 0 ? `${50 - lean}%` : "50%", width: `${Math.abs(lean)}%`, background: hex, borderRadius: 5 }} />
                <div style={{ position: "absolute", left: "50%", top: -3, bottom: -3, width: 2, background: "#29302c55" }} />
              </div>
              <span style={{ fontWeight: d.letter === b ? 800 : 400, textAlign: "right" }}>{POLE_NAME[b]}</span>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 12, color: "#607069", marginTop: 14 }}>Families: Arcane (purple) · Ranger (blue) · Vanguard (yellow) · Warden (green). A later reading costs 250 coins after 7 days.</p>
    </section>
  );
}

function NamePicker({ m }: { m: ReturnType<typeof memoryIdentityStore> }) {
  const [rows, setRows] = useState<{ input: string; out: string; ok: boolean }[]>([]);
  useEffect(() => {
    void (async () => {
      const now = new Date();
      await setWorldName(m.store, "00000000-0000-4000-8000-000000000101", "Maya Chen", now);
      const out: { input: string; out: string; ok: boolean }[] = [];
      for (const input of ["Sunny Otter", "maya_ch3n", "Jo", "Admin", "sh1thead", "Zoë Park", "a__b"]) {
        const r = await checkWorldName(m.store, ME, input);
        out.push({ input, ok: r.ok && r.data.available, out: r.ok ? (r.data.available ? "Available" : "Taken (matches “Maya Chen”)") : r.error });
      }
      const set = await setWorldName(m.store, ME, "Sunny Otter", now);
      out.push({ input: "set “Sunny Otter”", ok: set.ok, out: set.ok ? `Saved. Next change after ${new Date(set.data.next_change_at!).toLocaleDateString("en-CA")}` : set.error });
      const again = await setWorldName(m.store, ME, "Sunny Heron", now);
      out.push({ input: "change to “Sunny Heron”", ok: again.ok, out: again.ok ? "Saved" : again.error });
      setRows(out);
    })();
  }, [m]);
  return (
    <section style={card}>
      <h2 style={{ marginTop: 0 }}>World name <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 5, background: "#3d7fe0", marginLeft: 6 }} title="TSI member" /></h2>
      <p style={{ color: "#607069", fontSize: 13, marginTop: 0 }}>Shown above your character. Your real name stays on your profile. 3–16 characters, unique, one change every 30 days. The blue dot marks TSI members.</p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
        {rows.map((r) => (
          <li key={r.input} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 12px", borderRadius: 12, background: r.ok ? "#e3efdc" : "#fbe3da", fontSize: 14 }}>
            <b>{r.input}</b>
            <span style={{ color: r.ok ? "#2f5a36" : "#8a3417", textAlign: "right" }}>{r.out}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Settings({ m }: { m: ReturnType<typeof memoryIdentityStore> }) {
  const [s, setS] = useState<AccountSettings>(DEFAULT_SETTINGS);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const r = await updateSettings(m.store, ME, { text_size: "large", high_contrast: true, key_bindings: { openJournal: "q", openMap: "f2" } });
      if (r.ok) {
        setS(r.data);
        applySettings(r.data);
      }
      const bad = await updateSettings(m.store, ME, { key_bindings: { openBag: "escape" } });
      if (!bad.ok) setErr(bad.error);
    })();
  }, [m]);
  const hc = s.high_contrast;
  return (
    <section style={{ ...card, background: hc ? "#000" : card.background, color: hc ? "#fff" : card.color, border: hc ? "2px solid #fff" : card.border, fontSize: `calc(15px * var(--tsi-text-scale, 1))` }}>
      <h2 style={{ marginTop: 0 }}>Settings</h2>
      <p>Text size: <b>{s.text_size}</b> ({TEXT_SIZES.join(" / ")}) · High contrast: <b>{hc ? "on" : "off"}</b></p>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {MENU_ACTIONS.map((a) => (
            <tr key={a} style={{ borderTop: `1px solid ${hc ? "#fff5" : "#5c746c30"}` }}>
              <td style={{ padding: "6px 0" }}>{ACTION_LABEL[a]}</td>
              <td style={{ textAlign: "right" }}><kbd style={{ padding: "2px 8px", borderRadius: 6, border: `1px solid ${hc ? "#fff" : "#5c746c80"}`, fontFamily: "ui-monospace, monospace" }}>{s.key_bindings[a] === "enter" ? "Enter" : s.key_bindings[a].toUpperCase()}</kbd></td>
            </tr>
          ))}
          <tr style={{ borderTop: `1px solid ${hc ? "#fff5" : "#5c746c30"}` }}><td style={{ padding: "6px 0" }}>Close sheet</td><td style={{ textAlign: "right" }}><kbd>Esc</kbd> (fixed)</td></tr>
        </tbody>
      </table>
      {err ? <p style={{ color: hc ? "#ffd166" : "#8a3417" }}>Rejected rebinding: {err}</p> : null}
      <p style={{ fontSize: 12, opacity: 0.8 }}>Saved per account (member_settings). Applied as data-text-size / data-contrast on &lt;html&gt; and --tsi-text-scale; colours: {Object.values(FAMILY_COLOR).join(", ")} auras unaffected.</p>
    </section>
  );
}
