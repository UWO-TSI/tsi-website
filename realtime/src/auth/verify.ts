// Who is joining (specs/multiplayer.md §2.1 step 3). A Supabase access token is
// verified locally against the project's JWKS (ES256), so no JWT secret lives on
// Fly; jose refetches the set when a token names an unknown kid, which covers key
// rotation. `dev:<name>` tokens are a local-only bypass for two-tab testing and bots.
import { createHash } from "node:crypto";
import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from "jose";

export type Identity = {
  /** The verified `sub` (a Supabase user id), or a synthetic UUID for a dev token. */
  uid: string;
  dev: boolean;
  /** The name after `dev:`, for the synthetic card. */
  devName?: string;
};

export type AuthFailure =
  | "missing_token"
  | "invalid_token"
  | "expired"
  | "wrong_issuer"
  | "wrong_audience"
  | "not_authenticated"
  | "anonymous"
  | "dev_refused"
  | "unconfigured"
  | "jwks_unavailable";

export class AuthError extends Error {
  constructor(readonly reason: AuthFailure, detail?: string) {
    super(detail ? `${reason}: ${detail}` : reason);
    this.name = "AuthError";
  }
}

export type Verify = (token: string | null | undefined) => Promise<Identity>;

export type VerifierOptions = {
  /** https://<ref>.supabase.co; without it only dev tokens can pass. */
  supabaseUrl?: string;
  /** Key resolver; defaults to the project's remote JWKS. Tests pass a local set. */
  jwks?: JWTVerifyGetKey;
  devAuth: boolean;
  production: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEV_NAME = /^[A-Za-z0-9_-]{1,24}$/;
/** Supabase access tokens are well under this; anything longer is not one. */
const MAX_TOKEN_LENGTH = 8192;

/** The same name always maps to the same id, so a dev player keeps their identity across restarts. */
export function devUid(name: string): string {
  const h = createHash("sha256").update(`dev:${name.toLowerCase()}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export function createVerifier(opts: VerifierOptions): Verify {
  const issuer = opts.supabaseUrl ? `${opts.supabaseUrl}/auth/v1` : undefined;
  const jwks =
    opts.jwks ??
    (issuer ? createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`), { timeoutDuration: 3000 }) : undefined);

  return async function verify(token) {
    if (typeof token !== "string" || token.length === 0) throw new AuthError("missing_token");
    if (token.length > MAX_TOKEN_LENGTH) throw new AuthError("invalid_token", "too long");

    if (token.startsWith("dev:")) {
      // Refused in production even if DEV_AUTH somehow got set (env.ts also refuses that at boot).
      if (!opts.devAuth || opts.production) throw new AuthError("dev_refused");
      const name = token.slice(4);
      if (!DEV_NAME.test(name)) throw new AuthError("invalid_token", "bad dev name");
      return { uid: devUid(name), dev: true, devName: name };
    }

    if (!issuer || !jwks) throw new AuthError("unconfigured", "SUPABASE_URL is not set");

    let payload;
    try {
      ({ payload } = await jwtVerify(token, jwks, {
        issuer,
        audience: "authenticated",
        algorithms: ["ES256"],
        requiredClaims: ["sub", "exp"],
        clockTolerance: 5,
      }));
    } catch (e) {
      throw toAuthError(e);
    }

    if (payload.role !== "authenticated") throw new AuthError("not_authenticated");
    if (payload.is_anonymous === true) throw new AuthError("anonymous");
    if (typeof payload.sub !== "string" || !UUID.test(payload.sub)) throw new AuthError("invalid_token", "bad sub");
    return { uid: payload.sub.toLowerCase(), dev: false };
  };
}

function toAuthError(e: unknown): AuthError {
  if (e instanceof errors.JWTExpired) return new AuthError("expired");
  if (e instanceof errors.JWTClaimValidationFailed) {
    if (e.claim === "iss") return new AuthError("wrong_issuer");
    if (e.claim === "aud") return new AuthError("wrong_audience");
    return new AuthError("invalid_token", `claim ${e.claim}`);
  }
  if (e instanceof errors.JWKSTimeout) return new AuthError("jwks_unavailable", "timeout");
  if (e instanceof errors.JOSEError) return new AuthError("invalid_token", e.code);
  // Network failures fetching the JWKS surface as plain errors.
  return new AuthError("jwks_unavailable", e instanceof Error ? e.name : "unknown");
}
