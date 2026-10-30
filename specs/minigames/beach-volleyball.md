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

## David's phase 1 review (2026-10-30, verbatim)

> beach volley ball redo, the controlsl dont even work properly

- Camera: "camera angle fine, but the field and net needs to be bigger. the background needs more work, should be similar logic to the sushi, where it zooms you into the playing field"
- Serve: "serving the ui for the bar needs to be different, and more dramatic, rn its linear and moring, it should be juicy, and max power should be awarded, the ball movement should be in slowmo, slower, ball should be a bigger beach ball, move slower, the ring should be better and you can do like serve direction based on where in the ring you click maybe, and also add a ui for where on the volleyball to hit for curve ball"
- Receive: "the ball should move slow mo and pick up pace slowly as the game goes on, the ui at the bottom that shows the bump and stuff needs more work, should have a character action icon to show what it does, currently theres no character rigging animation for these actions and we nee better vfx and character movement for the game. the game should feel smoother, jumping causes the bottom ui set to swich, and jumpnig is higher and slowmo"
- Rally: "none of these have proper animation, movement, doesnt register properly and ui sucks. needs a redo"
- Block: "doesnt even show in the ui, plus no proper animation or logic"
- Dive: "needs animation redo for dive, i need you to open blender for character movement and do it properly, redo everything properly dont half ass this"
- Point and win: "better more exciting ui and micro animations should feel juicy with vfx"
- Island: "should have some sort of leader board on the side and a bench if you wanna spectate the current game, if youre not playing it will have default playing animation t osave performance"
- Island match: approved. Net: "the net needs proper remodeling to look cooler and better modeled"
- The open questions: "1 beach ball will be provided in chat, 2 every hit the ball squish a lil like proper ball physics 3. keep them off the court 4. differnt meter, the serve one needs to look cooler, instead of normal bar its a trianle shaped top is wider and color different and it slighly zooms in and it shakes a lil as it rises to the top. 5. 21 6. casual win is just like chill coins, ranked gets better rewards and gets limited rod and gems and stuff"
- Effects (2026-10-30, after the plan page): "effects approved, should have differnt effect for timed hits, good, perfect ,early or late. and make these individually and make sure its good, also make fitting sound effect or go online t ofind sound effect libraries"

**Why the controls didn't register (round 2's root causes).** On the island, the avatar's own key handler ran first and took Space, Q and Ctrl (`preventDefault`), and the court's handler skips taken keys, so jump, dash and dive never reached the match (the lab has no avatar, so it worked there). A right click under mouse-look went to the orbit camera, which lets the pointer go on a right-hold, so a block or a call broke the look. The tool and emote wheels (Tab, G) were still live. And the contact windows were about ±0.06 s at the ball's old speed. Fixed at the root: the avatar's keys stand back in a match, the court takes the mouse on the window's capture phase (`lib/game/volleyball/courtInput.ts`), the wheels are off, presses wait for the ball (below), and the ball is slow. Checked with real key and mouse events on the island (`specs/evidence/volleyball/p2input.mjs`), every action in its stance.

## Phases

| Phase | What | State |
|---|---|---|
| 1 | The core match: 2v2, playable solo (you and a bot partner against two bots), client side, on the beach's court (E at the net); `/lab/volleyball` for testing | Round 2 (the redo) built, in review |
| 2 | Multiplayer 2v2: a Colyseus room per match, server-authoritative ball, a lobby at the court, bots fill empty slots | Design below; build after David approves phase 1 |
| 3 | Ranking and the leaderboard: a rating per player, tiers, a season board, win streaks, the Beach ball rod for 5 ranked wins in a row | Design below; build after phase 2 |
| Placement | The court on the new world's beach, at the net David picked | Done (§1) |

## 1. The court

Real beach proportions, scaled to our characters, then grown (David: "the field and net needs to be bigger"): the plan ×1.3 and the net ×1.15 (`COURT_GROW`). A character stands `CHARACTER_HEIGHT` = 1.36 u for a 1.75 m person, so **1 m = 0.776 u** (`COURT_SCALE` in `lib/game/volleyball/court.ts`). The table below is the real-proportion base; the court in the game is 16.1 × 8.1 u with the net's top tape at 2.17 u. The ball is David's beach ball, 0.4 u across.

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

