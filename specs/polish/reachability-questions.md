# Reachability: questions for David

Spec: `reachability.md`. Branch `game/polish-reach`. Every question has an assumption already built in, so nothing here blocks. Answer whichever you like; the rest stays as built.

## 1. Talking to residents

**How it works now.** Walk up to a resident (within about two steps) and the prompt says "Talk to Odile". Press E, or click or tap them from up to four steps away. Then:
- they stop where they are, a "!" pops over their head and they turn to you while you turn to them;
- the camera eases in and steps off to your shoulder only as far as it needs to see their face;
- the dialogue box opens (the GUI sheet's Dialogue, as Wren's first-login greeting) with their name tag, and each line types out in their voice: the dialogue blips, pitched per resident, on the syllables;
- while a line types, they play the Chat clip and their painted mouth moves; the line's expression shows on their face;
- E, Enter, Space or a click finishes a line, then goes on; after the last, they wave goodbye with a smile;
- their routine waits for you and catches up afterwards, from the spot where they stopped (a little brisker until it's level with the island's clock).

Escape leaves at any point. Seated residents stay seated and talk from the bench. Nobody starts a greeting bubble while you're talking. At the water's edge (or by a bug or a dig spot) the held tool's click keeps its prompt and E still talks.

**a. The lines.** Every resident has two or three conversations of two or three boxes, in their own tone (row 218). They're mine, for your review (row 217). The first talk of the day starts at a conversation picked by the date, and each talk after that moves to the next one. There are no talk counters (row 92).

| Resident | Conversations |
|---|---|
| **Wren**, HQ lead | "[happy] {name}! Good timing." / "I just pinned something new on the notice board. Or I meant to. It's in one of these pockets." / "Club goals are coming along, by the way. Everything you chip in shows on the monument." · "If you ever lose track of what's next, your Journal has it." / "[surprised] Oh! And check the mailbox. Letters from HQ go there. I write most of them. Sorry about the handwriting." · "[sleepy] I was up early sorting the volunteer sign-ups." / "[happy] Worth it, though. Somebody's always building something here." |
| **Mayor Eliza** | "[happy] Ah, {name}. Stay a while, if you like." / "This island started as one bench and an argument about where HQ should go." / "We were all wrong, of course. It went exactly where it needed to be." · "Every club goal you finish, the island remembers." / "[happy] The club monument grows a little each time. I check on it every morning." · "The light here changes with the seasons. Have you noticed?" / "[surprised] Autumn's my favourite. The whole path goes gold." |
| **Toren**, shopkeeper | "Welcome. Browse if you must." / "I keep the shelves in order of usefulness. Nobody has ever noticed." / "[sad] I've started to take it personally." · "Selling your catches? The rarer ones fetch more." / "That isn't me being generous. It's the rules." / "[happy] I'm a little generous." · "[sleepy] Inventory day. I counted the hoodies twice." / "There are the same number of hoodies. There are always the same number of hoodies." |
| **Odile**, museum curator | "[happy] {name}! Found anything with wings lately?" / "The museum's cases are waiting. The first of every find you bring me goes on show." / "With a label. I write very good labels." · "Did you see the dragonflies by the pond? Odonata. Lovely things." / "[surprised] They can fly backwards, you know. I think about that a lot." · "If you catch something you've never seen before, bring it to me before you sell it." / "Once it's in a case, it belongs to the whole club." |
| **Bram**, wharf keeper | "Tide's turning. You can hear it if you listen." / "[happy] And the gulls are flying low. Rain by supper, mark my words." · "Boat's ready whenever you want to go home." / "Your island's out past the pier. Small, but the sunsets are all yours." · "[surprised] Caught anything big yet?" / "Best fishing's off the end of the wharf at dawn. Don't tell anyone I told you." |
| **Sable**, Oracle keeper | "The crystal is quiet today. It's listening." / "What would you ask it, if you knew it would answer?" · "Which way will you grow, {name}? The temple can help you see it." / "[happy] Not decide. Only see. The deciding is yours." · "Stars are just old light. So are good friends." / "[sleepy] I was up late on the temple steps again. Clear skies." |
| **Pim**, workshop crafter | "[happy] Found a perfectly good plank on the beach. Perfectly good!" / "Bring me some wood and I'll show you a trick at the workbench." · "Measure twice, glue once. That's the whole secret." / "[surprised] Well. Most of it. The rest is snacks." · "Bottles wash up on the beach sometimes." / "Some have notes in them. Some have recipes. Keep your eyes open." |
| **Juniper** | "[happy] Morning laps! Want to race to the pier?" / "Kidding. Mostly. Stretch first, trust me." · "The sand's firmest right by the water." / "[happy] Best place on the island for a sprint. Try it!" · "[sleepy] I've been up since dawn. Is it lunch yet?" / "No? Then one more lap." |
| **Marlo** | "[happy] Hold still, you're in the shot." / "Kidding. Mostly. You do make a good shape for a sketch." · "I've drawn HQ forty times now." / "[sad] I'm not happy with any of them. That roof has a mind of its own." · "The pond looks different every hour." / "I'm out of the green pencil again. If you find one, it's mine." |
| **Nell** | "I named a star after the founders. The bright one over HQ, once it's dark." / "[happy] The fainter ones are for everyone who joined after. There's room for plenty more." · "[sleepy] Mornings are a rumour. I'm told they're nice." / "The island's best after dark anyway. The fireflies come out by the water." · "If you can't sleep, come and find me at the lamp bench." / "I'll show you the constellation that looks like a fishing rod." |

