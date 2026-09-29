"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import NameReportsPanel from "@/components/portal/NameReportsPanel";
import { AdminGate } from "@/components/portal/ProgressionAdminShared";

// Moderation queue (row 221): name reports, reported notes (letters) and table chat.
interface Who { id: string; name: string; world_name: string | null; muted_until: string | null }
interface Report { id: string; body: string; subject: string | null; reason: string | null; reported_at: string; author: Who | null; reporter: Who | null }
type Kind = "letter" | "chat";
const btn = "px-2 py-1 border font-mono text-xs rounded";
const label = (w: Who | null) => (w ? `${w.world_name ?? w.name}${w.world_name ? ` (${w.name})` : ""}` : "A former member");

export default function ModerationPage() {
  const [queue, setQueue] = useState<{ letters: Report[]; chat: Report[] } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    const body = await fetch("/api/admin/moderation").then((r) => r.json()).catch(() => null);
    setQueue(body?.ok ? { letters: body.letters, chat: body.chat } : { letters: [], chat: [] });
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

  const section = (kind: Kind, title: string, rows: Report[]) => (
    <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-4 mb-4">
      <h2 className="font-heading font-bold text-[var(--color-text-primary)] mb-2">{title} ({rows.length} open)</h2>
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="border-t border-[var(--glass-border)]/40 pt-3 first:border-t-0 first:pt-0">
            <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">{r.subject ? <b>{r.subject}: </b> : null}{r.body}</p>
            <p className="mt-1 text-xs font-mono text-[var(--color-text-muted)]">
              by {label(r.author)}{r.author?.muted_until && Date.parse(r.author.muted_until) > Date.now() ? ` · muted until ${new Date(r.author.muted_until).toLocaleDateString("en-CA")}` : ""} · reported by {label(r.reporter)} · {new Date(r.reported_at).toLocaleDateString("en-CA")}
              {r.reason ? ` · “${r.reason}”` : ""}
            </p>
            <div className="mt-2 flex gap-2">
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
        </>
      )}
    </AdminGate>
  );
}
