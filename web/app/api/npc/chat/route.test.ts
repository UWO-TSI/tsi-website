import { afterEach, describe, expect, it, vi } from "vitest";

const getUser = vi.hoisted(() => vi.fn(async () => ({ data: { user: null } })));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

import { POST } from "./route";

const post = () => POST(new Request("http://localhost/api/npc/chat", { method: "POST", body: JSON.stringify({ npc_id: "00000000-0000-4000-8000-0000000000b7", message: "hi" }) }));

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/npc/chat", () => {
  it("is closed in v1 (no client calls it; it spends Anthropic calls): 404 before anything else", async () => {
    vi.stubEnv("NPC_CHAT_ENABLED", "");
    expect((await post()).status).toBe(404);
    expect(getUser).not.toHaveBeenCalled();
  });
  it("opens with NPC_CHAT_ENABLED=true (then a signed-out caller gets 401)", async () => {
    vi.stubEnv("NPC_CHAT_ENABLED", "true");
    expect((await post()).status).toBe(401);
  });
});
