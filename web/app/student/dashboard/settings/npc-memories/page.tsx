"use client";

// ─── User-Facing NPC Memory Wipe (D7) ──────────────────────────────────────
// Lists every NPC the calling user has talked to + interaction count + last
// interaction. Per-row "Wipe Memory" button calls /api/npc/memories/wipe and
// removes the row from the list on success.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Brain, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface MemoryRow {
  npc_id: string;
  npc_name: string;
  interaction_count: number;
  last_interaction_at: string;
}

export default function NPCMemoriesPage() {
  const [rows, setRows] = useState<MemoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyNPC, setBusyNPC] = useState<string | null>(null);
  const [confirmNPC, setConfirmNPC] = useState<MemoryRow | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("You must be signed in.");
        setRows([]);
        return;
      }

      const { data, error: qErr } = await supabase
        .from("npc_memories")
        .select(
          "npc_id, interaction_count, last_interaction_at, npc_personas:npc_id(display_name)",
        )
        .eq("user_id", user.id)
        .order("last_interaction_at", { ascending: false });
      if (qErr || !data) {
        setError(qErr?.message ?? "Failed to load NPC memories");
        setRows([]);
        return;
      }

      const list: MemoryRow[] = (data as unknown as {
        npc_id: string;
        interaction_count: number;
        last_interaction_at: string;
        npc_personas: { display_name: string | null } | { display_name: string | null }[] | null;
      }[]).map((r) => {
        const joined = Array.isArray(r.npc_personas)
          ? r.npc_personas[0]
          : r.npc_personas;
        return {
          npc_id: r.npc_id,
          npc_name: joined?.display_name ?? "unknown NPC",
          interaction_count: r.interaction_count,
          last_interaction_at: r.last_interaction_at,
        };
      });
      setRows(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const confirmAndWipe = async () => {
    if (!confirmNPC) return;
    const npcId = confirmNPC.npc_id;
    setBusyNPC(npcId);
    try {
      const res = await fetch("/api/npc/memories/wipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ npc_id: npcId }),
      });
      if (res.ok) {
        setRows((prev) => (prev ?? []).filter((r) => r.npc_id !== npcId));
      } else {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "Failed to wipe memory");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to wipe memory");
    } finally {
      setBusyNPC(null);
      setConfirmNPC(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: 24 }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div className="mb-2">
          <Link
            href="/student/dashboard/settings"
            className="inline-flex items-center gap-1 text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <ArrowLeft size={12} />
            Back to Settings
          </Link>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "var(--surface-chip)" }}
          >
            <Brain
              className="w-5 h-5"
              style={{ color: "var(--color-text-muted)" }}
            />
          </div>
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: "var(--color-text-main)" }}
            >
              NPC Memories
            </h1>
            <p className="text-sm font-mono text-[var(--color-text-muted)] mt-0.5">
              NPCs you&apos;ve spoken with. Wipe a memory and they&apos;ll greet
              you as a stranger.
            </p>
          </div>
        </div>

        {error ? (
          <p className="mb-4 p-3 rounded-md text-xs font-mono border bg-red-400/10 border-red-400/30 text-red-400">
            {error}
          </p>
        ) : null}

        {rows === null ? (
          <p className="text-center py-8 font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
            Loading...
          </p>
        ) : rows.length === 0 ? (
          <div
            className="text-center py-12 rounded-2xl"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--glass-border-soft)",
            }}
          >
            <p className="text-sm font-mono text-[var(--color-text-muted)]">
              No NPCs remember you yet. Go say hi to someone in the world.
            </p>
          </div>
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--glass-border-soft)",
            }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--glass-border-soft)" }}>
                  <Th>NPC</Th>
                  <Th>Interactions</Th>
                  <Th>Last seen</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.npc_id}
                    className="border-b last:border-b-0"
                    style={{ borderColor: "var(--glass-border-soft)" }}
                  >
                    <td className="px-4 py-3 text-[var(--color-text-main)]">
                      {r.npc_name}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-soft)]">
                      {r.interaction_count}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-soft)]">
                      {relativeTime(r.last_interaction_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={busyNPC === r.npc_id}
                        onClick={() => setConfirmNPC(r)}
                        className="inline-flex items-center gap-1 text-[0.65rem] font-mono uppercase tracking-wider text-red-400 hover:underline disabled:opacity-40"
                      >
                        <Trash2 size={12} />
                        Wipe Memory
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmNPC ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setConfirmNPC(null)}
        >
          <div
            className="rounded-2xl max-w-md w-full"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--glass-border-soft)",
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              className="text-lg font-bold mb-2"
              style={{ color: "var(--color-text-main)" }}
            >
              Confirm wipe
            </h2>
            <p
              className="text-sm mb-6"
              style={{ color: "var(--color-text-soft)" }}
            >
              Wipe {confirmNPC.npc_name}&apos;s memory of you? They will greet
              you as a stranger next time. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmNPC(null)}
                className="px-3 py-1.5 border border-[var(--glass-border)] text-[var(--color-text-primary)] font-mono text-[0.65rem] uppercase tracking-wider rounded-md hover:border-[var(--color-accent-cyan)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyNPC !== null}
                onClick={confirmAndWipe}
                className="px-3 py-1.5 font-mono text-[0.65rem] uppercase tracking-wider rounded-md transition-colors disabled:opacity-40"
                style={{ background: "#ef4444", color: "#fff" }}
              >
                {busyNPC ? "Wiping..." : "Wipe Memory"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-3 text-[0.65rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)]">
      {children}
    </th>
  );
}

function relativeTime(iso: string): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}
