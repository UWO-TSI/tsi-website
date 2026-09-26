# Phone companion spec (lightweight mobile shell)

Owner: one agent in its own worktree. Decisions: rows 28, 81, 118, 119, 214, 5 (principle: phones must appear online). Load `ponytail` first.

## Fixed decisions
| Topic | Decision | Row |
|---|---|---|
| Screens v1 | Study (join table, timer, coins, seat-mates, chat); club tools (bounties, events, calendar); profile, inventory, journal, mailbox | 118 |
| Study view | Low-detail 3D view of just the cafe table you sit at; fallback card without WebGL | 119 |
| No | Presence list, free emotes, combat, full world | 118, 28 |
| Notifications | In-game only | 214 |

## Deliverables
1. `/student/companion` shell: bottom tab bar (Study, Club, Me), mobile-first, the Tethos UI kit, sign-in gate reusing the existing auth.
2. Study tab: the existing `/student/companion/study` page plus a small R3F scene of one table (existing furniture GLBs, avatars as simple capsules until the character set lands), strict budget (dpr 1, no shadows, <60 draw calls), WebGL fallback card.
3. Club tab: existing portal pages for bounties, events and calendar rendered in the shell (reuse, do not rebuild).
4. Me tab: profile with display name, member dot, family, showcase; inventory (economy Bag sheet); journal (collections journal sheet); mailbox (letters sheet).
5. Desktop users hitting `/student/companion` get a link to the full game.
6. Evidence prefix P- under `evidence/companion/` at iPhone and Android widths; tsc, focused lint, vitest.
