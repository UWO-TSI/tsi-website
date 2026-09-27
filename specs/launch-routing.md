# Launch routing: the new island becomes the member game

Today the new island (`DefaultIslandWorld`) is reachable only at dev-only `/lab/island` (404 in production builds). `/student/dashboard` renders the legacy `GameWorld` (or `MobileWorld` on phones) behind `memberWorldIsAvailable()` from `web/lib/recruitment-access`, which keeps the member world development-only while recruitment runs. Load `ponytail`: promote, gate, delete; do not keep two worlds.

1. **Member route:** `/student/dashboard` (and the existing portal entry points, the "Game portal" menu link, `/student/go` routing for admins) render `DefaultIslandWorld` on desktop; phones go to `/student/companion`. Query overrides used by the labs (`?time=`, `?season=`, demo modes) stay dev-only.
2. **One launch switch:** replace the development-only restriction with a single flag (env var such as `NEXT_PUBLIC_MEMBER_WORLD=open`, default closed) so launch is one Vercel env change; closed shows a friendly "opening soon" page to members and keeps the applicant flow untouched. Public accounts (tier 5) reach the island too when open (rows 74–75); club tools inside stay permissioned.
3. **Retire the legacy world:** delete `GameWorld` and everything only it uses (after proving with an import graph that `DefaultIslandWorld`, the applicant island and the labs do not depend on those files), plus stale routes/pages that only served it. Keep anything shared. Record deletions in the commit message.
4. **Labs:** `/lab/*` and `/dev/*` stay dev-only; confirm they 404 in a production build (`next build` + `next start`, one server under the lock).
5. **Evidence:** production-build screenshots of `/student/dashboard` closed and open (flag on), the phone redirect, `/lab/island` 404 in production, and the applicant island unchanged.
Gates: tsc, full vitest (routing/gate tests), focused eslint, `next build` succeeds.
