# QA Report

> Owner: QA agent. All agents check this for bugs in their area.
> Last updated: 2026-03-27

---

## 1. Build Report (`npm run build`)

**Result: ✅ BUILD PASSES**

- Next.js 16.1.6 (Turbopack)
- Compiled successfully in 5.4s
- TypeScript check: passed
- Static pages generated: 14/14

**Warnings:**
- `baseline-browser-mapping` data is over two months old (repeated 7x during worker collection)
- Next.js workspace root inference warning — multiple lockfiles detected (root + web/)

**Routes generated:**
| Route | Type |
|-------|------|
| `/` | Static |
| `/_not-found` | Static |
| `/api/an-token` | Dynamic |
| `/company` | Static |
| `/globe-demo` | Static |
| `/globe-test` | Static |
| `/navbar-test` | Static |
| `/npo` | Static |
| `/pylon-demo` | Static |
| `/sponsor` | Static |
| `/student` | Static |
| `/under-construction` | Static |

---

## 2. Lint Report (`npm run lint`)

**Result: ❌ LINT FAILS (exit code 1)**

### Summary

| Severity | Count |
|----------|-------|
| Errors | ~25+ |
| Warnings | ~30+ |

### Errors (must fix)

#### Missing `key` prop — `react/jsx-key`
- `web/app/npo/about/npo_formSubmission.tsx` lines 58, 64, 70, 76

#### Cascading setState in effect — `react-hooks`
- `web/components/cards/CardCarouselLayout.tsx:30` — `setState` called synchronously inside effect body

#### Hook immutability violations — `react-hooks/immutability`
- `web/components/ui/InteractivePylon3D.tsx:85` — modifying `pointer` returned from hook (`pointer.x = ...`)

#### `@typescript-eslint/no-explicit-any`
- `web/components/ui/Lanyard.tsx` lines 110, 111, 112, 113, 114, 130, 131 — 7 `any` types
- `web/components/layout/GlassNavbar.tsx` — multiple `any` types
- Various other components

### Warnings (should fix)

#### Unused variables — `@typescript-eslint/no-unused-vars`
| File | Variable |
|------|----------|
| `app/Companies/CompaniesBuildTimeline.tsx:45` | `i` |
| `app/company/build/CompanyTimeline.tsx:5` | `ScrollTrigger` |
| `app/npo/about/npo_aboutProgram_cont.tsx:68` | `i` |
| `app/npo/about/npo_formSubmission.tsx:40` | `i` |
| `app/npo/impact/Impact.tsx:345` | `columns` |
| `app/npo/sections/NPOHero.tsx:9,11` | `EASE_CINEMATIC`, `DURATION_CINEMATIC` |
| `app/npo/sections/NPOTimeline.tsx:10` | `STAGGER_SLOW` |
| `app/npo/team/team.tsx:57,148` | `currentIndex`, `goToSlide` |
| `app/npo/temporary_cards.tsx:3` | `useState` |
| `app/student/page.tsx:4,11-16` | `useState`, `EASE_CINEMATIC`, `EASE_SMOOTH`, `DURATION_CINEMATIC`, `STAGGER_NORMAL`, `STAGGER_SLOW` |
| `components/ascii/AsciiDitherShader.tsx:11` | `ASCII_CHARS` |
| `components/ascii/AsciiReveal.tsx:6,38` | `DURATION_SECTION`, `revealed` |
| `components/cards/CardCarousel.tsx:6` | `ChevronLeftIcon`, `ChevronRightIcon` |

#### Missing effect dependencies — `react-hooks/exhaustive-deps`
- `web/components/ascii/AsciiReveal.tsx:64` — missing dep `runScramble`

#### Unused eslint-disable directives
- `web/components/ui/Lanyard.tsx:1` — unused `react/no-unknown-property` disable

---

## 3. Auth Flow Testing

### Result: ⚠️ CANNOT TEST — Auth infrastructure does NOT exist

**CRITICAL FINDING:**

The following files referenced in CLAUDE.md and AGENT_LOG.md **DO NOT EXIST** on any branch (checked: `main`, `david`, `davidliu/backend`, `davidliu/qa`):

