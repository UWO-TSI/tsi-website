# Project vision and design principles

> Moved out of `CLAUDE.md` on 2026-10-22, unchanged. Partly superseded: the ledger (`specs/game-world-development-plan.md`) and `specs/lore.md` win where they differ.

## Project vision (TL;DR)

- **Style:** ~~2D sprite characters in a 3D world~~ retired by ledger row 105: characters are low-poly 3D models on one shared rig. PS1 shader + ACNH curved-world shader.
- **Map:** 2-3 screens wide. Buildings (HQ, Shop, Oracle Temple) you enter; objects (Bounty Board, Job Board) open overlays.
- **5-tier RBAC:** T1 David / T2 chapter presidents / T3 PMs+VPs / T4 directors+devs / T5 volunteers+general.
- **MBTI class system:** 4 main classes (as implemented: Warrior/Mage/Healer/Rogue, colors in `specs/ux-classes.md`) + 16 subclasses, assigned via the Oracle Temple quiz. The gamified apply flow reuses the same mapping.
- **Economy:** TSI Coins, never reveal conversion rate.
- **Phase 1 (current):** single-player game world, directory, all feature pages as overlays. Close Tier-1 punch list to merge to main.
- **Phase 2 (deferred):** multiplayer (Colyseus; **active since 2026-10-03**, see `specs/multiplayer.md`), Avatar creator (Nano Banana sprites), building interiors, Oracle v2 card-game, mobile.

## Design principles (set 2026-05-25)

These guide every scope and design decision. When trade-offs arise, choose the option that satisfies these. Confirmed by David.

> **Partly superseded (2026-09-26).** Principle 3 is overridden by ledger rows 11, 23, 76, 200 and 225 (XP from play and missions as well as IRL, play coins from in-game activity, a daily login gift). Rows 74–75 open study tables and the wider game to public accounts. Where this list and `specs/game-world-development-plan.md` disagree, the ledger wins; `specs/development-roadmap.md` has the build order.

1. **Community over productivity.** The portal is a 3D hangout, not a productivity tool. Bounties, jobs, leaderboards are features inside the hangout, not the engagement engine. When you have to pick: more social presence, less task throughput.
2. **The world must never feel empty.** AI NPCs always populate the world, scaling inversely with real-player count. Ghost-replay of recent member positions if multiplayer isn't on. No empty-world states ever ship.
3. **(Superseded, see above.) XP rewards IRL, TC rewards money-equivalent value.** XP comes only from in-person event attendance (QR check-in) and special admin grants. TC comes only from delivering monetary-value work (bounties, paid projects). **Never reward online activity** — no login streaks, no "visited a building" XP, no Habitica grinding.
4. **Cosmetic > functional class system.** MBTI classes and avatar customization are flair, not mechanics. Don't gate features behind class. Rich cosmetic + class identity is a late-game build (Phase 3+).
5. **Mobile-aware, always.** No feature ships that's fundamentally desktop-only. Mobile members may get a stripped "view + emote + chat" mode, but they must be able to *appear online* on their phone.
6. **Leaderboard: top half public, bottom half private.** Bottom-half members see only their own rank and anonymized neighbors. Privacy default.
7. **Senior members can mute the game-feel.** No mandatory quests for T1-T3. Onboarding quests are opt-in for everyone, skippable in one click.
8. **The world has a monthly content cadence.** Admins drop new NPCs, new shop items, seasonal palettes, new events monthly. The build must include admin tooling that makes this easy — never code-only content updates.

---
