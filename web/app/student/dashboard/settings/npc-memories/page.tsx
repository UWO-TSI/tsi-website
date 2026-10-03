"use client";

// ─── User-Facing NPC Memory Wipe (D7) ──────────────────────────────────────
// Lists every NPC the calling user has talked to + interaction count + last
// interaction. Per-row "Wipe memory" button calls /api/npc/memories/wipe and
// removes the row from the list on success.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Brain, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Banner, Button, Card, ConfirmDialog, Empty, ErrorNote, List, ListRow, Loading } from "@/components/gui";

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
        setError("You’re signed out. Sign in to see who remembers you.");
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
        setError("Your NPC memories didn’t load. Try again in a moment.");
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
          npc_name: joined?.display_name ?? "Unknown NPC",
          interaction_count: r.interaction_count,
          last_interaction_at: r.last_interaction_at,
        };
      });
      setRows(list);
    } catch {
      setError("Your NPC memories didn’t load. Try again in a moment.");
      setRows([]);
    }
  }, []);

  useEffect(() => {

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
        setError(res.status === 401 ? "You’re signed out. Sign in and try again." : "That memory didn’t wipe. Try again.");
      }
    } catch {
      setError("That memory didn’t wipe. Check your connection and try again.");
    } finally {
      setBusyNPC(null);
      setConfirmNPC(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: "24px 20px 48px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link
          href="/student/dashboard/settings"
          className="inline-flex items-center gap-1.5 mb-3 text-sm transition-colors text-[var(--gui-ink-2)] hover:text-[var(--gui-sage)]"
          style={{ fontWeight: 800, minHeight: 32 }}
        >
          <ArrowLeft size={16} aria-hidden />
          Back to settings
        </Link>

        <Banner title="NPC memories" icon={<Brain size={26} />} tone="sage">
          The NPCs you&apos;ve talked to. Wipe a memory and they&apos;ll greet you as a stranger.
        </Banner>

        {error ? <ErrorNote onRetry={load} className="mb-4">{error}</ErrorNote> : null}

        {rows === null ? (
          <Loading label="Checking who remembers you…" />
        ) : rows.length === 0 ? (
          error ? null : (
            <Empty icon={<Brain size={32} />} title="No NPCs remember you yet">
              Go say hi to someone on the island.
            </Empty>
          )
        ) : (
          <Card style={{ padding: "6px 8px" }}>
            <List label="NPCs who remember you">
              {rows.map((r) => (
                <ListRow
                  key={r.npc_id}
                  title={r.npc_name}
                  detail={`Talked ${r.interaction_count} time${r.interaction_count === 1 ? "" : "s"} · last seen ${relativeTime(r.last_interaction_at)}`}
                  value={
                    <Button size="sm" variant="danger" disabled={busyNPC === r.npc_id} onClick={() => setConfirmNPC(r)}>
                      <Trash2 size={16} aria-hidden />
                      Wipe memory
                    </Button>
                  }
                />
              ))}
            </List>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={confirmNPC !== null}
        title="Wipe this memory?"
        danger
        busy={busyNPC !== null}
        confirmLabel="Wipe memory"
        cancelLabel="Keep it"
        onConfirm={confirmAndWipe}
        onCancel={() => setConfirmNPC(null)}
      >
        {confirmNPC && (
          <p>
            {confirmNPC.npc_name} will forget you and greet you as a stranger next time. This can&apos;t be undone.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}

function relativeTime(iso: string): string {
  if (!iso) return "a while ago";
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
