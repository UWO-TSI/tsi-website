# Study: open questions for David


## 2026-09-24 (systems agent, study deliverables 1–5)

1. **Time counts during a short disconnect.** If you reconnect within 5 minutes, the block keeps running as though you never left, and those minutes count. If you don't, the session ends at your last heartbeat, so minutes after that point never pay. *Assumed:* this matches row 170 ("resume the same block") and can't be farmed by closing the tab.
2. **What "break" and "resume" do.** "Break now" ends the current focus block early: its whole minutes count, its bonus doesn't, and the break starts. "Skip break" starts the next block. Breaking early on the last cycle ends the session as finished, without that block's bonus. *Assumed.*
3. **Coins are paid when the session ends, not live.** A block's minutes bank when it completes, and the partial block's whole minutes bank when you leave. The timer card shows banked minutes, not a live per-minute count. *Assumed,* per row 79 ("paid when the session ends or finishes").
4. **Bonus scaling.** round(10 × focus length / 25) per completed block: 25 → 10, 50 → 20, 15 → 6, 90 → 36. Focus can be 5–90 minutes, breaks 1–30, cycles 1–8. There is no daily coin cap. Should there be one?
5. **What the lock does.** The first sitter is host. Locking lets in everyone already seated plus an optional `allowed` list; nobody else can sit, and outsiders see every seat as taken. When the host leaves, the next earliest sitter becomes host and the table unlocks. There is no friends system, so the companion's lock simply means "only people already here". *Assumed.*
6. **Sitting without starting.** A seated session with no timer yet still needs heartbeats and ends after 5 minutes away, paying 0 coins. *Assumed.*
7. **Table chat.** Only the mute state is built (muted during your own focus, unmuted on breaks, with a per-block override). Table chat messages are not built, since the spec only asks for mute state. Is chat wanted in v1 through the letters/profanity path?
8. **Starter tables.** 7 cafe tables (2 window, 2 two-seat, 2 four-seat, 1 three-seat couch) and 2 outdoor tables (plaza picnic, pier), each with a world `anchor` key, until David's interior layout arrives.
9. **Public (non-member) accounts** use the same tables and coin rate (rows 74–76). No member check was added.
10. **Where the board shows.** `/api/study/board` returns the opt-in top 10 for this week, and the companion has the opt-in toggle. The board's in-world display (the cafe wall) is left to the island agent.

### Resolved 2026-09-24 (coordinator)
- Q7: minimal table text chat in v1 is built. Seated members only, 200 characters, the shared profanity filter, 6 messages a minute or 60 an hour, and a report button (the message is flagged for T1/T2 and hidden for the reporter). Chat is muted during your own focus by default. Routes: `GET/POST /api/study/chat`, `POST /api/study/chat/:id/report`; the table is `study_chat_messages` in 032.
- Q5 (lock), Q1 (short-disconnect minutes) and Q2 (early break) are accepted. Q4 (daily coin cap) is with David; it stays uncapped.
