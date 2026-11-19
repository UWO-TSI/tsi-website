"use client";

import type { ReactNode } from "react";
import { AlertTriangle, Info, TrendingDown, TrendingUp } from "lucide-react";
import { BarRows, CHART, ChartCard, Columns, Delta, Heatmap, Legend, Pill, Segmented, StatTile, TimeChart } from "@/components/gui/flat";
import { useSchemeTheme } from "@/styles/themes/useSchemeTheme";
import { GONE_DAYS, RANGES, type Change, type Rate, type Report } from "@/lib/analytics/report";

const short = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" }) : "never");
const share = (r: Rate) => (r.pct === null ? "soon" : `${Math.round(r.pct)}%`);
const ofWhom = (r: Rate) => (r.of ? `of ${r.of} old enough` : "nobody old enough yet");
/** Minutes, read the way a person says them. */
const took = (min: number | null) => min === null ? "none yet" : min < 90 ? `${Math.round(min)} min` : min < 48 * 60 ? `${Math.round(min / 60)} h` : `${Math.round(min / 1440)} days`;
const H3 = "mb-2 mt-5 text-[13px] font-extrabold text-[var(--ui-ink)]";

const TONE = {
  up: [TrendingUp, "var(--ui-good)", "Up"],
  down: [TrendingDown, "var(--ui-error)", "Down"],
  warn: [AlertTriangle, "var(--ui-gold-deep)", "Look at this"],
  info: [Info, "var(--ui-quiet)", "Note"],
} as const;

function Changed({ c, label }: { c?: Change; label?: string }) {
  if (!c) return null;
  const v = c.unit === "pct" ? `${Math.round(c.now)}%` : c.unit === "min" ? `${c.now} min` : c.now;
  return <StatTile label={label ?? c.label} value={v} sub={<Delta now={c.now} before={c.before} unit={c.unit} />} />;
}

