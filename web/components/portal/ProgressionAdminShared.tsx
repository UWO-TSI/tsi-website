"use client";

// ─── Shared bits for the Main Quest / Club Goal editors ─────────────────────
// Same draft → preview → publish flow as EmoteEditor/NPCEditor, through
// /api/content/drafts (versioned in content_versions, listed in the activity log).

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import { useUser } from "@/components/portal/UserContext";
import { createClient } from "@/lib/supabase/client";

export const inputCls =
  "w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--glass-border)] rounded-md text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent-cyan)] transition-colors";
export const primaryBtnCls =
  "inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-accent-cyan)] text-[var(--color-bg)] text-xs uppercase tracking-wider rounded-md hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity";
export const publishBtnCls =
  "inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white text-xs uppercase tracking-wider rounded-md hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity";
export const dangerBtnCls =
  "inline-flex items-center gap-2 px-4 py-2 border border-[var(--gui-danger)]/30 text-[var(--gui-danger)] text-xs uppercase tracking-wider rounded-md hover:bg-[var(--gui-danger-soft)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors";
export const thCls = "text-left px-4 py-3 text-xs  uppercase tracking-wider text-[var(--color-text-muted)]";

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">{label}</label>
      {children}
      {hint && !error ? <p className="mt-1 text-xs text-[var(--color-text-muted)]/70">{hint}</p> : null}
      {error ? <p className="mt-1 text-xs text-[var(--gui-danger)]">{error}</p> : null}
    </div>
  );
}

export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border border-[var(--glass-border)] transition-colors ${checked ? "bg-[var(--color-accent-cyan)]" : "bg-[var(--color-bg)]"}`}
      >
        <span className={`inline-block h-4 w-4 mt-0.5 transform rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
      <div className="flex-1">
        <span className="block text-xs text-[var(--color-text-primary)]">{label}</span>
        {hint ? <p className="text-xs text-[var(--color-text-muted)]/70 mt-0.5">{hint}</p> : null}
      </div>
    </div>
  );
}

export function AdminGate({ children }: { children: ReactNode }) {
  const { profile, loading } = useUser();
  if (loading) return <p className="text-center py-8 text-sm text-[var(--color-text-muted)] animate-pulse">Loading...</p>;
  if ((profile?.tier ?? 5) > 2) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield size={48} className="mx-auto text-[var(--color-text-muted)]/20 mb-4" />
          <h2 className="text-lg font-heading font-bold text-[var(--color-text-primary)] mb-2">Access Denied</h2>
          <p className="text-sm text-[var(--color-text-muted)]">T1/T2 clearance required for content admin.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

/** Load one live row for an edit/history page. */
export function useContentRow<T>(table: string, id: string): { row: T | null; loading: boolean; error: string | null } {
  const [state, setState] = useState<{ row: T | null; loading: boolean; error: string | null }>({ row: null, loading: true, error: null });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await createClient().from(table).select("*").eq("id", id).single();
        if (!cancelled) setState({ row: (data as T) ?? null, loading: false, error: error ? error.message : data ? null : "Not found" });
      } catch (err) {
        if (!cancelled) setState({ row: null, loading: false, error: err instanceof Error ? err.message : "Failed to load" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [table, id]);
  return state;
}

/** Save-as-draft / publish / discard, identical to the other content editors. */
export function useDraftFlow(table: string, rowId: string | undefined, backHref: string) {
  const router = useRouter();
  const [draftId, setDraftId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "publish" | "discard" | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const run = async (kind: "save" | "publish" | "discard", url: string, body?: unknown) => {
    setBusy(kind);
    setMessage(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setMessage({ kind: "err", text: json.error ?? `${kind} failed` });
        return null;
      }
      return json;
    } catch (err) {
      setMessage({ kind: "err", text: err instanceof Error ? err.message : `${kind} failed` });
      return null;
    } finally {
      setBusy(null);
    }
  };

  return {
    draftId,
    busy,
    message,
    save: async (draftData: Record<string, unknown>) => {
      const json = await run("save", "/api/content/drafts", { table_name: table, row_id: rowId ?? null, draft_data: draftData });
      if (json) {
        setDraftId(json.draft.id as string);
        setMessage({ kind: "ok", text: "Draft saved. Publish to make it live." });
      }
    },
    publish: async () => {
      if (!draftId) return;
      const json = await run("publish", `/api/content/drafts/${draftId}/publish`);
      if (json) router.push(backHref);
    },
    discard: async () => {
      if (!draftId || (typeof window !== "undefined" && !window.confirm("Discard this draft?"))) return;
      const json = await run("discard", `/api/content/drafts/${draftId}/discard`);
      if (json) {
        setDraftId(null);
        setMessage({ kind: "ok", text: "Draft discarded." });
      }
    },
  };
}

export function DraftBar({ flow, canSave, onSave }: { flow: ReturnType<typeof useDraftFlow>; canSave: boolean; onSave: () => void }) {
  return (
    <>
      {flow.message ? (
        <div className={`mt-4 p-3 rounded-md text-xs border ${flow.message.kind === "ok" ? "bg-[var(--gui-success-soft)] border-[var(--gui-success)]/30 text-[var(--gui-success)]" : "bg-[var(--gui-danger-soft)] border-[var(--gui-danger)]/30 text-[var(--gui-danger)]"}`}>
          {flow.message.text}
        </div>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onSave} disabled={!canSave || flow.busy !== null} className={primaryBtnCls}>
          {flow.busy === "save" ? "Saving..." : "Save as draft"}
        </button>
        {flow.draftId ? (
          <button type="button" onClick={flow.publish} disabled={flow.busy !== null} className={publishBtnCls}>
            {flow.busy === "publish" ? "Publishing..." : "Publish"}
          </button>
        ) : null}
        {flow.draftId ? (
          <button type="button" onClick={flow.discard} disabled={flow.busy !== null} className={dangerBtnCls}>
            {flow.busy === "discard" ? "Discarding..." : "Discard draft"}
          </button>
        ) : null}
      </div>
    </>
  );
}

export const listToText = (v: string[] | null | undefined) => (v ?? []).join(", ");
export const textToList = (v: string) => v.split(",").map((x) => x.trim()).filter(Boolean);

export function useGoalSlugs(): string[] {
  const [slugs, setSlugs] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await createClient().from("club_goals").select("slug").order("position");
      if (!cancelled) setSlugs(((data ?? []) as { slug: string }[]).map((g) => g.slug));
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return slugs;
}
