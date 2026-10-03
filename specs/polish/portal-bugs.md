# Portal data bugs found by the GUI pass

The GUI-sheet pass (`specs/polish/gui-sheet-questions.md` #20–32) only reskinned surfaces, but along the way it found logic bugs in the member portal. The portal is behind the opening-soon gate in production today, so no member hits them yet. They must be fixed before the member world opens.

## Fix (a commit each, with a fail-first test where logic allows)
1. **Marketplace (#20).**
   - Read `price_tc` / `total_tc`, not `price` / `total_price`.
   - The "not enough Gems" check fires.
   - The balance stays a number after a purchase.
   - "My orders" queries real columns.
   - The status checks `pending_pickup`.
2. **Jobs (#21).**
   - Use the table's and `/api/jobs`' real fields: `title`, `company`, `job_type`, `url`, `created_at`.
   - Submissions validate and show their real errors, and the sheet closes only on success.
   - Saved jobs persist across reloads.
3. **Kanban (#22).**
   - Load checklists from their own table.
   - Comments use `body`.
   - Drag and drop works on touch.
4. **Calendar (#23):** refetch when the week changes; a failed fetch shows an error, not an empty month.
5. **Spinners and silent failures (#24):** every page clears its loading state signed out and on error; saves surface failures; analytics shows an error instead of zeros.
6. **Confirmations (#25):** confirm before deleting portfolio items, announcements, marketplace items, quests and bounties, using the GUI sheet's confirm dialog.
7. **Event QR (#26).**
   - Point it at tethos.ca.
   - Check-in: search the repo and the other branches for an existing check-in route or flow (event attendance credits XP through `combat_event_attendance_xp` / `economy_event_attendance_credit`) and wire the QR to it.
   - If none exists, build `/student/check-in?event=<id>&code=<code>`: a signed-in member, a valid code, idempotent, crediting attendance through the existing trigger path. Any migration goes after the latest on main, into the smoke list.
8. **Admin hub flash (#27):** no "Admins only" flash before the profile loads.
9. **Bounty difficulty (#28):** the member board shows 1–5, like admin approval.
10. **Admin shop list (#29):** use an admin loader so retired items and coin prices show.
11. **Merch fulfilment (#32):** show the closed date, and clear stale errors when switching tabs.

## Don't decide; leave for David
- **#30:** quests paying XP and Gems for online activity. Gems are money-equivalent. Ledger rows 11, 23, 76, 200 and 225 partly superseded principle 3 for XP and play coins, not for Gems.
- **#31:** which tier-name set is right.

## Rules
- Never reveal the TC ≈ CAD or Gem ≈ CAD rate (the admin bounty list already shows Gem pay only).
- Never edit applied migrations; never touch production.
- Keep the GUI sheet's components and look.
- Test signed-in flows with the memory stores or dev paths, and say what couldn't be exercised.