`{name}` is the member's island name. `[happy]` and the like set the painted face for that box: neutral, happy, surprised, sad, angry and sleepy (the face's six).

**b. Where the lines live.** A new column, `npc_personas.talk` (migration `20261003161600_resident_talk`, flagged below), edited in the Residents editor under "Conversations": one box per conversation, a line per text box. The database and the server both refuse what the game can't say (an unknown expression, a fifth box, an empty or 201-character line, a thirteenth conversation). Publishing keeps the old version in the history, like every other content edit (T1/T2 only, row 215).
- The migration gives the two residents already in production (Mayor Eliza and Toren) their conversations. The other eight carry theirs in the proposed roster (`lib/content/residentRoster.ts`) and get them when their seed migration lands, after you approve the roster (living-village questions §1).
- A resident with nothing authored falls back to their bubble lines, one box each, then to two gentle filler conversations.

**c. Portrait.** Row 123 mentions a portrait in the box. I framed the resident in the world instead, as Animal Crossing does: the camera eases in over your shoulder and their painted face is the portrait, expressions and mouth included. **Question:** do you want a painted portrait in the box as well? It needs the face rendered to a small texture per resident.

**d. A listening pose.** Between lines the resident stands attentively (Idle, facing you), and you stand still facing them. **Question:** do you want a Listen clip, a few nods for whoever isn't talking, for you and for residents chatting with each other? It's a clip in `build_clips.py`.

**e. The keepers indoors.** Wren at the HQ desk, Sable, Odile and Toren keep the interiors pass's behaviour: their station's E opens its sheet, and a click gets a bubble line with the Chat clip. **Question:** should a click on a keeper open the dialogue box with their conversations too, as in the village?

**f. Text speed.** Lines type at about 38 characters a second with a breath after each sentence. With the system's reduced-motion setting on, each line appears whole. **Question:** do you want a text-speed choice in Settings?

### Multiplayer (Colyseus, starting on another branch)

**Built:** a talk is each viewer's own local presentation. Nothing about it is sent or stored. Where a resident stands comes from their routine on the shared world clock. A talk only holds this viewer's copy of that routine, so on everyone else's screen the same resident keeps walking. The "!", the turn, the face, the camera, the box, the voice and the goodbye are all local. It's the same rule as the greeting bubble and residents stepping round you.

**What changes once players can see each other** (`specs/multiplayer.md`). The shared clock in §4.7 lines residents up between players. A local talk then holds only the talker's copy, so for about a minute (the talk, then the catch-up) the talker sees the resident in a different place from everyone else, and the others see the talker talking to empty air. For M2 (bubbles and the talking mouth) I'd add one small piece of shared room state, `engaged: { residentId: playerId }`:
- **One talker at a time.** The room grants the first E. Anyone else who presses E gets a short local line ("Oh, one moment!", in the same box), or waits in a queue of one.
- **What others see.** The resident stops and faces the player talking to them, plays the Chat clip and shows a small "…" bubble. Others never see the words: the conversation stays private, and only that it's happening is shared.
- **A time limit.** The room releases the hold after about 45 seconds, or when the talker leaves or disconnects.
- **Catching up.** The routine's lag is applied the same way on every client: it holds from the moment the room grants the talk and catches up afterwards. Every copy then agrees on where the resident is.
- **Chats and greetings.** A resident chatting with another resident breaks off for a player only on that player's screen, as now. The greeting bubble stays local.

**Question:** is that the rule you want, or should talks stay entirely local (simplest, and everyone sees a resident who never stops)?

## 2. The wallet (K, or click the coins)

**What it shows.**
- TC on its own card, with Gems beside it.
- Today's gift: if it's waiting, open it right there and the HUD counts it in; if it's opened, it says when the next one comes (midnight, Toronto time).
- What you've earned and spent lately, on two tabs, by day, each move in plain words with its own icon: "Sold Dace", "Bought Straw hat", "Today's gift".

It never shows a dollar amount or a rate between TC and Gems. The portal's Wallet page uses the same component. The list is the server's last 20 moves (the existing read), so the tab totals cover those 20, not a whole week.

**Question:** would a "this week" total be useful? It needs the wallet read to return a week of moves instead of the last 20.

The coin's name follows `COINS.name` ("TC" today). Your decision on the currency names (decisions #3) changes it in one place.

