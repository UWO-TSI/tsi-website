/** Shared pieces for the portal pages' loads and saves: a page never spins forever, and a failure is said. */
type Result<T> = { data: T; error: { message: string } | null };

/**
 * Run a page's load to an end state: "signed-out" when it answers null, "error" when it throws (no Supabase, a failed
 * query, the network), else "ready". The page shows its spinner only until this settles.
 */
export async function settle(load: () => Promise<unknown>): Promise<"ready" | "signed-out" | "error"> {
  try {
    return (await load()) === null ? "signed-out" : "ready";
  } catch {
    return "error";
  }
}

/** A Supabase result's data, or its error thrown. */
export function must<T>(r: Result<T>): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

const fieldName = (key: string) => key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");

/** What a failed route said: its first field error ("Display name: …"), else its error, else `fallback`. */
export async function apiError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  const [field, [message] = []] = Object.entries((body?.details?.fieldErrors ?? {}) as Record<string, string[]>)[0] ?? [];
  if (field && message) return `${fieldName(field)}: ${message}`;
  return typeof body?.error === "string" ? body.error : fallback;
}

/** PATCH /api/profile (the profile page and Settings): the saved profile, or why it didn't save. */
export async function saveProfile(patch: Record<string, unknown>, send: typeof fetch = fetch): Promise<{ ok: true; profile: Record<string, unknown> } | { ok: false; error: string }> {
  try {
    const res = await send("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (!res.ok) return { ok: false, error: await apiError(res, "That didn’t save. Try again.") };
    return { ok: true, profile: (await res.json()).profile };
  } catch {
    return { ok: false, error: "Couldn’t reach the server. Check your connection and try again." };
  }
}

type MemberRow = { tier: number; is_active: boolean; is_alumni: boolean; onboarding_completed: boolean; xp: number; tethos_coins: number };
/** Admin analytics from its four reads; any failed read throws (zeros would look like a real, empty club). */
export function summarizeAnalytics(profiles: Result<MemberRow[] | null>, bounties: Result<{ status: string }[] | null>, quests: Result<{ status: string }[] | null>, orders: Result<{ status: string }[] | null>) {
  const members = must(profiles) ?? [];
  const bountyList = must(bounties) ?? [];
  const questList = must(quests) ?? [];
  const orderList = must(orders) ?? [];
  const tierDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let totalXP = 0;
  let totalTC = 0;
  members.forEach((m) => {
    tierDistribution[m.tier] = (tierDistribution[m.tier] || 0) + 1;
    totalXP += m.xp || 0;
    totalTC += m.tethos_coins || 0;
  });
  return {
    totalMembers: members.length,
    activeMembers: members.filter((m) => m.is_active).length,
    alumni: members.filter((m) => m.is_alumni).length,
    pendingOnboarding: members.filter((m) => !m.onboarding_completed).length,
    totalXP,
    tcInCirculation: totalTC,
    totalBounties: bountyList.length,
    completedBounties: bountyList.filter((b) => b.status === "completed").length,
    totalQuests: questList.length,
    completedQuestEntries: questList.filter((q) => q.status === "completed").length,
    totalOrders: orderList.length,
    fulfilledOrders: orderList.filter((o) => o.status === "fulfilled").length,
    tierDistribution,
  };
}
