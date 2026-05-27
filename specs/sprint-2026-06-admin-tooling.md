# Sprint: Admin Tooling — Content CRUD for Monthly Drops

> **Goal:** Build the admin UI that lets T1/T2 edit content rows (NPCs, shop items, palettes, events) without writing SQL or pushing code.
> **Why:** Per CLAUDE.md design principle #8 — the world has a monthly content cadence; admins must be able to drop new content easily.
> **Sprint window:** 2026-05-28 → ~2026-06-22 (~4 weeks)
> **Owner:** `build` agent. Reviewer: David.
> **Foundation already shipped:** content_pipeline migration (014), content_versions (015), SWR loader hooks, preview URL system (B3), stub listing pages (B4), draft/publish/discard API routes.

---

## Why this sprint

The prior sprint laid the data plumbing. This sprint puts the UI on top. Without it, every monthly drop requires either:
- a developer writing INSERT statements in psql, OR
- direct edits in the Supabase dashboard

Both are friction that will kill the monthly cadence. This sprint removes that friction.

---

## Definition of Done

A T1/T2 admin can, end-to-end with zero code:
1. **Create a new NPC persona** — fill a form, save as draft, preview via `?preview=draft-{id}`, publish to make it live
2. **Create a new shop item** — same flow with image-URL field (sprite_url) + price + stock + rarity
3. **Create a seasonal palette** — pick 7 colors via color pickers, see them swatched, schedule activation dates, publish
4. **Schedule an event with QR check-in** — title, time, location, XP/TC rewards on check-in, generate a printable QR code
5. **Edit any existing row** — load the row's current data into the form, modify, save as draft, preview, publish
6. **Discard a draft** without it ever going live
7. **See content history** — for any live row, view the last 5 published versions and roll back to one
8. **Toggle active palette** — single-click switch between palettes (one active at a time, partial unique index enforces)

`npm run build` passes. `npm run lint` errors ≤ 74. Visual QA verifies each CRUD flow.

---

## Deliverables

### A. NPC editor (`/student/dashboard/admin/content/npcs/[id]/edit`)

- Form fields: `slug` (kebab-case validator), `display_name`, `spawn_zone` (dropdown), `is_permanent` (toggle), `persona_prompt` (textarea, ~6 lines), `canned_dialogue` (line-by-line list with add/remove), `sprite_url` (URL input, accepts blank), `active` (toggle)
- "New NPC" mode at `/admin/content/npcs/new`
- Save as draft → POST `/api/content/drafts` with `table_name='npc_personas'`
- Preview link → opens `/student/dashboard?preview=draft-{userId}` in new tab
- Publish button → POST `/api/content/drafts/[id]/publish` (T1/T2 only)
- Discard button → POST `/api/content/drafts/[id]/discard`
- Validation: slug must be unique (check via supabase query before save), persona_prompt under 2000 chars

### B. Shop item editor (`/admin/content/shop/[id]/edit`)

- Form: `slug`, `display_name`, `category` (dropdown from enum), `sprite_url`, `description` (textarea), `tc_price` (number), `rarity` (dropdown), `stock` (number nullable, "unlimited" toggle), `active`, `released_at` (datetime), `retired_at` (datetime nullable)
- Sprite preview: if sprite_url is set, show the image inline
- Same draft/preview/publish flow

### C. Palette editor (`/admin/content/palettes/[id]/edit`)

- Form: `slug`, `display_name`, 7 color pickers (sky / grass / accent / fog / water / building_primary / building_accent), `scheduled_start`, `scheduled_end`
- Live preview pane on the right: small game-world thumbnail with colors applied (use existing palette swatches at minimum; ideally an iframe to `/student/dashboard?preview=draft-{userId}`)
- "Set as active" button — atomic operation: set this palette's `active=true`, all others `active=false`
- Partial unique index will block accidental double-active state

### D. Event editor (`/admin/content/events/[id]/edit`)

