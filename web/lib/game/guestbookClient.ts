export interface GuestbookEntry {
  id: string;
  message: string;
  created_at: string;
  display_name: string;
  tier: number;
}
export type SavedGuestbookEntry = Pick<GuestbookEntry, "id" | "message" | "created_at">;
export interface GuestbookTransport {
  list: (signal: AbortSignal) => Promise<GuestbookEntry[]>;
  sign: (message: string, signal: AbortSignal) => Promise<SavedGuestbookEntry>;
}

export class GuestbookRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
function savedEntry(value: unknown): value is SavedGuestbookEntry {
  return record(value) && typeof value.id === "string" && value.id.length > 0 && typeof value.message === "string" && typeof value.created_at === "string" && Number.isFinite(Date.parse(value.created_at));
}

async function check(response: Response): Promise<void> {
  if (response.ok) return;
  let message = "Guestbook request failed";
  if (response.status === 400) {
    const body = await response.json().catch(() => null);
    if (record(body) && typeof body.error === "string" && body.error.trim()) message = body.error.slice(0, 300);
  }
  throw new GuestbookRequestError(message, response.status);
}

export const guestbookTransport: GuestbookTransport = {
  async list(signal) {
    const response = await fetch("/api/guestbook", { signal });
    await check(response);
    const body: unknown = await response.json();
    if (!record(body) || !Array.isArray(body.entries)) throw new Error("Invalid guestbook response");
    const seen = new Set<string>();
    return body.entries.filter((row): row is GuestbookEntry => {
      if (!savedEntry(row) || seen.has(row.id)) return false;
      seen.add(row.id); return true;
    }).slice(0, 20).map((row) => ({
      id: row.id, message: row.message, created_at: row.created_at,
      display_name: typeof row.display_name === "string" ? row.display_name : "Anonymous",
      tier: typeof row.tier === "number" && Number.isInteger(row.tier) && row.tier >= 1 && row.tier <= 5 ? row.tier : 5,
    }));
  },
  async sign(message, signal) {
    const response = await fetch("/api/guestbook", { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
    await check(response);
    const body: unknown = await response.json();
    if (!record(body) || !savedEntry(body.entry)) throw new Error("Guestbook save acknowledgement missing");
    return { id: body.entry.id, message: body.entry.message, created_at: body.entry.created_at };
  },
};

export function guestbookSignError(error: unknown): string {
  if (error instanceof GuestbookRequestError) {
    if (error.status === 401) return "Please sign in to leave a message.";
    if (error.status === 429) return "Signing limit reached. Try again later.";
    if (error.status === 400) return error.message;
  }
  return "Couldn’t confirm whether your message was saved. Refresh the wall before trying again.";
}
