import { afterEach, describe, expect, it, vi } from "vitest";
import { applicationDraftKey, confirmedApplication, createApplicationDraft, readApplicationDraft, type DraftPayload } from "./application-draft";

type Answers = { answer: string };
function setup() {
  let local: DraftPayload<Answers> | null = null;
  const writeLocal = vi.fn((value: DraftPayload<Answers>) => { local = value; });
  const removeLocal = vi.fn(() => { local = null; });
  const saveRemote = vi.fn<(data: Answers) => Promise<boolean | "submitted">>(async () => true);
  const onStatus = vi.fn();
  const draft = createApplicationDraft({ writeLocal, removeLocal, saveRemote, onStatus });
  return { draft, writeLocal, removeLocal, saveRemote, onStatus, local: () => local };
}
afterEach(() => { vi.useRealTimers(); });

describe("application draft persistence", () => {
  it("never treats failed or unreadable restoration as an empty draft", async () => {
    await expect(readApplicationDraft(Response.json({ error: "Unavailable" }, { status: 503 }), "external")).rejects.toThrow();
    await expect(readApplicationDraft(Response.json({ unexpected: true }), "external")).rejects.toThrow();
    expect(await readApplicationDraft(Response.json(null), "external")).toEqual({ submitted: false, draft: null });
  });

  it("recognizes a confirmed submission before restoring a stale local draft", async () => {
    expect(await readApplicationDraft(Response.json({ submitted_application: { id: "app1", position_id: "external" } }), "external")).toEqual({ submitted: true, draft: null });
    await expect(readApplicationDraft(Response.json({ submitted_application: { id: "app1", position_id: "internal" } }), "external")).rejects.toThrow();
  });

  it("isolates local drafts by both account and role", () => {
    expect(applicationDraftKey("alice", "external")).not.toBe(applicationDraftKey("bob", "external"));
    expect(applicationDraftKey("alice", "external")).not.toBe(applicationDraftKey("alice", "internal"));
    expect(applicationDraftKey("alice", "external")).not.toBe("tethos:draft:external");
  });

  it("keeps the last keystroke when the form closes before debounce", () => {
    vi.useFakeTimers();
    const s = setup();
    s.draft.update({ answer: "first" });
    s.draft.update({ answer: "finished answer" });
    s.draft.dispose();
    expect(s.local()?.form_data.answer).toBe("finished answer");
    vi.advanceTimersByTime(1000);
    expect(s.saveRemote).not.toHaveBeenCalled();
  });

  it("flushes immediately when closing and returns confirmed remote status", async () => {
    const s = setup();
    s.draft.update({ answer: "ready" });
    expect(await s.draft.flush()).toBe("saved");
    expect(s.saveRemote).toHaveBeenCalledWith({ answer: "ready" });
    s.draft.dispose();
  });

  it("reports local-only recovery when the remote request fails, then retries", async () => {
    const s = setup();
    s.saveRemote.mockRejectedValueOnce(new Error("offline"));
    s.draft.update({ answer: "keep this" });
    expect(await s.draft.flush()).toBe("local");
    expect(s.local()?.form_data.answer).toBe("keep this");
    expect(await s.draft.flush()).toBe("saved");
    s.draft.dispose();
  });

  it("does not claim a local save when storage and remote both fail", async () => {
    const s = setup();
    s.writeLocal.mockImplementation(() => { throw new Error("quota"); });
    s.saveRemote.mockResolvedValue(false);
    s.draft.update({ answer: "still in memory" });
    expect(await s.draft.flush()).toBe("error");
    expect(s.onStatus).toHaveBeenLastCalledWith("error");
    s.saveRemote.mockResolvedValue(true);
    expect(await s.draft.flush()).toBe("saved");
    s.draft.dispose();
  });

  it("serializes slow writes so old answers cannot overwrite newer ones", async () => {
    const s = setup();
    let finishFirst!: (result: boolean) => void;
    s.saveRemote.mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }));
    s.draft.update({ answer: "older" });
    const first = s.draft.flush();
    await Promise.resolve();
    s.draft.update({ answer: "newer" });
    const second = s.draft.flush();
    expect(s.saveRemote).toHaveBeenCalledTimes(1);
    expect(s.local()?.form_data.answer).toBe("newer");
    finishFirst(true);
    await Promise.all([first, second]);
    expect(s.saveRemote.mock.calls.map(([value]) => value.answer)).toEqual(["older", "newer"]);
    expect(s.onStatus).toHaveBeenLastCalledWith("saved");
    s.draft.dispose();
  });

  it("drains in-flight saves before submission and fences all later autosaves", async () => {
    const s = setup();
    let finish!: (result: boolean) => void;
    s.saveRemote.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    s.draft.update({ answer: "application" });
    const pending = s.draft.flush();
    await Promise.resolve();
    let ready = false;
    const pause = s.draft.pauseForSubmission().then(() => { ready = true; });
    await Promise.resolve();
    expect(ready).toBe(false);
    s.draft.update({ answer: "blocked edit" });
    expect(s.local()?.form_data.answer).toBe("application");
    finish(true);
    await Promise.all([pending, pause]);
    s.draft.submitted();
    s.draft.update({ answer: "must not resurrect" });
    await s.draft.flush();
    expect(s.local()).toBeNull();
    expect(s.saveRemote).toHaveBeenCalledTimes(1);
    s.draft.dispose();
    expect(s.local()).toBeNull();
  });

  it("retains answers and resumes saving after a rejected submission", async () => {
    const s = setup();
    s.draft.update({ answer: "closed role keeps this" });
    await s.draft.pauseForSubmission();
    s.draft.resume();
    await s.draft.flush();
    expect(s.removeLocal).not.toHaveBeenCalled();
    expect(s.local()?.form_data.answer).toBe("closed role keeps this");
    s.draft.dispose();
  });

  it("does not report success for a malformed or mismatched application response", () => {
    expect(confirmedApplication({ ok: true }, "external")).toBe(false);
    expect(confirmedApplication({ id: "app1", position_id: "internal" }, "external")).toBe(false);
    expect(confirmedApplication({ id: "", position_id: "external" }, "external")).toBe(false);
    expect(confirmedApplication({ id: "app1", position_id: "external" }, "external")).toBe(true);
    expect(confirmedApplication({ id: "app1", position_id: "external", already_submitted: true }, "external")).toBe(true);
  });

  it("discards a stale draft only when the server confirms an existing submission", async () => {
    const onSubmitted = vi.fn();
    const removeLocal = vi.fn();
    const saveRemote = vi.fn<() => Promise<"submitted">>(async () => "submitted");
    const draft = createApplicationDraft<Answers>({ writeLocal: vi.fn(), removeLocal, saveRemote, onStatus: vi.fn(), onSubmitted });
    draft.update({ answer: "older tab" });
    expect(await draft.flush()).toBe("saved");
    expect(onSubmitted).toHaveBeenCalledOnce();
    expect(removeLocal).toHaveBeenCalledOnce();
    draft.update({ answer: "later edit" });
    await draft.flush();
    expect(saveRemote).toHaveBeenCalledOnce();
    draft.dispose();
  });
});
