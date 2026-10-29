# Beach volleyball (minigame)

Lane `game/volleyball` (`specs/lanes/volleyball.md`). Written 2026-10-29. UI and models follow `specs/design-bible.md`; it wins where this file disagrees.

## David's words (2026-10-29, verbatim)

> i need you to do a lane for beach volleyball minigame
> so game camera angle 3rd person be closer to character back right,
> serve: hold mouse and bar thing like fishing release to see how strong you throw the ball up, then you gotta time your jump and mouse click, there is a circle that closes in and you gotta time your press to serve, if late serve hits net and if early goes out.
> when recieving you can see circle close in on where the ball will land on the sand, and you press e to set
> spike is to time your jump under the ball abd press mouse to time the spike and where you look is where you land
> crtl is dive and it picks up the ball but you can dash and string it with q dash and ctrl to slide and dive for stronger dive
> here is the camera angle and the dimentions of the game
> when you jump and press right mouse you block, jump and press left you spike, jump with e you jump set, e you set, left click you bump idk what should right click do when not jumping

> beach volley ball is 2v2

> also has a ranking and leaderboard system

On the rods: the Beach ball rod (uncommon) is "unlocked when playing beach volleyball minigame and win 5 times in a row or like ranked wtv".

Decided through the coordinator, 2026-10-29: right click on the ground is **Call it** (the "Mine!" call).

David, 2026-10-29, verbatim: "i need you to remodel the beach ball net on the beach to be bigger, i want you to incorperate this mini game in the game but watch out for performance, i want it so the people who are playing have a differeny view than ppl walking by so it doesnt affect their perforamnce." He picked the beach net's spot; phase 1 is in the game (E at the net), not only a lab.

