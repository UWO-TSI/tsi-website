# AGENT_LOG.md — Team Communication Board

> Every agent reads this at session start. Append to your section only.

---

## Active Tasks

> Management updates this section. Agents check off items when done.

### UXUI
- [ ] Audit all 5 audience pages (home, npo, company, sponsor, student) — document which sections have placeholder content vs real content in `specs/ux.md`
- [ ] Cross-reference `web/DESIGN_SYSTEM.md` with actual `web/styles/tokens.css` — flag any mismatches in `specs/tokens.md`
- [ ] Write specs for 3 missing pages: `/contact`, `/about`, `/projects` (referenced in Footer but don't exist)
- [ ] Review sponsor page placeholder logos ("Partner Alpha", "Partner Beta") — spec what the real logo grid should look like
- [ ] Review gallery section on sponsor page — spec what real event photos layout should be

### Frontend
- [ ] Run `cd web && npm run build` — fix ALL build errors
- [ ] Run `cd web && npm run lint` — fix ALL lint errors
- [ ] Fix broken footer links: `/contact`, `/about`, `/projects` routes don't exist — create stub pages or update footer
- [ ] Replace placeholder sponsor logos with proper image components (awaiting UXUI spec)
- [ ] Replace placeholder gallery images on sponsor page (gray divs → real image components)
- [ ] Audit all GSAP ScrollTrigger animations — ensure cleanup on unmount (memory leak risk)
- [ ] Verify responsive behavior on all pages (mobile breakpoints)

### Backend
- [ ] Document the single existing API route (`/api/an-token`) in `specs/api.md` — what it does, env vars needed, request/response shape
- [ ] Spec out needed API routes for: contact form submission, newsletter signup, sponsor inquiry form
- [ ] Audit `@an-sdk` integration — document what AI agent features are planned vs implemented
- [ ] Investigate if any data currently hardcoded in components should move to API/CMS (globe-nodes.json, testimonials, FAQ data, impact stats)

### QA
- [ ] Run full `npm run build` + `npm run lint` and log ALL errors/warnings to `specs/qa.md`
- [ ] Test all 5 audience pages load correctly at their routes
- [ ] Test all navigation links (GlassNavbar dropdowns, Footer links) — log any 404s
- [ ] Test loading screen animation (ASCII dissolve) — verify it completes and doesn't block interaction
- [ ] Test custom cursor behavior across all pages — verify it doesn't break on mobile
- [ ] Test 3D globe on homepage — verify performance, check for WebGL errors
- [ ] Verify all ScrollTrigger animations fire correctly on scroll

---

## Blocked / Needs Attention

> If you're blocked, add an entry here. Management will triage.

| Agent | Blocked On | Waiting For | Date |
|-------|-----------|-------------|------|
| Frontend | Can't replace sponsor logos without specs | UXUI logo grid spec | 2026-03-27 |
| Frontend | Can't create /contact, /about, /projects without specs | UXUI page specs | 2026-03-27 |

---

## Management

### 2026-03-27 — Sprint Kickoff

**Created shared communication system:**
- `CLAUDE.md` — project bible (read-only for all agents)
- `AGENT_LOG.md` — this file, our shared board
- `specs/` directory — for all spec documents

### 2026-03-27 — Full Project Audit Complete

**Project: Tethos (TSI) — "Technology That Moves People Forward"**
Next.js 16 marketing site, multi-audience (NPOs, Companies, Sponsors, Students).
Deployed on Vercel. ~75% production ready.

**What's built and working:**
- Homepage with 3D globe hero, text reveal, impact stats, pathway cards
- Student page (hero, benefits, timeline, CTA — all GSAP animated)
- Sponsor page (white investor-grade design, stats, packages, gallery, testimonials)
- NPO page (hero, about, timeline, deliverables, documentary embed, testimonials)
- Company page (hero, build process, programs, alumni, work, FAQ, CTA)
- Full nav system: GlassNavbar + audience-specific navbars
- Loading screen with ASCII dissolve animation
- Custom cursor, smooth scroll (Lenis), motion presets (GSAP + Framer Motion)
- Design system fully documented in `web/DESIGN_SYSTEM.md` (43KB)
- Design tokens in `web/styles/tokens.css`

**What's broken or missing:**
1. Footer links to `/contact`, `/about`, `/projects` — **routes don't exist** (404s)
2. Sponsor page logos are placeholder text ("Partner Alpha", "Partner Beta")
3. Sponsor page gallery shows gray placeholder divs, not real images
4. NPO/Company pages have some placeholder data (project descriptions, alumni names)
5. Only 1 API route exists (`/api/an-token` for Anthropic SDK tokens)
6. No forms anywhere (contact, application, sponsor inquiry)
7. No database, no CMS, no email service, no analytics
8. No authentication

**Sprint priorities (ordered):**
1. **QA first** — get a clean build/lint report so we know the baseline
2. **UXUI** — audit design consistency + spec the 3 missing pages
3. **Frontend** — fix build errors + broken links
4. **Backend** — document API and spec needed endpoints

**Dependency chain:**
```
QA (build report) → Frontend (fix errors)
UXUI (page specs) → Frontend (implement pages)
UXUI (logo/gallery spec) → Frontend (replace placeholders)
Backend (API specs) → Frontend (wire up forms)
```

---

### What I need from each agent:

**@UXUI:**
Read `web/DESIGN_SYSTEM.md` — it's comprehensive (43KB). Your job is to verify the live site matches it, then write specs for the 3 missing pages. Start with `specs/ux.md`. The sponsor page needs the most design attention (placeholder logos + gallery). Don't write code — write specs that Frontend can implement.

**@Frontend:**
Start by running `npm run build` and `npm run lint` in `/web`. Fix what you can. The biggest issue is the 3 missing routes linked in the Footer. Wait for UXUI specs before building those pages — in the meantime, create simple stub/placeholder pages so we don't 404. Also audit GSAP ScrollTrigger cleanup in all components — memory leaks are a real risk.

**@Backend:**
The API surface is nearly empty — just `/api/an-token`. Document it in `specs/api.md`, then spec out what we need: contact form endpoint, sponsor inquiry endpoint, possibly a newsletter signup. Also investigate whether the hardcoded data (globe nodes, testimonials, FAQs, impact stats) should be moved to a data layer/CMS. Don't build yet — spec first.

**@QA:**
You're first up. Run `cd web && npm run build` and `cd web && npm run lint`. Log every error and warning to `specs/qa.md`. Then manually check all routes: `/`, `/npo`, `/company`, `/sponsor`, `/student`. Click every nav link, scroll through every section, note any 404s, broken animations, or visual bugs. Your report unblocks everyone else.

---

## UXUI

> UXUI agent writes here. Others: read only.

*(awaiting first entry)*

---

## Frontend

> Frontend agent writes here. Others: read only.

*(awaiting first entry)*

---

## Backend

> Backend agent writes here. Others: read only.

*(awaiting first entry)*

---

## QA

> QA agent writes here. Others: read only.

*(awaiting first entry)*

---

## Cross-Team Notes

> Any agent can append here for messages that don't fit a single section.

*(none yet)*
