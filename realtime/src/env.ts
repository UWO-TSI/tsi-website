// The server's environment, validated once at boot (specs/multiplayer.md §1.2–1.4).
// Parsed lazily: @colyseus/tools loads `.env.<NODE_ENV>` when it is imported, so
// reading process.env at module load could miss those values.
import { z } from "zod";

/** §1.4: the production web origins. */
export const DEFAULT_ALLOWED_ORIGINS = [
  "https://play.tethos.ca",
  "https://www.tethos.ca",
  "https://tethos.ca",
  "https://uwotsi.com",
  "https://www.uwotsi.com",
];

/** §1.4: Vercel preview deployments of the uwotsi projects. */
export const DEFAULT_ALLOWED_ORIGIN_PATTERNS = [
  "^https://uwotsi[a-z0-9-]*-davids-projects-e31987e3\\.vercel\\.app$",
];

/** §1.4: local development only (never in production). */
export const DEV_ORIGIN_PATTERNS = [
  "^http://localhost(:[0-9]{1,5})?$",
  "^http://play\\.localhost(:[0-9]{1,5})?$",
  "^http://127\\.0\\.0\\.1(:[0-9]{1,5})?$",
];

/** Origins are comma- or space-separated. */
const originList = z
  .string()
  .transform((s) => s.split(/[\s,]+/).filter(Boolean))
  .pipe(z.array(z.url({ protocol: /^https?$/ })));

/** Patterns are space-separated (a regex may contain a comma) and must be anchored. */
const patternList = z
  .string()
  .transform((s) => s.split(/\s+/).filter(Boolean))
  .pipe(
    z.array(
      z
        .string()
        .refine((p) => p.startsWith("^") && p.endsWith("$"), "origin patterns must be anchored with ^ and $")
        .refine((p) => {
          try {
            new RegExp(p);
            return true;
          } catch {
            return false;
          }
        }, "not a valid regular expression"),
    ),
  );

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(2567),
    /** The Supabase project URL, e.g. https://<ref>.supabase.co. Required in production. */
    SUPABASE_URL: z.url({ protocol: /^https?$/ }).optional(),
    /** A secret (service) key; only used for the service-only RPC realtime_player_card. */
    SUPABASE_SECRET_KEY: z.string().min(20).optional(),
    ALLOWED_ORIGINS: originList.optional(),
    ALLOWED_ORIGIN_PATTERNS: patternList.optional(),
    /** 1 accepts `dev:<name>` tokens. Refused in production. */
    DEV_AUTH: z.enum(["0", "1"]).default("0"),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;
    if (env.DEV_AUTH === "1") {
      ctx.addIssue({ code: "custom", path: ["DEV_AUTH"], message: "DEV_AUTH=1 is refused when NODE_ENV=production" });
    }
    if (!env.SUPABASE_URL) {
      ctx.addIssue({ code: "custom", path: ["SUPABASE_URL"], message: "required in production" });
    }
    if (!env.SUPABASE_SECRET_KEY) {
      ctx.addIssue({ code: "custom", path: ["SUPABASE_SECRET_KEY"], message: "required in production" });
    }
  });

export type Env = {
  nodeEnv: "development" | "test" | "production";
  production: boolean;
  port: number;
  supabaseUrl?: string;
  supabaseSecretKey?: string;
  devAuth: boolean;
  allowedOrigins: string[];
  /** Production patterns plus, outside production, the local dev patterns. */
  allowedOriginPatterns: string[];
};

/** Validates `source` (process.env by default). Throws a readable error naming each bad variable, never its value. */
export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join(".") || "(env)"}: ${i.message}`);
    throw new Error(`Invalid realtime environment:\n${lines.join("\n")}`);
  }
  const e = parsed.data;
  const production = e.NODE_ENV === "production";
  return {
    nodeEnv: e.NODE_ENV,
    production,
    port: e.PORT,
    supabaseUrl: e.SUPABASE_URL?.replace(/\/+$/, ""),
    supabaseSecretKey: e.SUPABASE_SECRET_KEY,
    devAuth: e.DEV_AUTH === "1" && !production,
    allowedOrigins: e.ALLOWED_ORIGINS ?? DEFAULT_ALLOWED_ORIGINS,
    allowedOriginPatterns: [
      ...(e.ALLOWED_ORIGIN_PATTERNS ?? DEFAULT_ALLOWED_ORIGIN_PATTERNS),
      ...(production ? [] : DEV_ORIGIN_PATTERNS),
    ],
  };
}

let cached: Env | undefined;

/** The process environment, parsed on first use. */
export function getEnv(): Env {
  cached ??= parseEnv();
  return cached;
}
