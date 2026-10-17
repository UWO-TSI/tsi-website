# HQ onboarding: after Bram's tour (row 312)

Decided with David on 2026-10-16. After Bram's walk-along ends at the beach, the player's next step is the HQ, where they register, get a little lore and a short tutorial.

## Decisions
1. **Host: Wren, the HQ lead.**
   - Bram's last line hands you off to the HQ ("Wren will want you signed in at HQ").
   - The tracker's next step is "Report to Wren at HQ".
   - Wren meets you inside and runs the whole visit.
2. **Registering means both of these:**
   - **Sign the island register.** A short in-world moment at the HQ desk: you sign the register with your world name, which is confirmed (real names never show). That makes you a resident. Your friend code is issued and your mailbox is set up, and Wren tells you about both in one line each.
   - **Your real club membership.** Wren explains that you're part of the real club. She teaches real-event check-ins: at a real TSI event you enter the check-in code, and that's what levels you up and earns rewards. Use the existing check-in flow; this is a guided intro plus where to find it, not a new system.
3. **Lore, kept light. Two beats only:**
   - **Real life counts.** "The island measures you by what you do out there, not in here." Lore and the XP doctrine (principle 3) are the same fact.
   - **The Founder.** You see the Founder's empty desk and the plaque. Only David writes the plaque text. Until he does, it shows a draped or blank plaque, and Wren says the Founder left it for whoever came next. Write no Founder words ourselves.
   - Follow `specs/lore.md`: never resolve the war, never name the player's substrate, no school vocabulary.
4. **The HQ tutorial teaches:**
   - **The Esc menu:** map, quests and journal, bag, friends and mail. Wren asks you to press Esc and open the map.
   - **Club goals and the notice board:** the board, the club goals, and how the café and museum funds grow from real activity and deliveries.
   - **Real event check-ins:** as in 2.
5. **Tools are unlocked by people, not handed out.**
   - David: "you unlock like bug net and stuff from npc convo and mini sub tutorial quest". After the tour you have only Bram's rod.
   - Every other tool (the bug net, the shovel, then later the axe and others, plus dash and glider as already planned) is unlocked by talking to a specific resident or Keeper, who gives you a tiny sub-tutorial quest that teaches the tool. For example: catch any bug, dig up one buried thing.
   - Each tool's quest shows in the quest tracker.
   - This replaces the starter net and shovel coming back to the wheel after the tour.
   - Existing players who already own tools keep them.

## Notes for the lane
- Build it data-driven, like the tutorial route (`web/lib/game/arrival/routes/`): an HQ onboarding script plus a table mapping each tool to its NPC, lines and quest steps. Wren's lines and each tool's lines are drafts for David.
- Pick who teaches which tool from the resident roster and `specs/lore.md` (each resident has one question). Propose the pairing; David reviews it.
- The chapter 1 steps (`settle-in`) should read sensibly after this: the plot is hidden in v1 (row 307), and "Report back to HQ" may become "Register at HQ". Any seed or copy change is a new migration.
