# Foraging, crafting, museum and shop polish: questions for David

From the foraging pass (`specs/polish/forage-craft-museum.md`, branch `game/polish-forage`). Each question has a recommended default, and the build already runs on that default unless it says otherwise. Evidence is in `specs/evidence/polish-forage/`.

## Calls the build made for you

**1. One fruit per shake.** A fruit tree shows six or seven fruit, but the server gives one harvest per tree per hour (row 83: everyone has their own copy). Built: one push drops the fruit hanging nearest you. It bounces and rolls to rest on your side. The rest stay up for the hour, and the shaken one stays gone until the hour turns. Evidence: `01-tree-shake.webp`, `02-tree-pickup.webp`.
- A) One fruit an hour per tree. (Built.) B) Animal Crossing's three: a shake drops three and each is its own pickup. That needs a server change: more than one harvest per tree per hour, and the coin balance that goes with it. C) Hang only one fruit per tree so what you see matches what you get.
- **Rec: A.** B can come with the economy's next tuning pass. C makes the trees look bare.

**2. Selling happens only at the shop's counter.** The spec said to delete the panels the world no longer needs, so the Bag's Sell buttons are gone. The Bag still says what a thing sells for, "at the shop's counter". Locked items are shown at the counter and refused. Evidence: `18-shop-counter.webp`.
- A) Only at the counter. (Built; Animal Crossing's way.) B) Bring back Sell in the Bag as a shortcut. C) Add a drop-off box later (at home or the HQ) that pays out overnight.
- **Rec: A now, C later** if members ask for it. B makes the trip to the shop pointless.

**3. The wardrobe's and the decorate sheet's "shop" links** used to open a shop panel over the world. They now say where to go: "More clothes at the shop in the village: buy it at the counter."
- A) Point to the shop. (Built.) B) Let those links open the counter from anywhere, like a catalogue order.
- **Rec: A.** It keeps the shop a place you visit (principle 1).

**4. The guided first glide is once per device.** After the first leaf glider is crafted, the nearest good ledge from where you stand is read off your painted map (nothing is placed). It gets a painted marker, and a ring lies where to land. A glide of at least 0.7 s that lands in the ring finishes the guide; Skip ends it. The "done" mark is kept in the browser. Evidence: `13-glider-unlock.webp`, `14-glide-guide.webp`.
- A) Per device. (Built.) B) Per account, which needs a column on the profile.
- **Rec: A.** It shows once and you can skip it, so a second showing on a new phone costs little.

**5. The HQ trophy case shows this week's six biggest catches** from the trophy list (`/api/collections/trophies`: two a member, so it shows the club). The best three sit at eye level and the next three below, each with its brass plate. Your own catch says "Yours". The gold, silver and bronze cups sit on the top shelf. E at the case still opens the full list. The applicant island keeps its old display. Evidence: `16-trophy-case.webp`.
- A) This week's, as the list. (Built.) B) All-time records.
- **Rec: A.** It changes every week, so there's always a reason to look.

**6. Your dig in multiplayer.** Every effect in this pass belongs to the person or thing it happens to: a tree's shake, a rock's flinch, a hole in the ground, the digger's lift, the bench's puffs. That way other players can see them when Colyseus lands. Finds stay personal (row 83). So another player could see your hole while their own clam is still buried in the same spot.
- A) Others see your sand and your hole, which fills in 90 s; their own crack shows again once it has filled. B) Others see only the sand.
- **Rec: A.** The hole is short-lived, and the world should show what people do in it (principle 2).

**7. The shopkeeper's and the curator's lines about a sale or a donation are fixed text** (`lib/game/shopCounter.ts`, `lib/game/peaceful.ts` curatorLine). Their everyday lines come from the residents' content.
- **Rec:** move the sale and donation lines into the residents' content in the admin tool's next pass (principle 8), so the monthly content drop can change them.

**8. A struck rock is spent for the hour.** One strike gives its material, and the bare outcrop stays until the hour turns (Animal Crossing allows several strikes a day). Evidence: `05-rock.webp`.
- **Rec:** keep one, for the same reason as question 1.

## Sounds (no sound source picked yet, `specs/polish/README.md` waiting #1)

**9. The missing sounds.** I wired only files we have. The Bag's fly-in no longer plays a dialogue blip at the end of every catch and find, and a full bag no longer plays the door. Silence stands in where nothing fits. `web/public/audio/sfx/MANIFEST.md` lists what plays now.

| Moment | Plays now | Wanted |
|---|---|---|
| A push on a tree | `footstep` quickened, quiet (a stand-in rustle) | a leaf rustle |
| Fruit or a branch landing | `footstep` slowed (a stand-in thud) | a fruit thud, a branch clatter |
| A rock struck | `click` slowed + `footstep` slowed | a rock clink |
| The spade going in | `footstep` slowed | a shovel scrape |
| A find into the hand, the Bag's fly-in | `click` raised at the grab; the fly-in silent (was `blip1`) | a pickup pop |
| A flower's petals | `footstep` raised, soft | a soft pluck |
| A bug flying off, the net through the air | `footstep` raised (was `exit`, then `blip4` for the net) | bug wings, a net whoosh |
| A full bag | nothing (was the `exit` door) | a soft "nope" |
| The bottle's cork | `click` raised | a cork pop |
| The scroll unrolling | nothing | paper unrolling |
| Hammer blows at the bench | `click` slowed | hammering on wood |
| A craft finished | the reward card's `confirm` | a craft jingle |
| The till counting | `click` raised, rising | a coin clink |
| A donation settling into its case | `confirm` raised | a museum chime |
| A step in a puddle | `footstep` raised and louder | a puddle splash |
| A guided glide landing in the ring | `confirm` | a small fanfare |

- **Rec:** take CC0 packs first (free, and available now), and generate any that don't fit. Normalise them to the set, then swap each stand-in out.

## Smaller things

**10. The pack grew by nine painted rows** (now 25 rows, the fishing splash at 15 and these at 16 to 24): petal, rock chips, the crack, the hole filling in, the sand burst, the hammer's puff, the finishing glint, leaf bits, the firefly glow. Every row was painted here; nothing was downloaded. **Rec:** keep them.

**11. The old sun-sprite sparkle on rare finds is gone.** A rare find now twinkles now and then from the new glow layer: round a bloom or a shell, over a rock's face, up in a crown, on a rare bug, with a soft chime once when you come near. **Rec:** keep it. It's the diegetic tell spec §3 asked for, without marking spots (row 195).

**12. Puddles dry the moment the rain stops.** **Rec:** keep that for now. A slow dry-out over a minute is a later nicety.

**13. Fireflies** are one instanced swarm now (one draw for their bodies, one for their glows, nothing allocated per frame). Their number and where they gather (the map's bushes) are unchanged. **Rec:** keep.

## Measured

FPS and triangles on the same spots, before and after (the island's own readout, High tier, this Mac): see `perf.txt` in the evidence folder and the report. Art made in this pass: the outcrops (stone 370, clay 376, iron 448, gold 466, crystal 388, the bare one 326 triangles), the hammer (220) and the trophy case (1,472, its plates 14).