function Tiles({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">{children}</div>;
}

/** The admin game analytics page's body (app/student/dashboard/admin/game): world names only. */
export default function GameAnalytics({ report: r, days, onDays }: { report: Report; days: number; onDays: (d: number) => void }) {
  const theme = useSchemeTheme();
  const change = (k: string) => r.changes.find((c) => c.key === k);
  const logged = r.funnel.filter((f) => f.of);
  const unlogged = r.funnel.filter((f) => !f.of);
  const lostAt = (i: number) => (i > 0 ? logged[i - 1].reached - logged[i].reached : 0);
  const goneTotal = r.quitGone.reduce((a, q) => a + q.n, 0), endTotal = r.quitSession.reduce((a, q) => a + q.n, 0);

  return <div data-ui-theme={theme} className="rounded-[22px] bg-[var(--ui-bg)] p-3 font-[family-name:var(--gui-font)] text-[var(--ui-ink-body)] sm:p-5">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--ui-ink)]">Players</h1>
        <p className="mt-1 text-sm text-[var(--ui-muted)]">Who plays, how far they get, and where they stop. {short(r.range.from)} to {short(r.range.to)}.</p>
      </div>
      <Segmented label="Range" value={days} onChange={onDays} options={RANGES.map((d) => ({ id: d, label: `${d} days` }))} />
    </div>

    <div className="grid gap-3">
      <ChartCard title="What the numbers say" note={`Read from the numbers below on the server, against the ${days} days before.`}>
        <ul className="grid gap-2.5">
          {r.summary.map((s, i) => {
            const [Icon, color, name] = TONE[s.tone];
            return <li key={i} className="flex gap-2.5 text-[15px] leading-snug text-[var(--ui-ink-body)]">
              <Icon size={18} strokeWidth={2.4} className="mt-0.5 shrink-0" style={{ color }} aria-label={name} />
              <span>{s.text}</span>
            </li>;
          })}
        </ul>
      </ChartCard>

      <ChartCard title="This period" note={`Each number against the ${days} days before it.`}>
        <Tiles>
          <Changed c={change("new")} />
          <Changed c={change("daily")} />
          <Changed c={change("sessions")} />
          <Changed c={change("length")} />
          <Changed c={change("tutorial")} />
          <Changed c={change("nextDay")} />
        </Tiles>
      </ChartCard>

      <ChartCard title="Active and coming back" note="Actives at the end of the range. Retention: of the players who joined in the range and are old enough, the share who played again on that day or later.">
        <Tiles>
          <StatTile label="A day" value={r.actives.dau} sub="average of the last 7 days" />
          <StatTile label="A week" value={r.actives.wau} sub="played in the last 7 days" />
          <StatTile label="A month" value={r.actives.mau} sub="played in the last 30 days" />
          <StatTile label="Stickiness" value={`${r.actives.stickiness}%`} sub="a day over the month" />
          <StatTile label="Sessions a player" value={r.engagement.perPlayer} sub={`${r.engagement.sessions} sessions`} />
          <StatTile label="Typical session" value={`${r.engagement.medianMin} min`} sub={`average ${r.engagement.meanMin} min`} />
          <StatTile label="Day 1" value={share(r.retention.d1)} sub={ofWhom(r.retention.d1)} />
          <StatTile label="Day 7" value={share(r.retention.d7)} sub={ofWhom(r.retention.d7)} />
          <StatTile label="Day 30" value={share(r.retention.d30)} sub={ofWhom(r.retention.d30)} />
          <StatTile label="The very next day" value={share(r.retention.nextDay)} sub={ofWhom(r.retention.nextDay)} />
          <StatTile label="Finished the tutorial" value={share(r.tutorial)} sub={`of ${r.tutorial.of} who joined`} />
          <StatTile label={`Quiet ${GONE_DAYS}+ days`} value={r.totals.gone} sub={`of ${r.totals.players} players`} />
        </Tiles>
      </ChartCard>

      <ChartCard title="Players over time" note="Everyone who played each day, everyone in the 7 days to it, and who joined. Hover or tap a day.">
        <TimeChart label="Players over time" labels={r.perDay.map((d) => short(d.d))} series={[
          { label: "Played that day", kind: "bar", color: CHART.soft, values: r.perDay.map((d) => d.active) },
          { label: "Played that week", kind: "line", color: CHART.a, values: r.perDay.map((d) => d.week) },
          { label: "Joined", kind: "line", color: CHART.b, values: r.perDay.map((d) => d.new) },
        ]} />
      </ChartCard>

      <ChartCard title="The funnel" note={r.logSince
        ? `Players who joined in the range since the log began (${short(r.logSince)}): ${logged[0]?.of ?? 0}. Each bar is the share who reached the step; under it, who stopped just before.`
        : "Players who joined in the range. Until the log runs, only the steps the game's own tables keep."}>
        <BarRows max={100} rows={logged.map((f, i) => ({
          key: f.step, label: f.label, value: f.pct, hint: `${f.label}: ${f.reached} of ${f.of}`,
          text: <>{f.reached}<small>{Math.round(f.pct)}%</small></>,
          drop: lostAt(i) > 0 ? { text: `${lostAt(i)} stopped before this (${f.dropPct}%)`, big: f.dropPct >= 25 } : undefined,
        }))} />
        {unlogged.length > 0 && <p className="mt-4 text-[13px] text-[var(--ui-muted)]">Not logged yet: {unlogged.map((f) => f.label).join(", ")}.</p>}
        {r.history.length > 0 && <>
          <h3 className={H3}>Joined before the log ({r.history[0].of})</h3>
          <BarRows max={100} rows={r.history.map((h) => ({ key: h.step, label: h.label, value: h.pct, text: <>{h.reached}<small>{Math.round(h.pct)}%</small></> }))} />
        </>}
      </ChartCard>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Where people stop for good" note={`Players quiet ${GONE_DAYS} days or more (${goneTotal}): their last screen, or the furthest step they reached.`}>
          <BarRows empty="Nobody has gone quiet yet." rows={r.quitGone.map((q) => ({ key: q.key, label: q.label, value: q.n, text: <>{q.n}<small>{Math.round((q.n / goneTotal) * 100)}%</small></> }))} />
        </ChartCard>
        <ChartCard title="Where sessions end" note={`Every session in the range (${endTotal}): the screen it closed on, or the last step reached.`}>
          <BarRows empty="No sessions logged in this range yet." rows={r.quitSession.map((q) => ({ key: q.key, label: q.label, value: q.n, text: <>{q.n}<small>{Math.round((q.n / endTotal) * 100)}%</small></> }))} />
        </ChartCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Retention by signup week" note="Of the players who joined each week, the share who played again 1, 7 and 30 days on. Darker is more.">
          {r.cohorts.length ? <Heatmap lead={["Week of", "Joined"]} cols={["Day 1", "Day 7", "Day 30"]}
            rows={r.cohorts.map((c) => ({ label: short(c.week), side: c.size, cells: [c.d1, c.d7, c.d30] }))} />
            : <p className="text-[13px] text-[var(--ui-muted)]">Nobody has joined yet.</p>}
        </ChartCard>
        <ChartCard title="How long a session lasts" note={`Sessions in the range, by length in minutes. Typical: ${r.engagement.medianMin} min.`}>
          <Columns label="Sessions by length" bins={r.sessionLengths} />
          <h3 className={H3}>Time to the firsts (typical, from joining)</h3>
          <div className="grid grid-cols-2 gap-y-3 sm:grid-cols-3">
            {r.firsts.map((f) => <StatTile key={f.step} label={f.label} value={took(f.medianMin)} sub={`${f.reached} of ${f.of} got there`} />)}
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title="Features" note="Players who used each feature in the range, and how many came back to it on another day.">
          <BarRows empty="No feature used in this range yet." rows={r.features.map((f) => ({
            key: f.label, label: f.label, value: f.players, inner: f.returning, text: <>{f.players}<small>{f.returning} back</small></>,
            hint: `${f.label}: ${f.players} used it, ${f.returning} came back to it`,
          }))} />
          <Legend items={[{ label: "Used it", color: CHART.a }, { label: "Came back to it", color: CHART.b }]} />
        </ChartCard>
        <ChartCard title="Time between steps" note="Typical minutes from one step to the next, for the players who reached both.">
          <BarRows empty="No two steps logged yet." rows={r.engagement.stepMinutes.map((s) => ({ key: s.label, label: s.label, value: s.median, text: `${s.median} min` }))} />
        </ChartCard>
      </div>

      <ChartCard title="Every kind of event" note="What the log holds in the range, by kind. A new system's events (the markets, the login calendar, gem purchases) show up here by their id as soon as they're logged.">
        <BarRows empty="Nothing logged in this range yet." rows={r.kinds.map((k) => ({
          key: k.kind, value: k.n, hint: `${k.label}: first ${short(k.first)}, last ${short(k.last)}`,
          label: <>{k.label}{k.isNew && <span className="ml-2"><Pill>new</Pill></span>}</>,
          text: <>{k.n.toLocaleString("en-CA")}<small>{k.players} players</small></>,
        }))} />
      </ChartCard>

      <ChartCard title="Every player" note="World names only. Last seen is the last time they did anything on the island.">
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full min-w-[34rem] text-left text-[13px]">
            <thead className="sticky top-0 bg-[var(--ui-card)] text-xs font-extrabold text-[var(--ui-muted)]">
              <tr>{["Player", "Joined", "Last seen", "Sessions", "Played", "Furthest"].map((h) => <th key={h} className="py-2 pr-3">{h}</th>)}</tr>
            </thead>
            <tbody className="tabular-nums text-[var(--ui-ink-2)]">{r.list.map((p, i) => <tr key={i} className="border-t border-[var(--ui-line)]">
              <td className="py-2 pr-3 text-[var(--ui-ink)]">{p.name}{p.gone && <span className="ml-2"><Pill>quiet</Pill></span>}</td>
              <td className="py-2 pr-3">{short(p.joined)}</td><td className="py-2 pr-3">{short(p.last)}</td><td className="py-2 pr-3">{p.sessions}</td>
              <td className="py-2 pr-3">{p.minutes} min</td><td className="py-2 pr-3">{p.furthest}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  </div>;
}
