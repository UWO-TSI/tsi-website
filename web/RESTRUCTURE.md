# Tethos Website Restructure Plan

## Audiences
1. **NPOs** -- looking for credibility and past work
2. **Companies** -- want to hire students or commission projects
3. **Sponsors** -- fund the club and events
4. **Students** -- applying, logging in, or starting a chapter

## Core Principle
Homepage does the heavy lifting (credibility, portfolio, impact). Subpages only exist to answer audience-specific questions.

---

## Navigation

### Desktop
- **Layout:** Logo floats left, glass pill on right
- **Links:** `Nonprofits | Companies | Sponsors | Students | [Contact]`
- **Behavior:** Direct links only, no dropdown/mega-menu
- **Active state:** Highlight (underline/color) on current page
- **Scroll:** Hide on scroll down, reveal on scroll up
- **Style:** Glass/translucent floating pill (current)
- **Login:** Only accessible from /student page, not in nav

### Mobile
- Hamburger menu, stacked links

### Footer
- Sitemap-style columns with all pages organized

### Scroll Navigation
- Default scrollbar hidden
- Vertical dot nav on right side, labels appear on hover only
- Dots fade in after scrolling past hero

---

## Homepage (tethos.ca)

### Section Order
1. **Hero + Globe** -- add visible drag/hover hints for interactivity
2. **What we do** -- static mission text + supporting image (replaces text reveal animation)
3. **Case study spotlight** -- 1-2 real projects with screenshots + outcomes
4. **Impact stats** -- animated counters
5. **Team / alumni credibility** -- where alumni have gone (Google, Stripe, etc.)
6. **Sponsor strip** -- partner logos
7. **Pathway cards** -- "Who are you?" self-select, links to subpages (LAST, not first)

### Key Changes from Current
- Text reveal scroll animation replaced with static content
- Case studies added (new section)
- Team/alumni section added (new section)
- Pathway cards moved from middle to end
- Credibility and impact interleaved throughout

---

## Subpages (lightweight, program-brief style)

### /npo
- How the 8-month cohort works (timeline)
- What you receive (deliverables)
- NPO-specific FAQ (ownership, time commitment, eligibility)
- Apply CTA

### /company
- Defined packages (for scoped projects)
- Custom engagement (contact to scope)
- Company-specific FAQ (stacks, timelines, IP)
- Contact CTA

### /sponsor
- Genesis tier breakdown
- What your money enables
- Current sponsors
- Download package + Contact CTA

### /student
- What Tethos is (assumes no prior knowledge)
- Join our team vs. Start a chapter (two clear paths)
- Open roles / what you'll build
- Student-specific FAQ (experience needed, hours, remote?)
- Apply + Sign in

### What Subpages Do NOT Have
- No duplicated impact stats
- No team sections
- No portfolio/case studies (link back to homepage)
- No hero animations
- No marketing fluff -- just program details and a CTA

---

## Status

- [x] Hide default scrollbar
- [x] DotNav component (hover-only labels)
- [x] Section IDs on homepage components
- [ ] Restructure homepage section order
- [ ] Replace text reveal with static mission section
- [ ] Add case study section
- [ ] Add team/alumni section
- [ ] Move pathway cards to end (already last, confirm)
- [ ] Simplify GlassNavbar (direct links, no dropdown, split layout)
- [ ] Restructure /npo as lightweight program brief
- [ ] Restructure /company as lightweight program brief
- [ ] Restructure /sponsor as lightweight program brief
- [ ] Restructure /student with split paths
- [ ] Rebuild footer as sitemap style
