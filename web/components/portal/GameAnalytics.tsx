"use client";

import type { ReactNode } from "react";
import { Badge, Card, Progress, Select } from "@/components/gui";
import { RANGES, type Report } from "@/lib/analytics/report";

const H2 = "mb-1 text-base font-extrabold text-[var(--gui-ink-strong)]";
const NOTE = "mb-4 text-sm text-[var(--gui-muted)]";
const TABLE = "w-full text-left text-sm";
const TH = "py-2 pr-3 text-xs font-extrabold uppercase tracking-wide text-[var(--gui-muted)]";
const TD = "py-2 pr-3 text-[var(--gui-ink-2)]";
const short = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" }) : "never");

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return <Card as="section" className="mb-6"><h2 className={H2}>{title}</h2><p className={NOTE}>{note}</p>{children}</Card>;
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return <Card><p className="text-sm font-bold text-[var(--gui-ink-2)]">{label}</p><p className="mt-1 text-2xl font-extrabold text-[var(--gui-ink-strong)]">{value}</p></Card>;
}

/** Players a day: the bar is everyone who played, its darker foot the ones who joined that day. */
function DayBars({ days }: { days: Report["perDay"] }) {
  const top = Math.max(1, ...days.map((d) => d.active));
  return <div>
    <div className="flex h-32 items-end gap-[2px]" role="img" aria-label={`Players a day, up to ${top}`}>
      {days.map((d) => (
        <div key={d.d} className="relative flex-1 rounded-t-[3px] bg-[var(--gui-sage-soft)]" style={{ height: `${(d.active / top) * 100}%` }} title={`${short(d.d)}: ${d.active} played, ${d.new} new`}>
          <div className="absolute inset-x-0 bottom-0 rounded-t-[3px] bg-[var(--gui-sage-deep)]" style={{ height: `${d.active ? (Math.min(d.new, d.active) / d.active) * 100 : 0}%` }} />
        </div>
      ))}
    </div>
    <div className="mt-1 flex justify-between text-xs text-[var(--gui-muted)]"><span>{short(days[0]?.d ?? null)}</span><span>{short(days.at(-1)?.d ?? null)}</span></div>
    <div className="mt-2 flex gap-4 text-xs text-[var(--gui-ink-2)]">
      <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[var(--gui-sage-soft)] align-middle" />played</span>
      <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[var(--gui-sage-deep)] align-middle" />new</span>
    </div>
  </div>;
}

