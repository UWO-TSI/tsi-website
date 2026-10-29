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

Reference: `specs/references/volleyball/camera-and-court.png` (another game; for the camera angle and the court's proportions only, never its art).

## Phases

| Phase | What | State |
|---|---|---|
| 1 | The core match: 2v2, playable solo (you and a bot partner against two bots), client side, its own arena at `/lab/volleyball` | Building |
| 2 | Multiplayer 2v2: a Colyseus room per match, server-authoritative ball, a lobby at the court, bots fill empty slots | Design below; build after David approves phase 1 |
| 3 | Ranking and the leaderboard: a rating per player, tiers, a season board, win streaks, the Beach ball rod for 5 ranked wins in a row | Design below; build after phase 2 |
| Placement | The court on the new world's beach | Phase 1 proposes 2 or 3 spots with shots; David picks; no world data changes until he does |

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

**Sand.** The court is sand with flat line tapes, on a sand arena with sky and sea at the edge. The arena is a dev scene in phase 1, so the island's layout and render budget don't change.

## 2. Camera

Third person over the right shoulder, as in the reference: close, the character a little left of centre and lower third, the net and the far court in the upper half.
- Offset from the character: 0.55 u right, 1.15 u up, 2.6 u back; looks at a point 6 u ahead at 0.9 u up. FOV 60.
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

Ctrl is the movement system's crouch key on a Mac; inside the court it means dive. Ctrl with a click is a right click on a Mac, so the dive is Ctrl alone and the court reads `button === 2` from the mouse event, not the Ctrl state.

**Stamina hooks (spec only, until main-quest r3's stamina is on main):** the dash, the dive and the slide dive each cost a little stamina, refilled while walking or standing; an empty bar makes the dive shorter, never impossible.

## 4. The serve

1. **Stand.** The server stands behind the baseline and can walk along it. A **serve timer** counts 10 s in the HUD; at 0 the serve is a fault.
2. **Power.** Hold left click: the power bar fills and ping-pongs, as the fishing cast meter does (`lib/game/volleyball/timing.ts` `meterPower`, same triangle wave and the same speed-up on each pass). Release to toss: power sets the toss height (1.1 u to 3.2 u above the hand) and the serve's pace.
3. **Timing circle.** A ring around the ball closes in as the ball falls toward your hand. Jump (optional: a jump serve hits higher and harder) and click when the ring meets the inner ring.
   - **On time** (within ±0.09 s of the ideal moment): a good serve. It aims where you look, its pace follows the toss's power. Within ±0.035 s it's a **perfect** serve: a little more pace and a gold flash.
   - **Late** (the ball has dropped below the ideal): the serve hits the net.
   - **Early** (the ball is still above the ideal): the serve goes long, out.
   - No click before the ball falls past your waist: the ball drops, a fault.
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
| Dive | 1.5 / 0 to 0.7, along the lunge | A high, weak dig up on your side; then you're on the sand for 0.6 s |
| Slide dive | 2.2 / 0 to 0.7 | A cleaner, higher dig toward the set spot; 0.45 s on the sand |

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
- **Blocking.** The opponent nearest the attacker's line moves to the net and jumps with the attacker.
- **Serving.** A random spot in the far court, with a skill-weighted chance to miss long or into the net.
- **Errors.** Each press time gets a gaussian error (σ 0.04 s at skill 1, 0.12 s at skill 0); each target gets a scatter. Seeded, so tests repeat. Defaults: partner 0.75, opponents 0.6.

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

## 9. Models (stand-ins until references)

Needed: the ball, the net with its tapes and antennae, two posts, the court line tapes, a boundary rope (optional). Per the Models chapter, none of these starts in Blender until David gives a direction and references (asked through the coordinator 2026-10-29). Phase 1 uses plain in-code stand-ins, labelled as such in the review: a two-colour panelled sphere, cylinder posts, a grid net with a top tape, and flat line strips. The final models get HD (close-ups: a shop or trophy view of the ball) and LP (the court in the world).

**Animations.** There are no volleyball clips yet. Phase 1 maps contacts onto existing clips: bump `HoldFront`, set `CastUp`, spike `Slam`, block `Cheer` held in the air, dive `DodgeRoll`, slide dive `SlideInDash`, serve toss `Throw`. Proper clips (bump, set, spike, block, dive, a celebration) are an open question for the character-animation work.

## 10. Code

All logic is pure TypeScript with no three.js or DOM, so phase 2's server can run the same code.

| File | What |
|---|---|
| `web/lib/game/volleyball/court.ts` | Dimensions, `COURT_SCALE`, sides, `inCourt` |
| `web/lib/game/volleyball/ball.ts` | Ball step (gravity, net, posts, sand), launch solvers (`arcTo`, `driveTo`), landing and height prediction |
| `web/lib/game/volleyball/timing.ts` | The power meter wave, the serve judge, the touch judge |
| `web/lib/game/volleyball/rules.ts` | Score, rally outcome, side switch, serving rotation, touch rules |
| `web/lib/game/volleyball/bot.ts` | Bot decisions |
| `web/lib/game/volleyball/match.ts` | The match engine: `createMatch`, `stepMatch(match, inputs, dt)`; every player moves with the movement sim (`stepMove`, court tuning) driven by keys or by the bot |
| `web/components/game/volleyball/` | The arena scene, the over-shoulder camera, the HUD |
| `web/app/lab/volleyball/page.tsx` | The dev route |

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

1. **Models:** references for the ball, net, posts and court (or an OK to search headless and show picks). Stand-ins until then.
2. **Animations:** volleyball clips (bump, set, spike, block, dive, a cheer) are new character work; phase 1 borrows existing clips.
3. **The court's spot on the beach:** 2 or 3 proposals in the phase 1 review.
4. **The power bar:** should the fishing cast meter move to the new flat `PowerMeter` kit piece too (one look)?
5. **Match length:** one set to 21 (as now), or best of three (21, 21, 15) for ranked?