| Expected File | Status |
|--------------|--------|
| `web/lib/supabase/types.ts` | ❌ Does not exist |
| `web/lib/supabase/middleware.ts` | ❌ Does not exist |
| `web/supabase/migrations/` directory | ❌ Does not exist |
| `web/supabase/migrations/001_initial_schema.sql` | ❌ Does not exist |
| Any signup page (`/student/signup`) | ❌ Does not exist |
| Any login page (`/student/login`) | ❌ Does not exist |
| Any election page (`/student/election`) | ❌ Does not exist |

**No Supabase integration exists anywhere in the codebase.** There is no `@supabase/supabase-js` in `package.json`. The only `lib/` file is `web/lib/motion.ts` (animation utilities).

CLAUDE.md states "Supabase Auth | Working" — this appears to be aspirational, not actual current state.

**Impact on Backend (WAVE 2):** Backend agent should plan to build auth from scratch, not audit existing schema. There are no existing profile fields to audit or migrate — everything is greenfield.

---

## 4. Marketing Pages

### Result: ✅ ALL 5 PAGES EXIST AND BUILD SUCCESSFULLY

| Page | Route | File | Build Status |
|------|-------|------|-------------|
| Home | `/` | `web/app/(site)/page.tsx` | ✅ Static |
| NPO | `/npo` | `web/app/npo/page.tsx` | ✅ Static |
| Company | `/company` | `web/app/company/page.tsx` | ✅ Static |
| Sponsor | `/sponsor` | `web/app/sponsor/page.tsx` | ✅ Static |
| Student | `/student` | `web/app/student/page.tsx` | ✅ Static |

All 5 marketing pages compile and generate as static pages without errors.

Additional pages found: `/globe-demo`, `/globe-test`, `/navbar-test`, `/pylon-demo`, `/under-construction`

---

## 5. CRITICAL — Existing Profiles Table Schema Documentation

### Result: ⚠️ NO PROFILES TABLE EXISTS — GREENFIELD

**There is NO existing profiles table, schema, types, or migrations anywhere in the codebase or on any branch.**

Searched all branches: `main`, `david`, `davidliu/backend`, `davidliu/frontend`, `davidliu/managment`, `davidliu/uxui`, `davidliu/qa`

```
git ls-tree -r --name-only <branch> | grep -i supabase → (empty for ALL branches)
```

**What DOES exist:**
- `web/components/cards/types.ts` — only contains `PathwayCard { title, description, href? }` (not Supabase-related)
- `web/lib/motion.ts` — animation utility (not Supabase-related)

### Implications for Backend Agent

1. **No schema to audit** — start from scratch
2. **No types.ts to update** — create new
3. **No middleware.ts to modify** — create new
4. **No migrations to extend** — `001_initial_schema.sql` needs to be written first
5. **No Supabase SDK installed** — needs `npm install @supabase/supabase-js @supabase/ssr`
6. **No `.env` with Supabase credentials** — needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Recommended profiles table schema (based on CLAUDE.md vision + AGENT_LOG.md task list):

Backend should create from scratch. The ~30 fields mentioned in CLAUDE.md were aspirational. The tier system (1-5), gamification fields (xp, level, coin_balance), avatar config, class/subclass, skills, and social links all need to be created new.

---

## 6. Dependency Issues

- **Peer dependency conflict:** `@ai-sdk/react@3.0.118` requires `react@"^18 || ~19.0.1 || ~19.1.2 || ^19.2.1"` but project uses a newer React 19 version. Required `--legacy-peer-deps` to install.
- **npm vulnerabilities:** 10 total (7 moderate, 3 high) — run `npm audit` for details

---

## 7. Summary for All Agents

| Check | Status | Details |
|-------|--------|---------|
| Build | ✅ Pass | Clean compile, 14 static pages |
| Lint | ❌ Fail | ~25 errors, ~30 warnings |
| Auth flow | ⚠️ N/A | No auth infrastructure exists |
| Marketing pages | ✅ Pass | All 5 pages build as static |
| Profiles schema | ⚠️ N/A | No Supabase/DB code exists — greenfield |
| Dependencies | ⚠️ Warn | Peer dep conflict, 10 vulnerabilities |