## 3. Sign-in links

**Built.**
- Every in-game "Sign in…" now links to the sign-in entry with the page you're on as `next`, so signing in brings you back. The words "sign in" in the message are the link:
  - toasts: adding a room, the ruins gate;
  - the gift card;
  - the wallet;
  - the bag and the chest;
  - the mission board;
  - the workbench;
  - the Oracle;
  - Settings;
  - the Journal's preview;
  - the creator's name check, which used to show the raw "Unauthorized".
- The trophy case, the tourney board and the mailbox offer a "Sign in" button.
- The study prompt and the phone companion link back to where you were. The companion's sign-in used to go to `/student` with no destination.
- A toast with a sign-in link stays up 6.5 seconds and can be tapped.

The builder is `lib/game/signIn.ts`. It never points `next` at a sign-in page or off the site.

**What I found at the sign-in entry (`/student`, `GamePortalLogin`; the other session owns it).**
- Google is already offered first ("Continue with Google"), with email and password under it, plus "Forgot password?" and "Create an account".
- `?next=` is honoured for both Google and email: through `/api/auth/callback?next=/student/go?next=…` and then `/student/go`. A visitor who is already signed in is sent from `/student` to `/student/go` with the `next` kept.
- Since #46, while the member world is closed, `/student/go` honours `next` only for pages that are open (an event check-in, recruitment, admin). A `next` inside the closed world (the island, the companion) still lands on the applicant portal, as it should until the world opens.

**What it needs from the other session (davidliu-37).**
1. **Keep the page someone was going to.** The middleware sends a signed-out visitor from `/student/dashboard/**`, `/student/onboarding/**` and `/student/election` to `/student` *without* `next` (`lib/supabase/middleware.ts`, each `url.pathname = "/student"`). So a deep link such as `/student/dashboard/economy/wallet` lands on the island after sign-in. Fix: `url.searchParams.set("next", pathname + search)` before each redirect. `/student/go` already validates it.
2. **Row 224, Google only.** Keep email and password for now. The applicants' sign-up (`components/recruit/AuthModal.tsx`) and `/student/signup` both create password accounts, so some existing accounts may only be able to sign in that way. Before removing the email form, "Forgot password?" and "Create an account", count them (read-only):

   ```sql
   select p.tier, count(*) from auth.users u left join public.profiles p on p.id = u.id
   where not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'google')
   group by p.tier order by p.tier;
   ```

   If members are in that list, tell them to use "Continue with Google" with the same address. Supabase links identities with the same verified email.
3. **The redirect allow-list.** The Google button's `redirectTo` now carries a nested `next` more often. Check that the production Supabase Auth redirect URLs allow `https://www.tethos.ca/api/auth/callback**` with query strings.

## 4. The phone companion

**Checked against the spec.** The GUI sheet pass had already done four of the items:
- real icons, as rounded app tiles instead of emoji;
- the kit's font;
- embedded portal pages readable on cream (no hard-coded white text left);
- the showcase as a bottom sheet capped at 92% of the screen.

**Built here.**
- A coin chip in the top bar that opens your wallet.
- The Me tab under the game's names, six tiles: Bag (items), Collection (catches), Journal (quests, new), Mailbox, Wallet (new) and Settings (new). The Collection tile used to open as "Journal" in the code; now it's Collection everywhere.
- Settings on the phone keeps only what a phone uses: text size, high contrast and sound. They're saved to your account, and the text size you pick now applies to the companion's pages too, not only its sheets.
- Every tab row (the bounty board's filters, the calendar's views) scrolls sideways when it doesn't fit. Its edges fade where more is hidden and the chosen tab slides into view. "Completed" used to be cut off at "Complet" with no hint that the row scrolls.
- The sign-in link keeps its destination (§3).

**Questions.**
- An unread count on the Mailbox tile, as on the island's mail button?
- The daily gift pop-up stays on the island. On the phone the gift waits in the Wallet. Do you want it to pop up on the phone as well?

## Migration to apply (flagged)

`web/supabase/migrations/20261003161600_resident_talk.sql`:
- adds `npc_personas.talk` (jsonb, default `[]`) and `npc_talk_ok()`, which checks the shape;
- seeds Mayor Eliza's and Toren's conversations, only where `talk` is still empty.

Apply it before deploying this branch: the Residents editor's publish writes the column. Smoke test: `web/supabase/tests/resident_talk_smoke.sql`, in the `GAME` list of `specs/evidence/launch-fixes/sql-smoke.sh`. It fails before the migration with `column "talk" does not exist` and passes after, with no `ERROR` lines.

## Sounds

Wired from what exists: the dialogue blips are the voice, re-pitched per resident, and a soft click moves to the next line. **Missing (for the sound pass, row 125):** a soft "pop" as the box opens; an Animal Crossing-style voice set per resident in place of the five shared blips; a little surprise sting for the "!".