**Round 2:** as a match starts, the camera glides in (the sushi bar's stool view's logic): from the island's view, up behind your baseline over the whole court, then down to your shoulder (1.8 s, smootherstep). The island's fog draws in to near 20 and far 70 while you play, so the court is the stage, and the island's top-right HUD steps aside. Anything between the camera and you (the palms in the free zone, a building) eases see-through round you: the island's own cut (`lib/game/occluders.ts`), aimed from the match camera. The shoulder view is a little further back (3.1 back, 0.65 right, 1.95 up). During your toss the look lifts to keep the ball and its ring in view.


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

**Round 2, the feel (one block, `lib/game/volleyball/feel.ts` VB_FEEL):**
- The ball has its own clock (`Ball.k`): it starts at 0.52 of real pace and quickens with each touch of a rally (+0.035) and a little with each point played (+0.006), up to 0.9. Velocities stay real-pace, so the launch solvers and the rules don't change; predictions convert.
- The court jump is higher and floatier (2.05 u high, 0.48 s to the apex, the same rise as vb_spike_jump), never cut short by letting go. Near the top of your own jump with the ball close, the whole match slows to 0.45 for the spike or the block.
- Movement on sand builds up and glides out more gently; under 2.6 u/s in a rally you're in the ready stance (vb_ready, vb_shuffle).
- **Presses wait for the ball.** A press up to 0.26 s before the ball reaches your hands waits and touches as it arrives, graded by how early it was; a press with nothing coming is a whiff (0.35 s cooldown). Every touch has a timing grade: perfect (within 0.06 s), good (0.14 s), or early or late.
- The hands are the vb_* clips' contact points (the rig reaches about 0.85 u): bump 0.45, set 0.8, spike 0.83 plus the jump, serve 0.84, dig 0.36.
- Each touch squashes the ball along where it's sent (30%, 0.2 s), and a fast ball stretches along its flight.

**The controls table** (`lib/game/volleyball/actions.ts`) is the one source for what each control does in each stance (serve, toss, ground, air): the match's input and the action bar both read it.

## 4. The serve

**Round 2:** the power meter is a triangle, wide at the top, filling from sea through coral to gold; it leans in and trembles harder as it fills, and flashes "Max" at the top. A toss at the top (0.94 or more) is a max-power serve, 18% harder. While serving, hold right click and move to pick the contact point on the ball (the spin picker): off centre to a side curves the serve away from that side, the top dives and the bottom floats. During the toss the mouse moves a cursor inside the timing ring: where you click in the ring moves the serve's target across (±3.2 u) and deeper or shorter (±2.4 u).


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

**Round 2:** the bottom is an action bar (kit `ActionBar`, in `/lab/gui`): one card per move with a pictogram of the move, its key and its name; ground row Bump, Set, Mine!, Dive (Slide dive after a dash), Jump; air row Spike, Jump set, Block; serve row Hold to serve, Curve; toss row Serve, Jump. The rows stack in one place and crossfade, and the shown row is steadied (air after 0.04 s aloft, ground after 0.09 s down), so a jump never flickers it. A slot that would connect now glows gold; a press flashes it, a whiff shakes it. Over it a touch's grade pops (Perfect!, Good, Poor). The serve meter is the kit's `ServeMeter`; the curve is the kit's `SpinPicker` (the ball's rendered icon). A thin line under the score shows the ball's pace. The point's word is bigger ("Point!" or "Their point"), the score digits spring in the team's colour, and the final card drops the ball in, rings gold on a win, and shows the coins.


One prompt at a time; nothing on screen that isn't needed now.
- **Top centre: the score.** Home and away, each with its team colour edge and the serving team's small ball icon. A point animates the number (spring), never jumps.
- **Under it: the serve timer** while someone serves.
- **Bottom centre: one key cue at a time**, only when it matters: "Hold to serve" while serving, "Bump / Set" (left click / E keycaps) when a ball is coming to you, "Spike / Block" while in the air near the ball or the net. Kit `Keycap`.
- **The power bar:** a new kit piece, `PowerMeter` (vertical, tokens only, a gold tip zone), added to `components/gui/flat/` and the `/lab/gui` showroom first. The fishing overlay's `CastMeter` keeps its own look for now (open question below).
- **The rings:** the timing ring round the ball and the landing circle on the sand are in the 3D scene, thin and white with a soft dark edge so they read on sand.
- **Big moments:** a point: a sand burst at the landing, the camera nudges, the score pops and a short "Point" word for the side that won it (in its team colour). The win: a slow-motion beat, confetti, the winning team cheering, and a flat panel with the final score, "Play again" and "Leave".

