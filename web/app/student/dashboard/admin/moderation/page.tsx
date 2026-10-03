"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import NameReportsPanel from "@/components/portal/NameReportsPanel";
import { AdminGate } from "@/components/portal/ProgressionAdminShared";
import { Button, Card, ErrorNote, Loading } from "@/components/gui";

// Moderation queue (row 221): name reports, reported notes (letters) and table chat,
// the members muted now (unmute), and the audit log of every action.
interface Who { id: string; name: string; world_name: string | null; muted_until: string | null }
interface Report { id: string; body: string; subject: string | null; reason: string | null; reported_at: string; author: Who | null; reporter: Who | null }
interface LogEntry { id: number; action: string; item_kind: string; item_id: string | null; excerpt: string | null; created_at: string; actor: Who | null; target: Who | null }
type Kind = "letter" | "chat";
const ON_TEXT: Record<string, string> = { remove: "removed", remove_mute: "removed and muted", dismiss: "dismissed" };
const ON_MEMBER: Record<string, string> = { mute: "muted", unmute: "unmuted", reset_name: "reset the name of", dismiss: "dismissed a name report about" };
/** "removed a note by Juniper · “…”", "reset the name of Islander 3f2a · “Rudename”". */
const described = (e: LogEntry) =>
  e.item_kind === "letter" || e.item_kind === "chat"
    ? `${ON_TEXT[e.action] ?? e.action} ${e.item_kind === "letter" ? "a note" : "table chat"} by ${label(e.target)}${e.excerpt ? ` · “${e.excerpt}”` : ""}`
    : `${ON_MEMBER[e.action] ?? e.action} ${label(e.target)}${e.excerpt && e.excerpt !== e.target?.world_name ? ` · was “${e.excerpt}”` : ""}`;
const label = (w: Who | null) => (w ? `${w.world_name ?? w.name}${w.world_name ? ` (${w.name})` : ""}` : "A former member");
const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Toronto" });
const when = (iso: string) => new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });

export default function ModerationPage() {
  const [queue, setQueue] = useState<{ letters: Report[]; chat: Report[]; muted: Who[]; log: LogEntry[] } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const body = await fetch("/api/admin/moderation").then((r) => r.json()).catch(() => null);
    setQueue(body?.ok ? { letters: body.letters, chat: body.chat, muted: body.muted, log: body.log } : { letters: [], chat: [], muted: [], log: [] });
    setLoadError(body?.ok ? null : (body?.error ?? "The reports didn’t load."));
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, setState is after await
    void load();
  }, [load]);
  const act = async (kind: Kind, r: Report, action: "remove" | "remove_mute" | "dismiss") => {
    const res = await fetch("/api/admin/moderation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id: r.id, action }) });
    const body = await res.json().catch(() => ({}));
    setMsg(res.ok && body.ok ? { remove: "Removed.", remove_mute: `Removed, and ${label(r.author)} is muted for 7 days.`, dismiss: "Dismissed. The text stays up." }[action] : (body.error ?? "That didn’t go through."));
    await load();
  };
  const unmute = async (w: Who) => {
    const res = await fetch("/api/identity/moderate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ member_id: w.id, action: "unmute" }) });
    const body = await res.json().catch(() => ({}));
    setMsg(res.ok && body.ok ? `${label(w)} can write again.` : (body.error ?? "That didn’t go through."));
    await load();
  };
  // The server's list: muted until later than now.
  const mutedNow = (w: Who | null): w is Who => !!w && !!queue?.muted.some((m) => m.id === w.id);

  const section = (kind: Kind, title: string, rows: Report[]) => (
    <Card as="section" className="mb-4">
      <h2 className="mb-3 text-base font-extrabold text-[var(--gui-ink-strong)]">{title} ({rows.length} open)</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--gui-muted)]">Nothing reported right now.</p>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.id} className="border-t-2 border-dashed border-[var(--gui-paper-edge)] py-3 first:border-t-0 first:pt-0 last:pb-0">
              <p className="whitespace-pre-wrap text-sm text-[var(--gui-ink)]">{r.subject ? <b className="font-extrabold text-[var(--gui-ink-strong)]">{r.subject}: </b> : null}{r.body}</p>
              <p className="mt-1 text-xs text-[var(--gui-muted)]">
                By {label(r.author)}{mutedNow(r.author) ? ` · muted until ${day(r.author.muted_until!)}` : ""} · reported by {label(r.reporter)} · {day(r.reported_at)}
                {r.reason ? ` · “${r.reason}”` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {mutedNow(r.author) ? <Button size="sm" variant="quiet" onClick={() => unmute(r.author!)}>Unmute</Button> : null}
                <Button size="sm" variant="danger" onClick={() => act(kind, r, "remove")}>Remove</Button>
                <Button size="sm" variant="danger" onClick={() => act(kind, r, "remove_mute")}>Remove and mute for 7 days</Button>
                <Button size="sm" variant="quiet" onClick={() => act(kind, r, "dismiss")}>Dismiss</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  return (
    <AdminGate>
      <div className={PAGE}>
        <Link href="/student/dashboard/admin" className="mb-2 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--gui-ink-2)] hover:text-[var(--gui-ink-strong)]">
          <ArrowLeft size={16} aria-hidden /> Back to admin
        </Link>
        <h1 className="text-2xl font-extrabold text-[var(--gui-ink-strong)]">Moderation queue</h1>
        <p className="mt-1 mb-6 text-sm text-[var(--gui-muted)]">Reports from members. Remove hides the text; a mute stops the author writing notes and table chat for 7 days.</p>
        {msg ? <p role="status" className="mb-4 rounded-2xl bg-[var(--gui-paper-warm)] px-4 py-2.5 text-sm font-bold text-[var(--gui-ink)]">{msg}</p> : null}
        <NameReportsPanel showEmpty />
        {queue === null ? (
          <Loading label="Getting the reports…" />
        ) : loadError ? (
          <ErrorNote onRetry={() => void load()}>{loadError}</ErrorNote>
        ) : (
          <>
            {section("letter", "Notes", queue.letters)}
            {section("chat", "Table chat", queue.chat)}
            <Card as="section" className="mb-4">
              <h2 className="mb-3 text-base font-extrabold text-[var(--gui-ink-strong)]">Muted now ({queue.muted.length})</h2>
              {queue.muted.length === 0 ? (
                <p className="text-sm text-[var(--gui-muted)]">No one is muted.</p>
              ) : (
                <ul>
                  {queue.muted.map((w) => (
                    <li key={w.id} className="flex flex-wrap items-center gap-3 border-t-2 border-dashed border-[var(--gui-paper-edge)] py-2 text-sm first:border-t-0 first:pt-0 last:pb-0">
                      <span className="font-bold text-[var(--gui-ink)]">{label(w)}</span>
                      <span className="text-xs text-[var(--gui-muted)]">until {w.muted_until ? when(w.muted_until) : "?"}</span>
                      <Button size="sm" variant="quiet" className="ml-auto" onClick={() => unmute(w)}>Unmute</Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card as="section" className="mb-4">
              <h2 className="mb-3 text-base font-extrabold text-[var(--gui-ink-strong)]">Audit log (last {queue.log.length})</h2>
              {queue.log.length === 0 ? (
                <p className="text-sm text-[var(--gui-muted)]">No actions yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {queue.log.map((e) => (
                    <li key={e.id} className="text-sm text-[var(--gui-ink-2)]">
                      <span className="text-[var(--gui-muted)]">{when(e.created_at)}</span> · <span className="font-bold text-[var(--gui-ink-strong)]">{label(e.actor)}</span> {described(e)}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>
    </AdminGate>
  );
}
