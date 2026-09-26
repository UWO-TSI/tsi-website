/**
 * The signed-in person's own look (row 142): cached on this device and saved
 * to `profiles.avatar_config.look` through PATCH /api/profile, so a hired
 * applicant's character carries into the member game. Signed out it lives on
 * this device only. `saved: false` after loading means "never made one":
 * the world shows the creator.
 */
import { useSyncExternalStore } from "react";
import { DEFAULT_LOOK, parseLook, type CharacterLook } from "./look";

const KEY = "tsi.look.v1";
export interface MyLook { look: CharacterLook; saved: boolean; loaded: boolean; signedIn: boolean }
const SERVER: MyLook = { look: DEFAULT_LOOK, saved: false, loaded: false, signedIn: false };
let state: MyLook = SERVER;
let avatarConfig: Record<string, unknown> = {};
let started = false;
const listeners = new Set<() => void>();
const publish = (next: Partial<MyLook>) => { state = { ...state, ...next }; listeners.forEach(l => l()); };

function writeLocal(look: CharacterLook) { try { localStorage.setItem(KEY, JSON.stringify(look)); } catch { /* session only */ } }
async function pushRemote(look: CharacterLook): Promise<string | null> {
  try {
    const res = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ avatar_config: { ...avatarConfig, look } }) });
    if (!res.ok) return "Saved on this device; your account didn't take it.";
    avatarConfig = { ...avatarConfig, look };
    return null;
  } catch { return "Saved on this device; your account didn't take it."; }
}

function start() {
  if (started) return;
  started = true;
  try { const raw = localStorage.getItem(KEY); if (raw) state = { ...state, look: parseLook(JSON.parse(raw)), saved: true }; } catch { /* no local look */ }
  void fetch("/api/profile").then(r => (r.ok ? r.json() : null)).then((body: { profile?: { avatar_config?: Record<string, unknown> } } | null) => {
    const profile = body?.profile;
    if (!profile) return publish({ loaded: true });
    avatarConfig = profile.avatar_config && typeof profile.avatar_config === "object" ? profile.avatar_config : {};
    if (avatarConfig.look) {
      const look = parseLook(avatarConfig.look);
      writeLocal(look);
      return publish({ look, saved: true, loaded: true, signedIn: true });
    }
    publish({ loaded: true, signedIn: true });
    if (state.saved) void pushRemote(state.look); // made on this device before signing in (or as an applicant preview)
  }).catch(() => publish({ loaded: true }));
}

export function useMyLook(): MyLook {
  return useSyncExternalStore(l => { listeners.add(l); start(); return () => { listeners.delete(l); }; }, () => state, () => SERVER);
}

/** Save locally at once, then to the account when signed in. Resolves to an error line or null. */
export async function saveMyLook(look: CharacterLook): Promise<string | null> {
  writeLocal(look);
  publish({ look, saved: true });
  return state.signedIn ? pushRemote(look) : null;
}
