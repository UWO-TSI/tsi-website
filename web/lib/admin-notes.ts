// Per-admin notes are stored inside the existing applications.admin_notes
// TEXT column as a JSON-encoded array. Legacy plain-string notes are
// surfaced as a single read-only "(legacy)" entry so nothing is lost.

export interface AdminNote {
  author_email: string;
  author_name?: string;
  text: string;
  updated_at: string;
}

export function parseAdminNotes(raw: string | null | undefined): AdminNote[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (n): n is AdminNote =>
          n &&
          typeof n.author_email === "string" &&
          typeof n.text === "string" &&
          typeof n.updated_at === "string"
      );
    }
  } catch {
    // Fall through — pre-JSON legacy note
  }
  return [
    {
      author_email: "(legacy)",
      text: raw,
      updated_at: "",
    },
  ];
}

export function serializeAdminNotes(notes: AdminNote[]): string {
  return JSON.stringify(notes);
}

export function upsertAdminNote(
  notes: AdminNote[],
  authorEmail: string,
  authorName: string | undefined,
  text: string
): AdminNote[] {
  const now = new Date().toISOString();
  const next = notes.filter((n) => n.author_email !== authorEmail);
  if (text.trim()) {
    next.push({
      author_email: authorEmail,
      author_name: authorName,
      text,
      updated_at: now,
    });
  }
  return next;
}
