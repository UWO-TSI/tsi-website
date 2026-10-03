"use client";

// ─── Shared bits for the Main Quest / Club Goal editors ─────────────────────
// Same draft → preview → publish flow as EmoteEditor/NPCEditor, through
// /api/content/drafts (versioned in content_versions, listed in the activity log).

import { cloneElement, isValidElement, useEffect, useId, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { useUser } from "@/components/portal/UserContext";
import { createClient } from "@/lib/supabase/client";
import { Button, Empty, ErrorNote, Loading, Select, Toggle as KitToggle } from "@/components/gui";
import kit from "@/components/recruit/ui/village-ui.module.css";

// The admin tools on the GUI sheet (components/gui): fields and buttons in the kit's paper, ink and sage. The class
// strings are for native controls and older callers; real buttons use <Button>, links use `buttonLinkCls`.
export const inputCls =
  "w-full min-h-[44px] px-3.5 py-2 rounded-[16px_14px_16px_15px] border-2 border-[var(--gui-paper-line)] bg-[var(--gui-paper-hi)] text-[15px] font-semibold text-[var(--gui-ink)] shadow-[inset_0_2px_0_rgb(114_92_78/0.06)] placeholder:text-[var(--gui-muted)] placeholder:font-normal focus:border-[var(--gui-sage)] disabled:bg-[var(--gui-paper-deep)] disabled:text-[var(--gui-muted)] disabled:cursor-not-allowed transition-colors";
const btnCls =
  "inline-flex items-center justify-center gap-2 min-h-[40px] px-[18px] py-1.5 rounded-[50%_48%_45%_47%/48%_51%_45%_49%] text-sm font-extrabold no-underline cursor-pointer transition-[transform,background-color] duration-[120ms] hover:-translate-y-0.5 active:translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:bg-[#e9e3d3] disabled:text-[#847c68] disabled:shadow-[0_3px_0_#d0c8b6]";
export const primaryBtnCls = `${btnCls} bg-[var(--gui-sage)] text-[var(--gui-paper)] shadow-[0_3px_0_var(--gui-sage-deep)] hover:bg-[#4b7a68]`;
export const publishBtnCls = primaryBtnCls;
export const dangerBtnCls = `${btnCls} bg-[var(--gui-danger-soft)] text-[var(--gui-danger)] shadow-[0_3px_0_#e2b3a3] hover:bg-[#fbd3c5]`;
/** A link that wears the kit's button (the recruit kit's own classes); add data-size="sm" and a data-variant. */
export const buttonLinkCls = `${kit.theme} ${kit.button}`;
/** "Back to …" above an editor's title. */
export const backLinkCls = "inline-flex items-center gap-1.5 text-sm font-bold text-[var(--gui-ink-2)] hover:text-[var(--gui-ink-strong)]";
export const thCls = "text-left px-4 py-3 text-[13px] font-extrabold text-[var(--gui-ink-2)] whitespace-nowrap";

/** A labelled form row. A lone input, select or textarea gets the label's id, so the label names it. */
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  const id = useId();
  const noteId = `${id}-note`;
  const single = isValidElement<{ id?: string; "aria-describedby"?: string }>(children)
    && (children.type === "input" || children.type === "select" || children.type === "textarea" || children.type === Select);
  const controlId = single ? (children.props.id ?? id) : undefined;
  return (
    <div>
      <label htmlFor={controlId} className="block mb-1.5 text-[15px] font-extrabold text-[var(--gui-ink-strong)]">{label}</label>
      {single ? cloneElement(children, { id: controlId, "aria-describedby": children.props["aria-describedby"] ?? (hint || error ? noteId : undefined) }) : children}
      {hint && !error ? <p id={noteId} className="mt-1.5 text-[13px] text-[var(--gui-muted)]">{hint}</p> : null}
      {error ? <p id={noteId} className="mt-1.5 text-[13px] font-bold text-[var(--gui-danger)]">{error}</p> : null}
    </div>
  );
}

/** On or off: the kit's switch with its label and hint (the label at the form's 15 px, which the switch inherits). */
export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <div className="text-[15px] text-[var(--gui-ink-strong)]"><KitToggle checked={checked} onChange={onChange} hint={hint}>{label}</KitToggle></div>;
}

/** What still stands between the form and a save, as a short list (nothing once it's ready). */
export function FixList({ errors, className }: { errors: string[]; className?: string }) {
  if (!errors.length) return null;
  return (
    <div className={`rounded-2xl px-4 py-3 bg-[var(--gui-warn-soft)] ${className ?? ""}`}>
      <p className="text-sm font-extrabold text-[var(--gui-ink-strong)]">Before you can save</p>
      <ul className="mt-1 list-disc pl-5 space-y-0.5 text-[13px] font-semibold text-[var(--gui-ink)]">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
    </div>
  );
}

/** A save or load result: a soft green line, or an error note. */
export function AdminMessage({ message, className }: { message: { kind: "ok" | "err"; text: string } | null; className?: string }) {
  if (!message) return null;
  if (message.kind === "err") return <ErrorNote className={className}>{message.text}</ErrorNote>;
  return <p role="status" className={`rounded-2xl px-4 py-2.5 text-sm font-bold bg-[var(--gui-success-soft)] text-[var(--gui-success)] ${className ?? ""}`}>{message.text}</p>;
}

export function AdminGate({ children }: { children: ReactNode }) {
  const { profile, loading } = useUser();
  if (loading) return <Loading label="Checking your access…" />;
  if ((profile?.tier ?? 5) > 2) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Empty icon={<Lock size={32} />} title="Admins only">These tools are for T1 and T2 admins.</Empty>
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

/** Save as draft, then Publish (the main action once a draft exists) or Discard. */
export function DraftBar({ flow, canSave, onSave }: { flow: ReturnType<typeof useDraftFlow>; canSave: boolean; onSave: () => void }) {
  return (
    <>
      <AdminMessage message={flow.message} className="mt-4" />
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button size="sm" variant={flow.draftId ? "quiet" : "primary"} onClick={onSave} disabled={!canSave || flow.busy !== null}>
          {flow.busy === "save" ? "Saving…" : "Save as draft"}
        </Button>
        {flow.draftId ? (
          <Button size="sm" onClick={flow.publish} disabled={flow.busy !== null}>
            {flow.busy === "publish" ? "Publishing…" : "Publish"}
          </Button>
        ) : null}
        {flow.draftId ? (
          <Button size="sm" variant="danger" onClick={flow.discard} disabled={flow.busy !== null}>
            {flow.busy === "discard" ? "Discarding…" : "Discard draft"}
          </Button>
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
