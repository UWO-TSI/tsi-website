/**
 * Letters and notes (row 95): text only, length-limited, rate-limited,
 * reportable. No attachments, no item or currency transfer (row 46).
 */
import { containsProfanity } from "@/lib/moderation/profanity";

export const NOTE_MAX_LEN = 500;
export const SUBJECT_MAX_LEN = 80;
export const NOTES_PER_DAY = 10;
export const NOTES_PER_RECIPIENT_PER_DAY = 3;
export const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type NoteCheck = { ok: true; subject: string; body: string } | { ok: false; error: string };

export function validateNote(input: { subject?: unknown; body?: unknown }): NoteCheck {
  const body = typeof input.body === "string" ? input.body.trim() : "";
  const subject = typeof input.subject === "string" ? input.subject.trim() : "";
  if (!body) return { ok: false, error: "Write something first." };
  if (body.length > NOTE_MAX_LEN) return { ok: false, error: `Keep notes under ${NOTE_MAX_LEN} characters.` };
  if (subject.length > SUBJECT_MAX_LEN) return { ok: false, error: `Keep the subject under ${SUBJECT_MAX_LEN} characters.` };
  if (containsProfanity(body) || containsProfanity(subject)) return { ok: false, error: "Please keep notes respectful." };
  return { ok: true, subject, body };
}

export function noteRateLimit(sentToday: number, sentToRecipientToday: number): { ok: true } | { ok: false; error: string } {
  if (sentToday >= NOTES_PER_DAY) return { ok: false, error: "You've sent today's notes. Try again tomorrow." };
  if (sentToRecipientToday >= NOTES_PER_RECIPIENT_PER_DAY) return { ok: false, error: "You've written to them a few times today. Give it a day." };
  return { ok: true };
}
