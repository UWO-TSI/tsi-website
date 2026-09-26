export type DraftSaveResult = "saved" | "local" | "error";
export type DraftStatus = DraftSaveResult | "idle" | "saving";
export type DraftPayload<T> = { form_data: T; updated_at: string };

export const applicationDraftKey = (userId: string, positionId: string) =>
  `tethos:draft:v2:${userId}:${positionId}`;

/** Local writes happen on edit; remote writes are serialized to prevent stale responses winning. */
export function createApplicationDraft<T>({ writeLocal, removeLocal, saveRemote, onStatus, onSubmitted }: {
  writeLocal: (payload: DraftPayload<T>) => void;
  removeLocal: () => void;
  saveRemote: (data: T) => Promise<boolean | "submitted">;
  onStatus: (status: DraftStatus) => void;
  onSubmitted?: () => void;
}) {
  let latest: DraftPayload<T> | null = null;
  let revision = 0;
  let localRevision = -1;
  let remoteRevision = -1;
  let sealed = false;
  let paused = false;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queue: Promise<void> = Promise.resolve();
  const cancelTimer = () => { if (timer) clearTimeout(timer); timer = undefined; };
  const status = () => remoteRevision === revision ? "saved" : localRevision === revision ? "local" : "error";
  const notify = (state: DraftStatus) => { if (!disposed) onStatus(state); };
  const persistLocal = () => {
    if (!latest || sealed) return;
    try { writeLocal(latest); localRevision = revision; } catch { /* The remote copy can still succeed. */ }
  };
  const submitted = () => {
    sealed = true;
    cancelTimer();
    try { removeLocal(); } catch { /* The submitted application is already confirmed. */ }
    notify("saved");
  };
  const flush = async (): Promise<DraftSaveResult> => {
    cancelTimer();
    if (sealed || !latest) return "saved";
    persistLocal();
    if (paused || disposed) return status();
    const payload = latest;
    const targetRevision = revision;
    notify("saving");
    queue = queue.then(async () => {
      if (sealed || remoteRevision >= targetRevision) return;
      try {
        const result = await saveRemote(payload.form_data);
        if (result === "submitted") { submitted(); if (!disposed) onSubmitted?.(); }
        else if (result) remoteRevision = targetRevision;
      } catch { /* Preserve local answers for retry. */ }
      if (!sealed) notify(status());
    });
    await queue;
    return sealed ? "saved" : status();
  };
  return {
    activate() { disposed = false; },
    update(data: T) {
      if (sealed || disposed || paused) return;
      latest = { form_data: data, updated_at: new Date().toISOString() };
      revision += 1;
      persistLocal();
      cancelTimer();
      notify("saving");
      timer = setTimeout(() => { void flush(); }, 3000);
    },
    flush,
    async pauseForSubmission() {
      paused = true;
      cancelTimer();
      persistLocal();
      await queue;
    },
    resume() { if (!sealed) { paused = false; void flush(); } },
    submitted,
    dispose() {
      persistLocal();
      cancelTimer();
      disposed = true;
    },
  };
}

export function confirmedApplication(value: unknown, positionId: string): value is { id: string; position_id: string; already_submitted?: boolean } {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && !!row.id && row.position_id === positionId;
}

export async function readApplicationDraft<T>(response: Response, positionId: string) {
  if (!response.ok) throw new Error("Could not restore saved progress");
  const row = await response.json();
  if (confirmedApplication(row?.submitted_application, positionId)) return { submitted: true as const, draft: null };
  if (row === null) return { submitted: false as const, draft: null };
  if (!row?.form_data || typeof row.form_data !== "object" || Array.isArray(row.form_data) || !Number.isFinite(Date.parse(row.updated_at))) {
    throw new Error("Saved progress could not be read");
  }
  return { submitted: false as const, draft: row as DraftPayload<T> };
}
