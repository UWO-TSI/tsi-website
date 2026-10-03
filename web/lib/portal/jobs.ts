/** The job board's client side, in job_listings' own fields (001_initial_schema, /api/jobs). */
import type { JobListing, JobType } from "@/lib/supabase/types";

export type JobForm = Pick<JobListing, "title" | "company" | "job_type" | "url"> & { location: string; description: string };

export const emptyJobForm = (): JobForm => ({ title: "", company: "", job_type: "internship", location: "", url: "", description: "" });

const FIELD_NAMES: Record<string, string> = { title: "Role", company: "Company", job_type: "Type", url: "Link to apply", location: "Location", description: "Description" };

/** POST /api/jobs: the new listing, or the route's own reason it refused (a field's error first). */
export async function submitJob(form: JobForm, post: typeof fetch = fetch): Promise<{ ok: true; job: JobListing } | { ok: false; error: string }> {
  try {
    const res = await post("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, location: form.location.trim() || null, description: form.description.trim() || null }),
    });
    const body = await res.json().catch(() => null);
    if (res.ok && body?.job) return { ok: true, job: body.job as JobListing };
    const fields = Object.entries((body?.details?.fieldErrors ?? {}) as Record<string, string[]>);
    const [field, [message] = []] = fields[0] ?? [];
    return { ok: false, error: field && message ? `${FIELD_NAMES[field] ?? field}: ${message}` : body?.error ?? "That didn’t post. Try again." };
  } catch {
    return { ok: false, error: "Couldn’t reach the board. Check your connection and try again." };
  }
}

/** Only http(s) links become an Apply button (a posted `javascript:` link never does). */
export const isWebLink = (url: string) => /^https?:\/\//i.test(url);

export const JOB_TYPES: { id: JobType; label: string }[] = [
  { id: "internship", label: "Internship" },
  { id: "full_time", label: "Full-time" },
  { id: "part_time", label: "Part-time" },
  { id: "contract", label: "Contract" },
];

/** Saved jobs live on this device (localStorage), like the portal's other conveniences. */
const SAVED_KEY = "tsi.jobs.saved";
type KeyStore = Pick<Storage, "getItem" | "setItem">;

export function readSaved(storage: KeyStore | undefined = globalThis.localStorage): Set<string> {
  try {
    const ids: unknown = JSON.parse(storage?.getItem(SAVED_KEY) ?? "[]");
    return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

export function writeSaved(ids: Set<string>, storage: KeyStore | undefined = globalThis.localStorage): void {
  try {
    storage?.setItem(SAVED_KEY, JSON.stringify([...ids]));
  } catch { /* private mode: saved for this visit only */ }
}
