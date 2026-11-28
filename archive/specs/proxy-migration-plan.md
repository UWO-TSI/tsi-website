# Next.js Proxy Migration Plan

> **Status:** Research complete. Do NOT migrate yet — waiting for team alignment.
> **Owner:** Backend agent
> **Date:** 2026-04-05

---

## Background

Next.js 16 deprecated the `middleware.ts` file convention in favor of `proxy.ts`. The build warns:

```
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
```

## What's Changing

The change is purely a **rename** — no API changes, no new features, no behavior differences.

| Before | After |
|--------|-------|
| `web/middleware.ts` | `web/proxy.ts` |
| `export async function middleware(request)` | `export async function proxy(request)` |
| `export const config = { matcher: [...] }` | Same — `export const config = { matcher: [...] }` |

The `NextRequest`, `NextResponse`, and all other APIs remain identical. The `config.matcher` syntax is unchanged.

## Why Next.js Did This

- "Middleware" was confused with Express.js middleware, encouraging misuse
- "Proxy" better describes what it does: sits at the network boundary in front of the app
- Next.js wants to move logic OUT of middleware into proper APIs over time
- They recommend using proxy "as a last resort"

## Our Files Affected

### 1. `web/middleware.ts` → `web/proxy.ts`

```diff
- export async function middleware(request: NextRequest) {
+ export async function proxy(request: NextRequest) {
    return await updateSession(request);
  }
```

### 2. `web/lib/supabase/middleware.ts` — no rename needed

This is our helper file, not the Next.js file convention. The function `updateSession()` can keep its name. However, we may want to rename the file to `web/lib/supabase/session.ts` for clarity (optional).

## Migration Steps

1. Run the official codemod:
   ```bash
   npx @next/codemod@canary middleware-to-proxy .
   ```
   This renames `middleware.ts` → `proxy.ts` and `middleware()` → `proxy()`.

2. Verify build passes (`npm run build`)

3. Test all auth redirects:
   - Unauthenticated → `/student/login`
   - No onboarding → `/student/onboarding`
   - Logged in at login → `/student/dashboard`
   - Election routes gated
   - Admin routes tier-checked

## Risk Assessment

**Very low risk.** This is a file + function rename with zero behavioral changes. The codemod handles it automatically.

## Recommendation

- **Do it in a dedicated commit** — not bundled with other work
- **After QA's next merge round** — so we don't conflict with other branches
- **Before production deploy** — the deprecation warning is harmless but noisy
- **Optional:** Rename `web/lib/supabase/middleware.ts` → `session.ts` for clarity, updating the import in `proxy.ts`

## References

- [Next.js migration guide](https://nextjs.org/docs/messages/middleware-to-proxy)
- Proxy docs page not yet published as of 2026-04-05