function Ranked({ rows, empty }: { rows: { key: string; label: string; n: number }[]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-[var(--gui-muted)]">{empty}</p>;
  const total = rows.reduce((a, r) => a + r.n, 0);
  return <div className="space-y-3">{rows.map((r) => <Progress key={r.key} value={r.n} max={rows[0].n} label={r.label} showLabel valueText={`${r.n} (${Math.round((r.n / total) * 100)}%)`} />)}</div>;
}

const cell = (v: number | null) => v === null ? <span className="text-[var(--gui-muted)]">soon</span> : `${v}%`;
const heat = (v: number | null) => v === null ? undefined : { background: `color-mix(in srgb, var(--gui-sage-soft) ${Math.round(v)}%, transparent)` };

/** The admin game analytics page's body (app/student/dashboard/admin/game): world names only. */
export default function GameAnalytics({ report, days, onDays }: { report: Report; days: number; onDays: (d: number) => void }) {
  const { totals, funnel, engagement: e } = report;
  return <div>
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--gui-ink-strong)]">Players</h1>
        <p className="mt-1 text-sm text-[var(--gui-muted)]">Who plays, how far they get, and where they stop. {short(report.range.from)} to {short(report.range.to)}.</p>
      </div>
      <Select label="Range" value={days} onChange={(ev) => onDays(Number(ev.target.value))}>
        {RANGES.map((d) => <option key={d} value={d}>Last {d} days</option>)}
      </Select>
    </div>

    <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
      <Stat label="Players" value={totals.players} />
      <Stat label="New in range" value={totals.newInRange} />
      <Stat label="Played today" value={totals.activeToday} />
      <Stat label="Played this week" value={totals.activeWeek} />
      <Stat label={`Quiet ${7}+ days`} value={totals.gone} />
    </div>

    <Section title="Players a day" note="Everyone who played each day, and how many of them were new.">
      <DayBars days={report.perDay} />
    </Section>

    <Section title="The funnel" note={report.logSince
      ? `Players who joined in the range since the log began (${short(report.logSince)}): ${funnel[0]?.of ?? 0}. How many reached each step; the badge is the drop from the step before.`
      : "Players who joined in the range. Until the log runs, only the steps the game's own tables keep."}>
      <div className="space-y-3">
        {funnel.map((f, i) => (
          <div key={f.step} className="flex items-center gap-3">
            {f.of ? <Progress className="flex-1" value={f.pct} max={100} label={f.label} showLabel valueText={`${f.reached} (${f.pct}%)`} />
              : <p className="flex-1 text-sm text-[var(--gui-muted)]">{f.label}: not logged yet</p>}
            <span className="w-16 shrink-0 text-right">{i > 0 && f.dropPct > 0 ? <Badge tone={f.dropPct >= 25 ? "danger" : "warn"}>-{f.dropPct}%</Badge> : null}</span>
          </div>
        ))}
      </div>
      {report.history.length > 0 && <>
        <h3 className="mt-6 mb-2 text-sm font-extrabold text-[var(--gui-ink-strong)]">Joined before the log ({report.history[0].of})</h3>
        <p className={NOTE}>What the game&apos;s own tables kept for them.</p>
        <div className="space-y-3">{report.history.map((h) => <Progress key={h.step} value={h.pct} max={100} label={h.label} showLabel valueText={`${h.reached} (${h.pct}%)`} />)}</div>
      </>}
    </Section>

    <div className="grid gap-6 lg:grid-cols-2">
      <Section title="Where sessions end" note="The screen a player was on when they closed the game, or the last step they reached.">
        <Ranked rows={report.quitSession} empty="No sessions logged in this range yet." />
      </Section>
      <Section title="Where people stop for good" note="Players quiet for 7 days or more: their last screen, or the furthest step they reached.">
        <Ranked rows={report.quitGone} empty="Nobody has gone quiet yet." />
      </Section>
    </div>

    <Section title="Engagement" note="Sessions in the range. A session is one visit to the island, from opening it to closing it.">
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Sessions" value={e.sessions} />
        <Stat label="Typical length" value={`${e.medianMin} min`} />
        <Stat label="Average length" value={`${e.meanMin} min`} />
        <Stat label="Sessions a player" value={e.perPlayer} />
      </div>
      {e.stepMinutes.length > 0 && <>
        <h3 className="mb-2 text-sm font-extrabold text-[var(--gui-ink-strong)]">Time between steps (typical, minutes)</h3>
        <div className="space-y-3">{e.stepMinutes.map((s) => <Progress key={s.label} value={s.median} max={Math.max(...e.stepMinutes.map((x) => x.median), 1)} label={s.label} showLabel valueText={`${s.median} min`} />)}</div>
      </>}
    </Section>

    <Section title="Features" note="Players who used each feature in the range, and how many came back to it on another day.">
      <div className="overflow-x-auto"><table className={TABLE}>
        <thead><tr><th className={TH}>Feature</th><th className={TH}>Players</th><th className={TH}>Came back to it</th></tr></thead>
        <tbody>{report.features.map((f) => <tr key={f.label} className="border-t border-[var(--gui-paper-edge)]"><td className={TD}>{f.label}</td><td className={TD}>{f.players}</td><td className={TD}>{f.returning} ({f.players ? Math.round((f.returning / f.players) * 100) : 0}%)</td></tr>)}</tbody>
      </table></div>
    </Section>

    <Section title="Retention by signup week" note="Of the players who joined each week, the share who played again 1, 7 and 30 days later.">
      <div className="overflow-x-auto"><table className={TABLE}>
        <thead><tr><th className={TH}>Week of</th><th className={TH}>Joined</th><th className={TH}>Day 1</th><th className={TH}>Day 7</th><th className={TH}>Day 30</th></tr></thead>
        <tbody>{report.cohorts.map((c) => <tr key={c.week} className="border-t border-[var(--gui-paper-edge)]">
          <td className={TD}>{short(c.week)}</td><td className={TD}>{c.size}</td>
          {[c.d1, c.d7, c.d30].map((v, i) => <td key={i} className={TD} style={heat(v)}>{cell(v)}</td>)}
        </tr>)}</tbody>
      </table></div>
    </Section>

    <Section title="Every player" note="World names only. Last seen is the last time they did anything on the island.">
      <div className="max-h-[32rem] overflow-auto"><table className={`${TABLE} min-w-[34rem]`}>
        <thead className="sticky top-0 bg-[var(--gui-paper-hi)]"><tr><th className={TH}>Player</th><th className={TH}>Joined</th><th className={TH}>Last seen</th><th className={TH}>Sessions</th><th className={TH}>Played</th><th className={TH}>Furthest</th></tr></thead>
        <tbody>{report.list.map((p, i) => <tr key={i} className="border-t border-[var(--gui-paper-edge)]">
          <td className={TD}>{p.name}{p.gone && <Badge tone="neutral" className="ml-2">quiet</Badge>}</td>
          <td className={TD}>{short(p.joined)}</td><td className={TD}>{short(p.last)}</td><td className={TD}>{p.sessions}</td>
          <td className={TD}>{p.minutes} min</td><td className={TD}>{p.furthest}</td>
        </tr>)}</tbody>
      </table></div>
    </Section>
  </div>;
}
