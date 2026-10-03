import { beforeEach, describe, expect, it, vi } from "vitest";

const ME = "00000000-0000-4000-8000-0000000000aa";
const db = vi.hoisted(() => ({ inserted: [] as Record<string, unknown>[] }));
// /api/jobs over a table that keeps what the route inserts.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "00000000-0000-4000-8000-0000000000aa" } } }) },
    from: () => ({
      insert: (row: Record<string, unknown>) => ({
        select: () => ({ single: async () => (db.inserted.push(row), { data: { id: "job-1", created_at: "2026-10-03T12:00:00Z", is_flagged: false, ...row }, error: null }) }),
      }),
    }),
  }),
}));

import { POST } from "@/app/api/jobs/route";
import { emptyJobForm, isWebLink, readSaved, submitJob, writeSaved } from "./jobs";

/** fetch, answered by the real route handler. */
const toRoute = ((url: string, init?: RequestInit) => POST(new Request(`http://localhost${url}`, init))) as typeof fetch;

beforeEach(() => { db.inserted = []; });

describe("the job board (#21)", () => {
  it("posts what the form holds in the table's own fields, and the route takes it", async () => {
    const form = { ...emptyJobForm(), title: "Software Engineer Intern", company: "Shopify", job_type: "full_time" as const, url: "https://shopify.com/careers/1" };
    const r = await submitJob(form, toRoute);
    expect(r).toMatchObject({ ok: true, job: { id: "job-1", title: "Software Engineer Intern", company: "Shopify", job_type: "full_time" } });
    expect(db.inserted[0]).toMatchObject({ title: "Software Engineer Intern", company: "Shopify", job_type: "full_time", url: "https://shopify.com/careers/1", posted_by: ME });
  });
  it("shows the route's own error and doesn't pretend it worked", async () => {
    const r = await submitJob({ ...emptyJobForm(), title: "Designer", company: "Tethos", url: "tethos.ca/jobs" }, toRoute);
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/^Link to apply: /) });
    expect(db.inserted).toHaveLength(0);
    const offline = (async () => { throw new TypeError("Failed to fetch"); }) as typeof fetch;
    expect(await submitJob({ ...emptyJobForm(), title: "Designer", company: "Tethos", url: "https://tethos.ca" }, offline)).toMatchObject({ ok: false });
  });
  it("never takes or shows a non-web link as the Apply button", async () => {
    const r = await submitJob({ ...emptyJobForm(), title: "Designer", company: "Tethos", url: "javascript:alert(document.cookie)" }, toRoute);
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/^Link to apply: /) });
    expect(db.inserted).toHaveLength(0);
    expect([isWebLink("https://tethos.ca/jobs"), isWebLink("http://x.ca"), isWebLink("javascript:alert(1)"), isWebLink("data:text/html,hi")]).toEqual([true, true, false, false]);
  });
  it("keeps saved jobs across a reload", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    writeSaved(new Set(["job-1", "job-7"]), storage);
    expect([...readSaved(storage)].sort()).toEqual(["job-1", "job-7"]);
    expect(readSaved({ getItem: () => "not json", setItem: () => {} }).size).toBe(0);
  });
});