Events table may already exist with its own schema. This editor extends it for the content-drop workflow:
- Form: `title`, `description`, `event_type`, `start_time`, `end_time`, `location`, `capacity`, `xp_reward`, `tc_reward`, `is_irl` (toggle — only IRL events earn XP per principle #3), `qr_check_in_code` (auto-generated UUID, display as QR with `qrcode` npm package — small ~10KB)
- "Generate printable QR" button — opens a print-friendly page with the QR code + event details for posting at the venue
- Calendar view at `/admin/content/events` listing upcoming events (extend the existing stub from B4)

### E. Version history + rollback

`/admin/content/{table}/[id]/history` — for any row:
- List the last 10 versions from `content_versions` table
- Show diff between current live and any historical version (simple side-by-side JSON or per-field comparison)
- "Restore to this version" button — creates a new draft with the historical snapshot_data, can then preview + publish

### F. Activity log

`/admin/content/log` — listing of recent admin actions:
- Who published what, when
- Joins `content_versions` × `profiles` for the author display
- Filter by table_name, author, date range

### G. (Optional, time-permitting) Image upload

Sprite/image URLs currently require an external host. If time allows, add a `web/app/api/content/upload/route.ts` that accepts a multipart upload, stores in Supabase Storage bucket `content-assets`, returns the public URL. Wire into the form's sprite_url field as an "Upload" button alternative.

---

## Out of scope

- NPC sprite generation (defer to dedicated sprite sprint — Nano Banana pipeline)
- LLM-NPC dialogue wiring (separate sprint, spec at `specs/llm-npc-system.md`)
- Building interior editor (Phase 3+)
- Avatar Creator (Phase 3+)
- Mobile admin layout (admin is desktop-only is fine — admins do this on a laptop)
- Bulk import / CSV upload
- Multi-environment promotion (staging→prod) — single environment for now

---

## Tech notes

### UI framework

Use existing shadcn/ui or whatever the admin pages already use (look at `web/app/admin/recruit/page.tsx` for the recruitment system's admin pattern — match that). Form library: `react-hook-form` if already installed; else native React state. Don't introduce a new lib if one's already in use.

### Color picker

For palette editor, use HTML5 `<input type="color">` for speed. Don't introduce `react-color` unless team prefers it.

### QR code

Use `qrcode` npm package (~10KB, MIT). Renders QR to canvas/SVG.

### Form validation

Keep light. Required-field check, slug regex `^[a-z0-9-]+$`, price/stock numeric, color hex `#[0-9A-Fa-f]{6}`. Don't build a validation framework — these are admin tools, mostly self-policed.

### Permissions

All admin pages: T1/T2 gate at the component level using `useUser()`. API routes already gate at the route handler. Defense in depth.

---

## Sprint structure (5 deliverables)

| # | Deliverable | Est. effort |
|---|-------------|------------|
| C1 | NPC editor (CRUD form + draft/preview/publish) | Medium |
| C2 | Shop item editor (same) | Medium (reuse C1 pattern) |
| C3 | Palette editor (color pickers + live preview) | Medium |
| C4 | Event editor + QR code + printable view | Medium-Large (QR + print is new) |
| C5 | Version history + rollback + activity log | Medium |
| C6 | (Optional) Image upload to Supabase Storage | Small |

Build in order. C1 establishes the form pattern; C2-C5 reuse it. C6 adds storage capability if time permits.

---

## Risks / open questions

- **Events table schema may diverge from content-pipeline pattern** — verify before C4 starts. If events doesn't have `is_irl` / `xp_reward` / `tc_reward` / `qr_check_in_code` columns, may need a migration `016_events_extension.sql`.
- **Active palette toggle is atomic-ish** — partial unique index protects against double-active, but the "set this active, set others inactive" UPDATE needs to be a transaction or RPC to avoid a brief no-active state. Document the approach.
- **Image upload requires Supabase Storage bucket** — `content-assets` bucket may need to be created via SQL or Supabase dashboard. Document the setup step.

---

## Definition of Ready (before sprint kicks off)

- [ ] Reviewer reviews this spec, confirms scope
- [ ] David picks any deviations from defaults (e.g., color picker library, image upload yes/no)
- [ ] QA Wave 14 (end-of-prior-sprint verification) is PASS — no carryover blockers
