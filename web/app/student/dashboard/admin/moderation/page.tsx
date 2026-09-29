"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import NameReportsPanel from "@/components/portal/NameReportsPanel";
import { AdminGate } from "@/components/portal/ProgressionAdminShared";

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
const btn = "px-2 py-1 border font-mono text-xs rounded";
const label = (w: Who | null) => (w ? `${w.world_name ?? w.name}${w.world_name ? ` (${w.name})` : ""}` : "A former member");

export default function ModerationPage() {
  const [queue, setQueue] = useState<{ letters: Report[]; chat: Report[]; muted: Who[]; log: LogEntry[] } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    const body = await fetch("/api/admin/moderation").then((r) => r.json()).catch(() => null);
    setQueue(body?.ok ? { letters: body.letters, chat: body.chat, muted: body.muted, log: body.log } : { letters: [], chat: [], muted: [], log: [] });
    if (!body?.ok) setMsg(body?.error ?? "Couldn't load reports.");
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, setState is after await
    void load();
  }, [load]);
  const act = async (kind: Kind, r: Report, action: "remove" | "remove_mute" | "dismiss") => {
    const res = await fetch("/api/admin/moderation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, id: r.id, action }) });
    const body = await res.json().catch(() => ({}));
    setMsg(res.ok && body.ok ? { remove: "Removed.", remove_mute: `Removed; ${label(r.author)} muted 7 days.`, dismiss: "Dismissed; the text stays." }[action] : (body.error ?? "Action failed."));
    await load();
  };
  const unmute = async (w: Who) => {
    const res = await fetch("/api/identity/moderate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ member_id: w.id, action: "unmute" }) });
    const body = await res.json().catch(() => ({}));
    setMsg(res.ok && body.ok ? `${label(w)} can write again.` : (body.error ?? "Action failed."));
    await load();
  };
  // The server's list: muted until later than now.
  const mutedNow = (w: Who | null): w is Who => !!w && !!queue?.muted.some((m) => m.id === w.id);

  const section = (kind: Kind, title: string, rows: Report[]) => (
    <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-4 mb-4">
      <h2 className="font-heading font-bold text-[var(--color-text-primary)] mb-2">{title} ({rows.length} open)</h2>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="border-t border-[var(--glass-border)]/40 pt-3 first:border-t-0 first:pt-0">
            <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">{r.subject ? <b>{r.subject}: </b> : null}{r.body}</p>
            <p className="mt-1 text-xs font-mono text-[var(--color-text-muted)]">
              by {label(r.author)}{mutedNow(r.author) ? ` · muted until ${new Date(r.author.muted_until!).toLocaleDateString("en-CA")}` : ""} · reported by {label(r.reporter)} · {new Date(r.reported_at).toLocaleDateString("en-CA")}
              {r.reason ? ` · “${r.reason}”` : ""}
            </p>
            <div className="mt-2 flex gap-2">
              {mutedNow(r.author) ? <button onClick={() => unmute(r.author!)} className={`${btn} border-[var(--glass-border)] text-[var(--color-text-primary)]`}>Unmute</button> : null}
              <button onClick={() => act(kind, r, "remove")} className={`${btn} border-red-500/40 text-red-400`}>Remove</button>
              <button onClick={() => act(kind, r, "remove_mute")} className={`${btn} border-red-500/40 text-red-400`}>Remove + mute 7d</button>
              <button onClick={() => act(kind, r, "dismiss")} className={`${btn} border-[var(--glass-border)] text-[var(--color-text-muted)]`}>Dismiss</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <AdminGate>
      <Link href="/student/dashboard/admin" className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-2">
        <ArrowLeft size={12} /> Back to Admin
      </Link>
      <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">Moderation queue</h1>
      <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1 mb-6">Reports from members. Remove hides the text; a mute stops the author writing notes and table chat for 7 days.</p>
      {msg ? <p className="mb-4 text-xs font-mono text-[var(--color-text-soft)]">{msg}</p> : null}
      <NameReportsPanel showEmpty />
      {queue === null ? (
        <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)] animate-pulse">Loading reports...</p>
      ) : (
        <>
          {section("letter", "Notes", queue.letters)}
          {section("chat", "Table chat", queue.chat)}
          <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-4 mb-4">
            <h2 className="font-heading font-bold text-[var(--color-text-primary)] mb-2">Muted now ({queue.muted.length})</h2>
            <ul className="space-y-2">
              {queue.muted.map((w) => (
                <li key={w.id} className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-[var(--color-text-primary)]">{label(w)}</span>
                  <span className="text-xs font-mono text-[var(--color-text-muted)]">until {w.muted_until ? new Date(w.muted_until).toLocaleString("en-CA") : "?"}</span>
                  <button onClick={() => unmute(w)} className={`${btn} ml-auto border-[var(--glass-border)] text-[var(--color-text-primary)]`}>Unmute</button>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-4 mb-4">
            <h2 className="font-heading font-bold text-[var(--color-text-primary)] mb-2">Audit log (last {queue.log.length})</h2>
            <ul className="space-y-1">
              {queue.log.map((e) => (
                <li key={e.id} className="text-xs font-mono text-[var(--color-text-muted)]">
                  {new Date(e.created_at).toLocaleString("en-CA")} · <span className="text-[var(--color-text-primary)]">{label(e.actor)}</span> {described(e)}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </AdminGate>
  );
}
