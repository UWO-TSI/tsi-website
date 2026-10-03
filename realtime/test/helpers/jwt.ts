// A local stand-in for the Supabase JWKS: one ES256 key, tokens shaped like Supabase's.
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload, type JWTVerifyGetKey } from "jose";

export const TEST_SUPABASE_URL = "https://test-project.supabase.co";
export const TEST_ISSUER = `${TEST_SUPABASE_URL}/auth/v1`;

export type TestKeys = {
  jwks: JWTVerifyGetKey;
  /** Signs a Supabase-shaped access token; `claims` override the defaults, `undefined` removes one. */
  sign(claims?: Record<string, unknown>, opts?: { key?: "real" | "other"; expiresIn?: string | number; alg?: string }): Promise<string>;
};

export async function createTestKeys(): Promise<TestKeys> {
  const real = await generateKeyPair("ES256", { extractable: true });
  const other = await generateKeyPair("ES256", { extractable: true });
  const jwk = { ...(await exportJWK(real.publicKey)), kid: "test-kid", alg: "ES256", use: "sig" };
  const jwks = createLocalJWKSet({ keys: [jwk] });

  return {
    jwks,
    async sign(claims = {}, opts = {}) {
      const payload: JWTPayload = {
        sub: "11111111-2222-4333-8444-555555555555",
        role: "authenticated",
        aud: "authenticated",
        iss: TEST_ISSUER,
        is_anonymous: false,
        email: "someone@example.com",
        ...claims,
      };
      for (const k of Object.keys(payload)) if (payload[k] === undefined) delete payload[k];
      const key = opts.key === "other" ? other.privateKey : real.privateKey;
      return new SignJWT(payload)
        .setProtectedHeader({ alg: opts.alg ?? "ES256", kid: "test-kid", typ: "JWT" })
        .setIssuedAt()
        .setExpirationTime(opts.expiresIn ?? "1h")
        .sign(key);
    },
  };
}
