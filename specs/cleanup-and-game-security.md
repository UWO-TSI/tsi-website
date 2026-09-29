# Cleanup + game-side security spec (wave B, first)

Owner: one agent in its own worktree off the Phase 0 branch. Source: `specs/ponytail-audit.md` (full item list with file:line and a proposed commit order). Load the `ponytail` skill. Every item is its own small commit; behaviour-preserving items keep the test suite unchanged; security items land with a test that fails before and passes after.

## Security items first (must land before any game migration is applied anywhere)
1. **Collections → coins exploit:** `member_collections` rows are member-writable (023, live in prod) and 033 lets collected items be sold. Make catch/find grants server-only (route + service function with per-species/hour caps), drop member write policies in a new migration, and make selling read server-granted counts only. Test: a member inserting 999 fish cannot sell them.
2. **`economy_sell` retry race:** overlapping retries take items twice and pay once. Make it idempotent per key and atomic (single statement / row lock). Test the overlap.
3. **Legacy Gem writers:** routes that still write Gems outside `wallet_apply` (or the #40/#41 service paths) move onto the single path or are deleted if superseded.
4. **Class badges after 034:** directory/badge code reads the old class values; map through the family mapping so badges and the class filter keep working.
5. **#40/#41 compatibility:** no game code writes guarded profile columns or server-only tables with a user-scoped client.
6. **Donate idempotency** and double-auth routes (LOW items).

## Then the Ponytail items in the audit's order
Two Oracle UIs → one; legacy local coins/gear/sell code removed where the server path supersedes it (the audit's "needs a call" item: the coordinator rules delete it, the server wallet is the only economy); shared server plumbing (one member context, one Result/error helper, one Postgres error mapper); dev harnesses consolidated to `?<area>=demo` plus one `/dev` index; one client fetch + idempotency-key helper; homes dead store; progression bridge layers; one profanity list; one demo fetch override; one Toronto-time helper (fix the month bug).

## Gates
tsc clean, full vitest green, focused lint, the local Postgres smoke chain, one screenshot of `/lab/island` and the applicant island to prove nothing visible changed. Report: lines removed, commits, tests added, anything skipped and why.

## Added after Phase 0 (2026-09-26)
7. **Family must be server-assigned.** Production's `profiles_guard_privileged` (migration 20260926120000) allowlists `class` and `subclass` because the legacy quiz writes them with the user key. The new Oracle writes the family through `oracle_complete` (service role) and the legacy quiz is retired, so add a game migration (timestamp after the combat draft) that redefines the guard's allowlist without `class`/`subclass`, and confirm no remaining user-key path writes them. Test: a member cannot set their own class.
