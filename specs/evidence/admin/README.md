# Admin pass evidence (A-)

Signed in as the T2 staging user (`phase1-staff`) on `tethos-staging` with `20260927090000_admin_pass` applied, dev server on :4900. Screens were driven by Playwright and read back through the API.

| File | Shows |
|---|---|
| A-01 / A-08b | Admin index: every game content area with last publish (who, when), staff tools, open reports |
| A-02a / A-02b | Members: the public probe (T5, Public) → Mark member → Member at T4 (then reverted through the route) |
| A-03a / A-03b | Merch: the member's sticker-pack reservation, Fulfil → "Handed over" |
| A-04a / A-04b | Moderation queue: name report, two notes, one chat message; Remove + mute 7d on the chat message |
| A-05a–c | Residents: roster, the shopkeeper's post/tone/bio/schedule in the editor, published |
| A-06a–c | Recipes: list, rod-glass edit, version history snapshot after publish |
| A-07a / A-07b | Seasonal events: new yearly event through the goal editor (type fixed), list with its next opening |
| A-08a | Activity log with the three publishes |

Readbacks: a member's `POST /api/content/drafts` → 403; a member's `POST /api/admin/members/:id/membership` → 403; the staff mark → 200 `{membership: member, tier: 4}` and back → `{public, 5}`.

SQL: `sql-smoke.sh` (combat B's chain plus this migration). `sql-smoke-before.txt` stops at `admin_pass_smoke.sql` without the migration; `sql-smoke-after.txt` passes all three sections and every earlier smoke.
