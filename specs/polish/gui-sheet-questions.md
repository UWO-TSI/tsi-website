# GUI sheet: questions for David (row 285)

Each one has the assumption I built on. Nothing here blocked the work.

## Look
1. **Primary colour.** Your kit's main action is teal. I kept our sage (`#426b5b`) for buttons and switches that are
   on, because the island HUD, the creator and the wheel already speak sage, and cream text on the kit's teal fails
   contrast. The kit's teal stays for checks, pips and the name pill. *Assumed: sage primary, teal accents.*
2. **Name tags and the teal pill.** The kit puts white text on its coral tag and cream text on its teal pill; both
   fail AA (2.8:1 and 1.9:1). I kept the kit's colours and darkened the text instead (our ink on coral and on teal).
   *Assumed: the kit's colours, dark text.*
3. **One face.** Tethos Nunito everywhere in the member world: game, portal, companion, creator. Test Sohne stays on
   the marketing site and the recruitment flow. *Assumed: yes.*
4. **The Oracle keeps its lavender** (the sheet's "oracle" tone) inside the kit. *Assumed: yes.*
5. **Portal theme setting.** The portal's Light / Dark / System toggle is gone: the portal is the cream kit only
   (Dark was the navy terminal look). The recruitment board subtab keeps its own look and still follows the stored
   theme or the system. *Assumed: retire the toggle.*
6. **Page banners in the portal.** Butter (with the confetti) for money and reward pages (bounties, shop, wallet,
   sell, bag), sage for club and people pages, coral for events; admin tools keep a plain title. *Assumed: this split.*
7. **The fish reveal** keeps its gacha rays and rings, now on warm paper in the member world (the applicant island
   keeps the dark backdrop it shipped with). *Assumed: cozy paper, the rays kept.* (fishing.md asked "gacha rays vs
   cozy": this is both.)
8. **The pointing glove** on the chosen list row is drawn from lucide's Pointer, filled paper with an ink outline, not
   the kit's glove. *Assumed: fine.*

## Keys and names
9. **I is the Bag, K the wallet.** The naming pass made Journal = quests (J), Collection = catches (B, "Open
   collection" in Settings), Bag = items (I). I opens the existing Bag sheet (it was portal-only) and K the existing
   wallet sheet in the game. When the backpack (game-ui milestone 2) lands it takes over I. *Assumed: wire, not remove.*
10. **Confirm (Enter)** is no longer offered for remapping (Enter already presses the focused button); the stored
    setting stays, so nobody's saved keys break. *Assumed: hide it.*
11. **E closes a station's sheet.** A sheet you opened with E at a board, a desk or the curator closes with E as well
    as Escape (the dialog system's "opening key"). In a text field E still types. *Assumed: yes.*

## Things I found
12. **No way to rename after the creator.** If the name doesn't save, the creator now says so in a toast, but there is
    nowhere to set it again (Settings has no name row). Want a "Your island name" row in Settings? *Not built.*
13. **Face styles have no names.** The eyes and mouths are sheet codes ("Eyes F1.1", "Mouth G3.4"). In the member
    world they now show as pictures only (screen readers hear "Eyes, style 3 of 14"); the applicant island still
    prints the codes. Want names for the 14 eyes and 76 mouths? *Assumed: pictures only.*
14. **NPCChatOverlay** (the old dark NPC chat) is mounted nowhere. I left it; delete it, or rebuild it in the kit when
    resident talk lands (row 123)?
15. **The lab** (`/lab/*`, development only, 404 in production) keeps its dark developer chrome (the TSI LAB bar, the
    movement lab). Only the showroom `/lab/gui` is in the kit. *Assumed: dev tools can stay dark.*
16. **The sign-in page** (`/student`, GamePortalLogin) is marketing-owned and still dark. *Not touched (out of scope).*
17. **QuestChecklist** (the old onboarding-quest bubble on portal pages) is restyled in the kit, not retired; the audit
    asked whether to retire it for game players. *Assumed: keep, restyled.*
18. **components/dashboard** (a navy sidebar, top bar and widgets) was imported nowhere; deleted.
19. **Admin bounty pay.** The admin bounty list printed the client's `$ CAD` beside the Gem pay, which shows the
    Gem rate. It now prints the Gem pay only. If admins need the client budget, where should it live? *Assumed: Gems
    only.*

## Bugs the portal pass found (logic, not fixed: this pass was surfaces only)
20. **Marketplace** reads `price` and `total_price`, but the table and `/api/economy` use `price_tc` and `total_tc`: in
    production prices are blank, the "not enough Gems" check never fires, the balance turns into NaN after a purchase,
    "My orders" is always empty (it asks for a column that doesn't exist) and it checks `pending` where the stored
    status is `pending_pickup`.
21. **Jobs** reads `company_name`, `role_title`, `type`, `application_url`, `posted_at`; the table and `/api/jobs` use
    `title`, `company`, `job_type`, `url`, `created_at`. Cards show no company, role, type or Apply link, every
    submission fails validation (400) while the sheet closes as if it worked, and saved jobs are lost on reload.
22. **Kanban** selects `kanban_cards.checklist` (checklists are their own table), so columns likely load empty;
    comments use `content` where the column is `body`; drag and drop doesn't work on touch screens.
23. **Calendar** never refetches when you move between weeks, and a failed fetch looks like an empty month.
24. **Forever spinners and silent failures.** Portfolio, mentorship and quests never clear `loading` when signed out;
    election and members hang on a missing user or a network error; profile and settings saves fail silently;
    analytics shows zeros when a query fails.
25. **No confirmation** before deleting portfolio items, announcements, marketplace items, quests and bounties, or
    before rejecting a bounty.
26. **The event QR** (editor and print page) points at `https://tethos.org/student/check-in`: the site is tethos.ca and
    there is no `/student/check-in` route on this branch.
27. **The admin hub** flashes "Admins only" before the profile loads.
28. **Bounty difficulty**: admins approve at 1 to 5, the member board labels only 1 to 3.
29. **The admin shop list** uses the member loader: retired items never show, and coin-priced items have no price
    (it shows a dash).
30. **Design principle 3.** The quest board and the daily and weekly quests pay XP and Gems for online activity.
31. **Tier names** differ: members ("T1 · Admin"), analytics ("T1 · President") and `TIER_LABELS` (Founder,
    President, Lead...). Each page kept its own. Which set is right?
32. **Merch fulfilment** never shows the closed date, and an old error stays when you switch tabs.

## Copy to check
33. Settings' new **World** tab (ghost replays and onboarding quests; the Appearance tab went with the theme toggle).
34. Directory filter **Active / Everyone**; mentorship **Every two weeks** (was Bi-weekly); portfolio swatch names as
    they look on cream (Sage, Teal, Honey, Violet, Rose, Emerald; the saved values are unchanged).
35. Bounty submission statuses **Not accepted** and **Changes requested**; the buy sheet's **It's yours** and **That
    didn't go through**; merch **Waiting for pickup / Handed over / Cancelled** with **Hand over** and **Cancel and
    refund** (were Fulfil and Cancel).
36. **Admins only** (with "These tools are for T1 and T2 admins"), **Resident chats** for NPC conversations, quests'
    **Turn off / Turn on**, and skulls as the bounty difficulty icon.
37. The RAG tool no longer calls you "agent" or claims to be connected; its welcome and reply are rewritten.