## 8. Juice

**Round 2:** David approved 15 effects and four timing grades per contact (the plan page); they're built in `components/game/volleyball/VolleyFx.tsx` and `VolleyStamps.tsx`, fed by `lib/game/volleyball/fxBus.ts`, with sounds in `lib/game/volleyball/sfx.ts` (synthesised, CC0, `art/audio/synth_volleyball.py`, logged in `web/public/audio/sfx/SOURCES.md`). Effects and sounds exist only for the player in the match. The text below is phase 1's.


- Hit impacts: a short white flash ring at the contact, a 40 ms hit stop on spikes, a camera shake scaled by pace.
- Sand puffs: on every landing of the ball, every dive and slide, jumps and landings on the sand (the movement system's dust particles).
- The ball's trail while fast (a spike or a hard serve).
- Sounds: placeholders only if the audio library has them (`lib/game/audio.ts`); new sounds need David's direction.

## 9. Models

**The net (remodelled, David's direction: "remodel the beach ball net ... to be bigger").** `art/props/build_volleyball_net.py`, from wharf-art2's net: the same turned wooden posts with red rings, dark cord mesh, white top band and guy ropes. It now has real proportions: posts 0.7 m outside 8 m sidelines, the top tape at 2.43 m, 1 m of mesh, white side bands and a bottom band, and red and white antennae 0.8 m over the tape.
- **HD**, `volleyball-net-hd.glb`, 2400 tris: round cords on a 0.12 u mesh. For the player in a match, who sees it close.
- **LP**, `volleyball-net.glb`, 1600 tris: reduced from the HD, with its cords and posts decimated and the tapes, rings and antennae kept. For the world. The old net was 960 tris.
- Review: `specs/evidence/volleyball/p1/models/`.

**Round 2, the net remodelled again** (David: "proper remodeling to look cooler and better modeled"; concept approved 2026-10-30): round white posts in navy padded sleeves with white piping and coral dome caps, clamps and a crank tensioner, guy cables to canvas sandbag anchors, a wide white top band with navy piping and stitching, white side bands with red-and-white antennae, a dark navy square mesh sagging a little. HD 9,436 tris, LP 2,378 (reduced from the HD). `art/props/build_volleyball_net.py`; `specs/evidence/volleyball/p2/p2-net-concept.png`, `p2-net-final.png`.

**The ball** (David's reference, `specs/references/volleyball/beach-ball.png`): six gores (red, white, blue, white, yellow, white), the clear valve cap, glossy vinyl. HD 5,520 tris (close-ups and the HUD icon), LP 288 (in play). `art/props/build_volleyball_ball.py`. The island's decorative beach balls use the LP too (the old a/b/c are gone).

**Stand-ins:** the line tapes stay a code ribbon draped on the sand (a model can't follow the sand's slope), and the bots' team rings.

**Animations (round 2).** The vb-anim lane's vb_* clips (vb_clips.glb, the contract in `lib/game/volleyball/clips.ts`), loaded only on the players in a match (your own avatar too, only while you play). The match plays them by name (`lib/game/volleyball/moves.ts`). A press starts its clip at a rate that brings the clip's contact frame to the ball's arrival (`syncRate`); the hands are the clips' contact points; the ready stance and its shuffle (left or right) play under 1.8 u/s, the run above; the dives last until the clips stand up (1.4 s). Phase 1's note follows.

**Animations (phase 1).** There are no volleyball clips yet. Phase 1 borrows existing village clips: bump `Pickup`, set and jump set `Cheer` (upper body), spike and serve `AttackMelee` (upper), block `Cheer` (upper), toss `CastSwing` (upper), a call `Wave` (upper), a point `Cheer`. A dive pitches the body forward over its knees in the `Glide` pose (arms reaching) and lies there until up. Proper clips (bump, set, spike, block, dive, a celebration) are an open question for the character-animation work.

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

**Round 2:** others see a player in a match as a steady stand on their side of the court, holding vb_spectate (through the slow state's `pose`; the fallback CrouchIdle until vb_clips.glb), not the live rally: one pose sample, then nothing while it holds. No protocol change, no server deploy.

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
| `web/components/game/volleyball/VolleyHud.tsx` | The HUD; the kit pieces `ServeMeter`, `ActionBar` (with `ActionIcon` pictograms) and `SpinPicker` (`components/gui/flat/`, in `/lab/gui`) |
| `web/lib/game/volleyball/feel.ts` | VB_FEEL: every feel number (pace, jump, apex slow-mo, movement, press buffer, block, squash, serve) |
| `web/lib/game/volleyball/actions.ts` | The controls table: what each control does in each stance |
| `web/lib/game/volleyball/courtInput.ts` | The court's keys and mouse (capture phase; the mouse's movement by stance: look, curve, ring) |
| `web/lib/game/volleyball/moves.ts` | Each move's clip (vb_* names; the marked fallback until vb_clips.glb), contact times and `syncRate` |
| `web/lib/game/volleyball/fxBus.ts`, `sfx.ts`, `components/game/volleyball/VolleyFx.tsx`, `VolleyStamps.tsx` | The effects and sounds, fed by the match's events; camera and time beats |
| `web/lib/game/volleyball/reward.ts`, `web/app/api/volleyball/{start,finish}` | The casual win's server-checked coins |
| `web/lib/game/volleyball/{island,leaderboard,cheapView}.ts`, `components/game/volleyball/BoardSheet.tsx` | The court on the island: footprint, bench, board, the others' cheap view |
| `web/components/game/DefaultIslandWorld.tsx` | The court on the island, the "Play volleyball" prompt at the net, the world's keys and clicks standing back in a match |
| `web/app/lab/volleyball/page.tsx`, `VolleyLab.tsx` | The dev route: the match on flat sand (`?seed=N`, `?bots=1`) |

---

## Match and rewards (round 2)

One set to 21, win by 2. A casual win pays 15 coins (`economy_settings.volleyball_casual_win_coins`), at most 5 paid wins a Toronto day (`volleyball_casual_daily_wins`); later wins, losses and refused claims are recorded and pay nothing. The client is never trusted for the amount: a match on the island opens a server ticket (`/api/volleyball/start`); the claim (`/api/volleyball/finish`, the ticket and the score) pays only for a legal finished set the caller's team won, no sooner than 3 s per point played since the ticket opened (`volleyball_casual_s_per_point`), within 2 hours, once per ticket (wallet idempotency key `volleyball:casual:<ticket>`, ledger source `volleyball`). A new match abandons an open ticket. Table `volleyball_casual_tickets` (migration `20261030120000_volleyball_casual`, smoke `web/supabase/tests/volleyball_casual_smoke.sql`).

**Known limit until phase 2:** the match runs in the browser, so a determined cheater can still claim a fake win after waiting out the time floor; the daily cap holds that to 75 coins a day. Phase 2's server-run match closes it.

**Ranked rewards wait for phase 3:** better coin payouts, gems, and the limited Beach ball rod for 5 ranked wins in a row, written by the realtime room's signed result beside `volleyball_matches` and `volleyball_ratings`, never through the casual path.

**At the court (round 2):** a log bench up the grassy rise on the land side to watch from (`volley-bench`, the island's seat system); at the east end, toward the campfire, the leaderboard board (the plaza's catch board, `volley-board`): E opens "Top casual wins this week", sample data (labelled) plus your own wins on this device until phase 3 (`lib/game/volleyball/leaderboard.ts` `weeklyBoard`). Residents' routes keep off the court and its free zone. Surfboards and the court's ball moved off the free zone.

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

## Open questions for David (phase 1; answered 2026-10-30, see the review above)

1. **Models:** references for the ball (and the line tapes, if he wants more than flat tape). The net is remodelled from his direction.
2. **Animations:** volleyball clips (bump, set, spike, block, dive, a cheer) are new character work; phase 1 borrows existing clips and leans the body for a dive.
3. **Residents walk across the court**, during a match too (they don't touch the ball). Should their routes keep off the court?
4. **The power bar:** should the fishing cast meter move to the new flat `PowerMeter` kit piece too (one look)?
5. **Match length:** one set to 21 (as now), or best of three (21, 21, 15) for ranked?
6. **A reward** for a casual win (coins, a stamp), or nothing until ranked?
