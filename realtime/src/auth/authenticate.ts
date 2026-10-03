// The join gate (specs/multiplayer.md §2.1, §2.3 M1): origin, token, card, removal.
// Pure of Colyseus so it can be tested on its own. Two phases, both run in the
// room's static onAuth (the matchmake POST, before any seat is reserved):
// - checkToken: the page and the token. Refused here as HTTP 403/401.
// - admit: the card and removal. Refusals here travel as 41xx closes from onJoin,
//   since an HTTP status can't carry them (the room keeps them on the auth data).
import { CardError, type LoadCard, type PlayerCard } from "./card";
import type { OriginPolicy } from "./origin";
import { AuthError, type Identity, type Verify } from "./verify";

export type AuthServices = {
  verify: Verify;
  loadCard: LoadCard;
  origins: OriginPolicy;
  now?: () => number;
};

export type Refusal =
  /** Token missing, invalid, expired, anonymous, a dev token where none are allowed, or no profile. */
  | "auth"
  /** A browser page that isn't on the allowed list. */
  | "origin"
  /** removed_until is in the future (T1/T2 removal). */
  | "removed"
  /** The card could not be read in time (Supabase slow or down): the client retries. */
  | "card";

export class JoinRefused extends Error {
  constructor(readonly refusal: Refusal, readonly detail: string) {
    super(`${refusal}: ${detail}`);
    this.name = "JoinRefused";
  }
}

export type Authenticated = { identity: Identity; card: PlayerCard };

/** The page and the token. Throws JoinRefused "origin" or "auth". */
export async function checkToken(services: AuthServices, token: string | null | undefined, origin: string | null | undefined): Promise<Identity> {
  if (!services.origins.allows(origin)) throw new JoinRefused("origin", "origin not allowed");
  try {
    return await services.verify(token);
  } catch (e) {
    if (e instanceof AuthError) throw new JoinRefused("auth", e.reason);
    throw e;
  }
}

/** The card, and whether its owner may come in. Throws JoinRefused "auth" (no profile), "card" or "removed". */
export async function admit(services: AuthServices, identity: Identity): Promise<PlayerCard> {
  let card: PlayerCard;
  try {
    card = await services.loadCard(identity);
  } catch (e) {
    if (e instanceof CardError) {
      // A valid token without a profile row is not a member of anything: treat as auth.
      throw new JoinRefused(e.reason === "no_profile" ? "auth" : "card", e.reason);
    }
    throw e;
  }
  if (isRemoved(card, (services.now ?? Date.now)())) throw new JoinRefused("removed", "removed_until");
  return card;
}

/** Both phases in order. */
export async function authenticate(
  services: AuthServices,
  token: string | null | undefined,
  origin: string | null | undefined,
): Promise<Authenticated> {
  const identity = await checkToken(services, token, origin);
  return { identity, card: await admit(services, identity) };
}

export function isRemoved(card: PlayerCard, now: number): boolean {
  return card.removed_until !== null && Date.parse(card.removed_until) > now;
}