Reference: `specs/references/volleyball/camera-and-court.png` (another game; for the camera angle and the court's proportions only, never its art).

## Phases

| Phase | What | State |
|---|---|---|
| 1 | The core match: 2v2, playable solo (you and a bot partner against two bots), client side, on the beach's court (E at the net); `/lab/volleyball` for testing | Built, in review |
| 2 | Multiplayer 2v2: a Colyseus room per match, server-authoritative ball, a lobby at the court, bots fill empty slots | Design below; build after David approves phase 1 |
| 3 | Ranking and the leaderboard: a rating per player, tiers, a season board, win streaks, the Beach ball rod for 5 ranked wins in a row | Design below; build after phase 2 |
| Placement | The court on the new world's beach, at the net David picked | Done (§1) |

## 1. The court

Real beach proportions, scaled to our characters. A character stands `CHARACTER_HEIGHT` = 1.36 u for a 1.75 m person, so **1 m = 0.776 u** (`COURT_SCALE` in `lib/game/volleyball/court.ts`, one constant to tune).

| Thing | Real | In game |
|---|---|---|
| Court (lines' outer edges) | 16 × 8 m | 12.4 × 6.2 u |
| Net height (top tape) | 2.43 m (men) | 1.89 u |
| Net depth (mesh band) | 1 m | 0.78 u |
| Posts | 0.7 to 1 m outside the sidelines | 0.7 u outside |
| Antennae | at the sidelines, 0.8 m above the net | at the sidelines |
| Free zone | 3 m round the court | 2.3 u of sand, then a low rope and the beach |
| Ball | 0.21 m across | 0.2 u across (a little big, to read at distance) |

Axes: the net lies along x at z = 0; each team owns one half (z < 0 or z > 0). The ball touching a line is in.

**Where.** The beach's volleyball net (wharf-art2's spot, (-4, 103.5)), turned a quarter so the court runs along the beach: a 12.4 u court across the beach would run down its slope (1.5 u) and off the sand. The net moved 3.5 u west and 0.3 u seaward, to (-7.5, 103.8) (`generate.ts` VOLLEY), to clear the lifeguard tower. The court is all sand with nothing on it. Its sand falls 0.42 u across the court, and the ball and players follow it. The free zone's sea-side east corner has the lifeguard tower in it. Shells and gather spots keep off the court and its free zone.

**Sand.** Flat white line tapes draped on the sand (one mesh), the net, nothing else.

## 2. Camera

Third person over the right shoulder, as in the reference: close, the character a little left of centre and lower third, the net and the far court in the upper half.
- From the character's feet: 0.6 u right, 1.75 u up, 2.7 u back; it looks at a point 6 u ahead at 0.9 u up. FOV 60. While you toss your serve, the look lifts a little to keep the ball in view.
- The camera's yaw follows the mouse (pointer lock while playing); its pitch is clamped to a narrow band so the court always reads. "Where you look" is this camera's aim.
- Tunable in one table (`VB_CAMERA`), shown in the lab's panel.

## 3. Controls

| Input | On the ground | In the air |
|---|---|---|
| WASD | Move (camera relative) | Air control |
| Space | Jump | — |
| Left click | **Bump** (forearm pass) | **Spike** (timed; lands where you look) |
| E | **Set** (overhand) | **Jump set** |
| Right click | **Call it**: "Mine!" over your head for 1.5 s; your bot partner leaves that ball to you | **Block** (at the net) |
| Ctrl | **Dive**: a lunge that digs up a ball near the sand | — |
| Q | Dash (the movement system's dash) | Air dash |
| Q then Ctrl (within 0.3 s, or Ctrl during a dash) | **Slide dive**: longer, faster, wider reach and a cleaner dig | — |
| Hold left click (serving) | Fill the power bar; release to toss | — |
| Esc | Pause and leave | |

Ctrl is the movement system's crouch key on a Mac; inside the court it means dive. Ctrl with a click is a right click on a Mac, so the dive is Ctrl alone and the court reads `button === 2` from the mouse event, not the Ctrl state. The first click in a match takes the mouse (pointer lock), as the island's mouse-look does; Esc lets it go, and the HUD's Leave ends the match.

**Stamina hooks (spec only, until main-quest r3's stamina is on main):** the dash, the dive and the slide dive each cost a little stamina, refilled while walking or standing; an empty bar makes the dive shorter, never impossible.

## 4. The serve

1. **Stand.** The server stands behind the baseline and can walk along it. A **serve timer** counts 10 s in the HUD; at 0 the serve is a fault.
2. **Power.** Hold left click: the power bar fills and ping-pongs, as the fishing cast meter does (`lib/game/volleyball/timing.ts` `meterPower`, same triangle wave and the same speed-up on each pass). Release to toss: power sets the toss height (1.1 u to 3.2 u above the hand) and the serve's pace.
3. **Timing circle.** A ring around the ball closes in as the ball falls toward your hand. Jump (optional: a jump serve hits higher and harder) and click when the ring meets the inner ring.
   - **On time** (within ±0.09 s of the ideal moment): a good serve. It aims where you look, its pace follows the toss's power. Within ±0.035 s it's a **perfect** serve: a little more pace and a gold flash.
   - **Late** (the ball has dropped below the ideal): the serve hits the net.
   - **Early** (the ball is still above the ideal): the serve goes long, out.
   - No click before the ball falls to your ankles: the ball drops, a fault. (A high toss falls fast, so the late window is short: about 0.09 to 0.15 s.)
   The ideal moment is when the ball's centre reaches your hand height (your standing reach, or higher in a jump). The ring's size is the time left to it.
4. **The let.** A serve that clips the tape and goes over plays on (beach rules).

Serving order: the team that wins a rally serves the next. When a team wins the serve back, its other player serves (beach rotation).

## 5. The rally

**Touches.** Up to three per side; the same player may not touch twice in a row. The block counts as a touch (beach rules), and the blocker may play the next one.

**Contacts.** A press needs the ball within the contact's reach of the player's hands. Each contact has a timing window measured on the ball's time to the contact point: perfect, good, poor; outside it the press misses (a whiff, then a 0.35 s cooldown so spamming doesn't work).

| Contact | Reach (u): horizontal / height band | Where the ball goes |
|---|---|---|
| Bump | 0.95 / 0.2 to 1.1 | A high arc to your team's set spot (1.5 u off the net, mid court). Poor timing scatters it and lowers the arc; a bad one shanks out |
| Set | 0.8 / 0.9 to 1.9 | A high arc to the attack spot in front of your partner (or toward where you look, if your partner is far) |
| Jump set | 0.8 / in the air, above the head | As the set, quicker and flatter |
| Spike | 0.75 / in the air, above the head | Hard and down toward the sand point under your aim on the far side. Timing sets the pace (perfect 100%, good 85%) and the scatter; an early or late press is a weak roll shot that may find the net |
| Block | Arms over the net, 1 u wide, 0.9 u tall, for 0.35 s | A spike through it is stuffed straight down on the attacker's side (good timing) or popped up on your side (soft block, a touch) |
| Dive | 1.0 from the body, all along a 2.5 u lunge / up to 0.75 | A high, weak dig up on your side; then you're on the sand for 0.6 s |
| Slide dive | 1.3 from the body, all along a 4.7 u lunge / up to 0.75 | A cleaner, higher dig toward the set spot; 0.45 s on the sand |

**Receiving.** Whenever the ball is coming down on your half, a **landing circle** sits on the sand where it will land and closes in as it falls; a second, inner ring marks the moment to press. Get there and bump or set as the rings meet.

**Faults and points (rally scoring).**
- The ball lands in a court: that side loses the rally.
- The ball lands out, crosses outside the antennae, or stops on the net and falls out: the last team to touch it loses.
- Four touches, or a double touch: that team loses.
- A serve timer at 0, or a dropped toss: the server's team loses.
- A ball off the net is still in play while touches remain.

**The match.** One set to 21, win by 2. The teams switch sides every 7 points (when the sum of the scores is a multiple of 7): a short slide of the camera and a quiet "Switch" note. The winner of the coin toss (random) serves first.

## 6. Bots

Simple and believable; one skill value (0 to 1) drives every error.
- **Positions.** Receiving a serve: both back, each covering half the width. On defence: one at the net in front of the attacker (the blocker), the other deep on the line the attacker faces. On offence: the passer, the setter at the set spot, the attacker approaching.
- **Who takes the ball.** The player nearer the predicted landing point, unless their partner called it ("Mine!"). Your bot partner always respects your call, and calls its own balls with the same marker.
- **Bump, set, spike.** The passer bumps to the set spot; the setter moves under the ball and sets to the attack spot in front of its partner; the attacker runs in and jumps so its reach meets the ball, and spikes at the open sand furthest from the defenders. Your partner sets you when you've passed, and passes to the set spot so you can set it.
- **Blocking.** The opponent nearest the attacker's line moves to the net and jumps with the attacker. A bot blocks rather than pulling back to dig on 15% to 60% of attacks, by skill. Through the block, a centred, well-timed block stuffs the ball (quality 0.7 or more); anything less is a soft block.
- **Serving.** A random spot in the far court, with a skill-weighted chance to miss long or into the net.
- **Errors.** A bot waits for a touch of a quality it draws from its skill, or hits as the ball starts to get worse; now and then (up to 12% at skill 0) it misjudges a ball and misses it; a serve's click gets a gaussian error (σ 0.025 s plus 0.07 s × (1 − skill)); each target gets a scatter. Seeded, so tests repeat. Defaults: partner 0.75, opponents 0.6. Bot against bot, a match runs about 9.5 s a point (serve and point pause included), about 7 touches a rally, most points from a ball landing in.

## 7. HUD (flat kit, minimal)

One prompt at a time; nothing on screen that isn't needed now.
- **Top centre: the score.** Home and away, each with its team colour edge and the serving team's small ball icon. A point animates the number (spring), never jumps.
- **Under it: the serve timer** while someone serves.
- **Bottom centre: one key cue at a time**, only when it matters: "Hold to serve" while serving, "Bump / Set" (left click / E keycaps) when a ball is coming to you, "Spike / Block" while in the air near the ball or the net. Kit `Keycap`.
- **The power bar:** a new kit piece, `PowerMeter` (vertical, tokens only, a gold tip zone), added to `components/gui/flat/` and the `/lab/gui` showroom first. The fishing overlay's `CastMeter` keeps its own look for now (open question below).
- **The rings:** the timing ring round the ball and the landing circle on the sand are in the 3D scene, thin and white with a soft dark edge so they read on sand.
- **Big moments:** a point: a sand burst at the landing, the camera nudges, the score pops and a short "Point" word for the side that won it (in its team colour). The win: a slow-motion beat, confetti, the winning team cheering, and a flat panel with the final score, "Play again" and "Leave".

## 8. Juice

- Hit impacts: a short white flash ring at the contact, a 40 ms hit stop on spikes, a camera shake scaled by pace.
- Sand puffs: on every landing of the ball, every dive and slide, jumps and landings on the sand (the movement system's dust particles).
- The ball's trail while fast (a spike or a hard serve).
- Sounds: placeholders only if the audio library has them (`lib/game/audio.ts`); new sounds need David's direction.

## 9. Models

**The net (remodelled, David's direction: "remodel the beach ball net ... to be bigger").** `art/props/build_volleyball_net.py`, from wharf-art2's net: the same turned wooden posts with red rings, dark cord mesh, white top band and guy ropes. It now has real proportions: posts 0.7 m outside 8 m sidelines, the top tape at 2.43 m, 1 m of mesh, white side bands and a bottom band, and red and white antennae 0.8 m over the tape.
- **HD**, `volleyball-net-hd.glb`, 2400 tris: round cords on a 0.12 u mesh. For the player in a match, who sees it close.
- **LP**, `volleyball-net.glb`, 1600 tris: reduced from the HD, with its cords and posts decimated and the tapes, rings and antennae kept. For the world. The old net was 960 tris.
- Review: `specs/evidence/volleyball/p1/models/`.

**Stand-ins until David's references** (asked through the coordinator 2026-10-29): the ball (a plain off-white sphere), the line tapes (a flat ribbon mesh in code), and the bots' team rings. The ball's final model gets HD (a close-up of the ball) and LP (in play).

**Animations.** There are no volleyball clips yet. Phase 1 borrows existing village clips: bump `Pickup`, set and jump set `Cheer` (upper body), spike and serve `AttackMelee` (upper), block `Cheer` (upper), toss `CastSwing` (upper), a call `Wave` (upper), a point `Cheer`. A dive pitches the body forward over its knees in the `Glide` pose (arms reaching) and lies there until up. Proper clips (bump, set, spike, block, dive, a celebration) are an open question for the character-animation work.

## 10. Two views (performance)

David: "the people who are playing have a different view than people walking by so it doesn't affect their performance".

**Phase 1 (built).**
- **Passers-by** get the light view (`components/game/volleyball/Court.tsx`): the line tapes (one mesh, one draw) and the LP net, drawn on its own instead of merged with the beach props. The cost is 4 more draw calls and about 1,150 more triangles. No ball, bots, physics, HUD, rings or particles exist for them. The match is local to its player, so a passer-by sees only that player's avatar moving, synced like any walk through the avatar's ride (`myTrip.ride`).
- **The player in a match** gets the full view (`VolleyMatch.tsx`, mounted only while playing): the HD net, the over-the-shoulder camera, the three bots, the ball at the sim's full 120 Hz, the rings, the calls, the flashes and sand puffs, and the HUD.

Measured 2026-10-29 on the new world, headless, the island's top tier, over 6 s each (`specs/evidence/volleyball/shoot.mjs`, scene `island`):

| View | Main-thread time a frame (median / p95) | Draw calls | Triangles |
|---|---|---|---|
| Passer-by 20 m off, before (the court left out, its net merged with the props) | 3.7 / 4.7 ms | 404 | 953k |
| Passer-by 20 m off, after (the light view) | 3.7 / 4.3 ms | 408 | 954k |
| The player in a match | 4.9 / 5.4 ms | 505 | 1.22M |

**Phase 2 (design).**
- **Who gets what.** The room streams the ball to its four players at 30 Hz with their contacts. The island room carries the match's summary to everyone else: who plays, the score, and the ball at 5 Hz (position only).
- **Distance.** A passer-by within 30 m draws a plain low-poly ball (one draw), interpolated between those snapshots, with no shadow, trail or particles. Past 30 m, or with the lite tier, there is no ball at all, only the score over the court on the nameplate layer.
- **Never for passers-by:** no HUD, rings, particles, physics, bot AI or HD net. The bots are avatars from the room's state, drawn with the remote avatars' LOD and thinning (`components/game/net/lod.ts`, `thinning.ts`), so four players on the court cost a passer-by what four walkers do.
- **Watching on purpose.** A passer-by who stands at the court's edge for 2 s, or presses E on "Watch", gets the ball at 15 Hz and the score panel, still with no particles.

## 11. Code

All logic is pure TypeScript with no three.js or DOM, so phase 2's server can run the same code.

| File | What |
|---|---|
| `web/lib/game/volleyball/court.ts` | Dimensions, `COURT_SCALE`, sides, `inCourt` |
| `web/lib/game/volleyball/ball.ts` | Ball step (gravity, net, posts, sand), launch solvers (`arcTo`, `driveTo`), landing and height prediction |
| `web/lib/game/volleyball/timing.ts` | The power meter wave, the serve judge, the touch judge |
| `web/lib/game/volleyball/rules.ts` | Score, rally outcome, side switch, serving rotation, touch rules |
| `web/lib/game/volleyball/bot.ts` | Bot decisions |
| `web/lib/game/volleyball/match.ts` | The match engine: `createMatch`, `stepMatch(match, inputs, dt)`; every player moves with the movement sim (`stepMove`, court tuning) driven by keys or by the bot |
| `web/lib/game/volleyball/session.ts` | This player's match (start, stop, play again), the court from the world's net (`courtOf`), the HUD's change notices |
| `web/components/game/volleyball/Court.tsx` | The light view: line tapes and the net (LP, or HD for the player in a match) |
| `web/components/game/volleyball/VolleyMatch.tsx` | The full view: camera, input, the match stepped, bots, ball, rings, juice; you through `myTrip.ride` (`lib/game/movement/ride.ts` grew a move clip, its Air phase and one-shots) |
| `web/components/game/volleyball/VolleyHud.tsx` | The HUD; `components/gui/flat/PowerMeter.tsx` the new kit piece (in `/lab/gui`) |
| `web/components/game/DefaultIslandWorld.tsx` | The court on the island, the "Play volleyball" prompt at the net, the world's keys and clicks standing back in a match |
| `web/app/lab/volleyball/page.tsx`, `VolleyLab.tsx` | The dev route: the match on flat sand (`?seed=N`, `?bots=1`) |

---

## Phase 2: multiplayer 2v2 (design; build after David approves phase 1)

**Room.** A new Colyseus room type `volley`, one per match, in `realtime/src/rooms/VolleyRoom.ts`. Four slots (two per team). It runs `stepMatch` at 60 Hz on the server; the engine moves to `web/lib/net/volleyball/` (pure TypeScript, as the net contract requires) so the server bundles it.

**Who owns what.**
- The ball, the score, touches and faults: the server.
- Each player's body: the client predicts it with the movement sim and sends poses at 20 Hz, as on the island; the server keeps the sanity limits (speed, jump height, the net line) and rejects impossible poses.
- Contacts: the client sends `hit {kind, t, aim}` the moment it presses. The server rewinds the ball by the sender's half round trip (clamped to 150 ms), checks reach and timing against its own ball and the reported pose, and applies the contact or answers `miss`. The client plays the contact's animation and sound at once and corrects the ball when the server's next state arrives (usually under 100 ms).
- Serves: the toss and its power are the server's from the client's `toss {power}`; the serve click is a `hit` like the others.

**State (schema).** Match phase, score, serving team and player, side switch, the ball (position and velocity, quantized as the pose packet is), touches this side, last toucher, each slot's player id or `bot`, ready flags. Bots run in the room with the same `bot.ts`.

**Lobby at the court.** On the island, the court has two queue pads per side. Standing on a pad joins that team's slot; when all four are filled (or a 20 s countdown runs out with at least one person per team, or one person who chose "Play with bots"), the island room hands out a `volley` room id and everyone in it joins; empty slots get bots. A "Find a match" button in the court's prompt queues you through a matchmaker (`joinOrCreate("volley", {mode})`) for quick play. Friends can invite each other to a team.

**Leaving.** A dropped player has 20 s to reconnect (the island's rules); then a bot takes the slot and the match continues. A ranked match with a bot substitute stays ranked for the team that stayed and counts as a loss for the one who left.

**Deploy.** The room ships in the realtime package; the Fly deploy is the coordinator's.

## Phase 3: ranking and the leaderboard (design; build after phase 2)

**Ranked or casual.** A ranked match needs four signed-in players (no bots) or three plus a bot substitute after a drop. Everything else is casual and changes no rating.

**Rating.** Glicko-lite per player: a rating (start 1000) and a deviation (start 350, floor 60, growing back with time away). After a match each player updates against the other team's average rating, with their own deviation; the team's result is each player's result. The server records it: the realtime room posts the result to an internal API (`/api/volleyball/result`, signed like the other realtime calls), which writes in one transaction.

**Tables (a new migration).**
- `volleyball_matches`: id, played at, season, ranked, both teams' player ids, scores.
- `volleyball_ratings`: player id, season, rating, deviation, wins, losses, current streak, best streak, updated at. RLS: readable by members, written by the service role only.

**Tiers** (by rating, shown with an icon and a thin coloured edge, rarity-style): Sand 0, Shell 1100, Coral 1250, Wave 1400, Sun 1550, Legend 1700 (provisional, tuned on real data).

**Season.** Monthly. At the end, ratings move halfway back toward 1000 and deviations rise; the season's final board is kept.

**Leaderboard.** A flat kit panel at the court (and a tab on the portal's leaderboard page): the top 50 by rating with world names only (never real names), your own row pinned, tier icons, wins and the current streak.

**Win streaks and the Beach ball rod.** Five ranked wins in a row unlock the Beach ball rod (uncommon; the rod comes from the rod lane, `game/rod-gear`, reference `specs/references/rods/uncommon-beach-ball.png` in that worktree). The unlock is server-side: the result write checks the streak and grants the rod through the existing item grant path. A casual match doesn't break or extend the ranked streak.

## Open questions for David

1. **Models:** references for the ball (and the line tapes, if he wants more than flat tape). The net is remodelled from his direction.
2. **Animations:** volleyball clips (bump, set, spike, block, dive, a cheer) are new character work; phase 1 borrows existing clips and leans the body for a dive.
3. **Residents walk across the court**, during a match too (they don't touch the ball). Should their routes keep off the court?
4. **The power bar:** should the fishing cast meter move to the new flat `PowerMeter` kit piece too (one look)?
5. **Match length:** one set to 21 (as now), or best of three (21, 21, 15) for ranked?
6. **A reward** for a casual win (coins, a stamp), or nothing until ranked?
