# Multiplayer: open points (2026-10-03)

David settled the direction in ledger rows 296–299. The plan (`specs/multiplayer.md` §11) left the points below. Each has the default the build uses until David says otherwise.

## Coordinator defaults (build with these)
1. **Hostname:** `wss://tethos-rt.fly.dev`, not `rt.tethos.ca`, so the shared `.tethos.ca` session cookie never reaches Fly. Auth is an explicit bearer token.
2. **Room caps:** shards lock at 30 players and unlock below 26, hard cap 40. Rendering caps: 12 full avatars and 24 drawn on High, 8 and 16 on Light.
3. **Joining a friend's shard:** waits for M3 parties. Until then everyone joins the fullest open shard, which keeps friends together while the club is small.
4. **Chat safety extras:**
   - slow mode (2 lines a minute) for public accounts younger than 24 hours;
   - URLs refused from accounts younger than 7 days, and always shown as plain text;
   - logs kept 30 days (90 after a report resolves), with "Chat is logged for moderation" shown in the chat box.
5. **Residents thinning (principle 2):** service residents always stay. Flavour villagers walk home as players arrive (12, then 10 at 6+ others, 8 at 10+, 7 at 15+), and come back as players leave.
6. **AFK:** never kicked. People studying in another tab stay online, standing idle, flagged away after 5 minutes.
7. **Benches seat 2.** Two slots per bench.
8. **Testing before the world opens:** a Vercel Preview with `NEXT_PUBLIC_MEMBER_WORLD=open` and `NEXT_PUBLIC_REALTIME_URL` set for Preview only; production stays closed.
9. **Co-op authority (M3):** server-owned outcomes (HP, kills, rewards) with host-driven enemy motion, decided again when M3 starts.

10. **Requests without an Origin header** (non-browser clients) go on to the token check rather than being refused. A forged Origin is trivial outside a browser, so refusing them would add nothing; the token is the gate.
11. **Deploy order for new message types:** Colyseus closes a client that sends an unknown message type (a bare 4002), so the server always deploys before a client that sends new messages (M2 chat first).
12. **Friends' shards (M3):** `lock()` also refuses `joinById`, so parties need their own path into a soft-locked shard (a reserved seat, or `unlock` while seating a party).
13. **Phone players before M2:** an M1 phone client sits at 0,0,0 until it sends a pose; M2's phone presence gives it a rest spot.

14. **Activity state on the wire (after M1, one PROTOCOL bump):** the fishing cast (`CharacterMotion.fishing`: bobber, line, catch; its `scrub` and `poseRate`) and the boat trip (a `trip` field: route, start time on the world clock) are both plain data on the avatar already, so remotes can draw them from one replicated field each. In M1 others see an angler stand with the rod, and a traveller fade out under the veil and appear in the other island's area.

## For David (not blocking M1)
1. **Who answers chat reports, and how fast?** Today T1/T2 means you and the chapter presidents. Options: (a) T1/T2 as now, within a day; (b) add a moderator role for a few trusted execs; (c) you alone.
2. **More rest spots on the map.** Phone players rest on benches and café seats, and the village has 2 benches. When you next paint the island in `/lab/map`, add benches where you'd like people to gather (each seats 2).
3. **The Fly.io account and card** (row 297): run `! fly auth signup` (or `! fly auth login`), then add a card under Billing.
