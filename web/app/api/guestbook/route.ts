import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── Guestbook API (sprint E6) ──────────────────────────────────────────────
// GET  /api/guestbook       — last 20 non-hidden entries, joined with profile.
// POST /api/guestbook       — body: { message }, 1-200 chars, rate-limit 5/day,
//                              server-side profanity guard.

const LIST_LIMIT = 20;
const MAX_MESSAGE_LEN = 200;
const RATE_LIMIT_COUNT = 5;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

// Same blocklist pattern as /api/npc/chat. Caught at the door before INSERT.
const PROFANITY_BLOCKLIST = [
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "cunt",
  "dick",
  "pussy",
  "slut",
  "whore",
  "fag",
  "faggot",
  "nigger",
  "nigga",
  "retard",
  "tranny",
  "kike",
  "spic",
  "chink",
  "gook",
];

// In-memory rate limit: resets per server-instance / cold start. Acceptable
// for a low-volume admin-tier signing surface; upgrade to a durable store if
// abuse appears.
const userRateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = userRateLimits.get(userId);
  if (!entry || entry.resetAt < now) {
    userRateLimits.set(userId, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return true;
  }
  if (entry.count >= RATE_LIMIT_COUNT) return false;
  entry.count += 1;
  return true;
}

function containsProfanity(message: string): boolean {
  const lowered = message.toLowerCase();
  return PROFANITY_BLOCKLIST.some((bad) => {
    const re = new RegExp(`\\b${bad}\\b`, "i");
    return re.test(lowered);
  });
}

interface EntryRow {
  id: string;
  user_id: string | null;
  message: string;
  created_at: string;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  tier: number | null;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: entries, error } = await supabase
    .from("guestbook_entries")
    .select("id, user_id, message, created_at")
    .eq("hidden", false)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);

  if (error) {
    return NextResponse.json(
      { error: "Failed to load guestbook" },
      { status: 500 },
    );
  }

  const rows = (entries ?? []) as EntryRow[];
  const userIds = Array.from(
    new Set(rows.map((r) => r.user_id).filter(Boolean)),
  ) as string[];

  let profileMap: Record<string, { display_name: string; tier: number }> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, tier")
      .in("id", userIds);
    profileMap = ((profiles ?? []) as ProfileRow[]).reduce<
      Record<string, { display_name: string; tier: number }>
    >((acc, p) => {
      acc[p.id] = {
        display_name: p.display_name ?? "Anonymous",
        tier: p.tier ?? 5,
      };
      return acc;
    }, {});
  }

  const enriched = rows.map((r) => ({
    id: r.id,
    message: r.message,
    created_at: r.created_at,
    display_name: r.user_id ? (profileMap[r.user_id]?.display_name ?? "Anonymous") : "Anonymous",
    tier: r.user_id ? (profileMap[r.user_id]?.tier ?? 5) : 5,
  }));

  return NextResponse.json({ entries: enriched });
}

export async function POST(request: Request) {
  let body: { message?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawMessage = typeof body.message === "string" ? body.message : "";
  const message = rawMessage.trim().slice(0, MAX_MESSAGE_LEN);

  if (message.length === 0) {
    return NextResponse.json({ error: "Message is empty" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LEN) {
    return NextResponse.json(
      { error: `Message must be ${MAX_MESSAGE_LEN} characters or fewer.` },
      { status: 400 },
    );
  }
  if (containsProfanity(message)) {
    return NextResponse.json(
      { error: "Please keep messages respectful." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!checkRateLimit(user.id)) {
    return NextResponse.json(
      { error: "You've reached the daily signing limit. Try again tomorrow." },
      { status: 429 },
    );
  }

  const admin = createAdminClient();
  const { data: inserted, error: insertErr } = await admin
    .from("guestbook_entries")
    .insert({ user_id: user.id, message })
    .select("id, message, created_at")
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: "Failed to save entry" },
      { status: 500 },
    );
  }

  return NextResponse.json({ entry: inserted });
}
