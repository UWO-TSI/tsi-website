"""What sheets.py lays out: (title, file, [(scene, caption)]) before | after pairs, the strips, and the kit comparison."""

GAME = [
    ("game-hud", "The island HUD: one rounded face, the kit's keycaps, paper prompt, cues and toast"),
    ("game-nameplate", "Your nameplate: a paper tag (it was a dark chip with a blue glow)"),
    ("game-emotes", "The emote menu: a paper tray of icon petals (it was dark glass with emoji)"),
    ("game-settings", "Settings: the kit's switches, sliders, select and keycaps"),
    ("game-journal", "The journal (J): the one sheet frame, butter tabs"),
    ("game-collection", "The collection (B)"),
    ("game-letters", "The mailbox"),
    ("game-notice", "The notice board"),
    ("game-trophies", "The trophy case: list rows, a formatted week, real states"),
    ("game-showcase", "The showcase: item tiles, an empty state, slot clearing"),
    ("game-missions", "The ruins mission board"),
    ("game-tourney", "The tourney board"),
    ("game-cafe", "The old café's goal"),
    ("game-closet", "The fitting room"),
    ("game-oracle", "The Oracle: lavender in the kit"),
    ("game-donate", "The curator: list rows and the curator's tag"),
    ("game-shop", "The shop: real icons, the kit's tabs and buttons"),
    ("game-crafting", "The workbench: recipe rows, ingredient counts"),
    ("game-devpanel", "The development panel (dev only)"),
    ("game-minimap", "The map"),
    ("game-wheel", "The tool wheel (an AA name pill)"),
    ("game-decorate", "Decorating: paper panel, real piece icons"),
    ("game-ruins", "The ruins HUD (restyled through tokens only)"),
    ("game-greeting", "Wren's greeting: our painted dialogue paper, the coral tag"),
    ("game-creator", "The creator"),
    ("game-creator-dark", "The creator with the OS in dark mode: it stays cream now"),
    ("game-gift", "Today's gift"),
    ("game-loading", "The loading screen"),
]
OVERLAYS = [
    ("game-fish-reveal", "The first-catch reveal: warm paper (it was a dark gacha backdrop)"),
    ("game-oracle-reveal", "The Oracle's reveal card: paper lit by the family colour (it was dark glass)"),
    ("game-rune", "The rune overlay: parchment (it was dark glass)"),
    ("game-emote-menu", "The emote menu, standalone"),
]
PORTAL = [(f"portal-{p}", c) for p, c in [
    ("bounty", "Bounty board"), ("calendar", "Calendar"), ("directory", "Directory"), ("economy-wallet", "Wallet"),
    ("economy-shop", "Shop"), ("economy-inventory", "Bag"), ("economy-sell", "Sell"), ("jobs", "Job board"),
    ("journal", "Journal"), ("kanban", "Kanban"), ("leaderboard", "Leaderboard"), ("letters", "Mailbox"),
    ("marketplace", "Marketplace"), ("mentorship", "Mentorship"), ("oracle", "The Oracle"), ("portfolio", "Portfolio"),
    ("profile", "Profile"), ("quests", "Quests"), ("settings", "Settings"), ("shop", "Gem shop"), ("tools", "Tools"),
    ("admin", "Admin"), ("menu", "The menu"), ("onboarding", "Profile wizard"), ("opening-soon", "Opening soon (production while closed)"),
]]
COMPANION = [(f"companion-{p}", c) for p, c in [
    ("study", "Study"), ("club", "Club: bounties"), ("club-calendar", "Club: calendar"), ("me", "Me"),
    ("me-bag", "Me: Bag"), ("me-journal", "Me: Collection"), ("me-mailbox", "Me: Mailbox"), ("me-showcase", "Me: Showcase"),
]]
ACCESS = [
    ("text-xl-journal", "The journal at the largest text size"),
    ("text-xl-settings", "Settings at the largest text size"),
    ("keyboard-1-settings-tab4", "Keyboard only: the focus ring in Settings"),
    ("keyboard-2-journal-tabs", "Keyboard only: J opens the journal, Tab reaches its tabs"),
    ("keyboard-3-journal-next-tab", "The arrow keys move between the tabs"),
    ("gui-confirm", "The confirm dialog: the safe answer is the default"),
    ("gui-phone-sheet", "A sheet on a phone is a bottom sheet"),
]
APPLICANT = [
    ("applicant-island", "The applicant island: unchanged"),
    ("applicant-island-2", "The applicant island, after the creator: unchanged"),
    ("applicant-apply", "/student/apply: unchanged"),
]

SHEETS = [
    ("The game, before and after", "01-game.webp", GAME[:9]),
    ("The game's sheets, before and after", "02-game-sheets.webp", GAME[9:18]),
    ("The game's HUD pieces, before and after", "03-game-hud.webp", GAME[18:]),
    ("The game's overlays, before and after", "04-overlays.webp", OVERLAYS),
    ("The member portal, before and after", "05-portal-a.webp", PORTAL[:9]),
    ("The member portal, before and after", "06-portal-b.webp", PORTAL[9:18]),
    ("The member portal, before and after", "07-portal-c.webp", PORTAL[18:]),
    ("The phone companion (390 x 844), before and after", "08-companion.webp", COMPANION),
    ("The recruitment flow, before and after (must match)", "09-applicant-unchanged.webp", APPLICANT),
    ("Text size, keyboard and the dialog system", "14-access.webp", ACCESS),
]
STRIPS = [
    ("strip-sheet-open", "A sheet opening: scale and fade with the paper sound", "10-strip-sheet-open.webp"),
    ("strip-sheet-close", "A sheet closing (Escape)", "11-strip-sheet-close.webp"),
    ("strip-journal-open", "The journal opening on J", "12-strip-journal-open.webp"),
    ("strip-journal-close", "The journal closing on J again", "13-strip-journal-close.webp"),
]
COMPARISON = [
    ("gui-colour", ["palette"], "colour"),
    ("gui-type", ["type"], "type"),
    ("gui-buttons", ["buttons", "keycaps"], "buttons and keycaps"),
    ("gui-tabs", ["tabs"], "tabs"),
    ("gui-lists", ["shop-row", "recipe"], "list rows"),
    ("gui-tiles", ["inventory", "wheel"], "item tiles"),
    ("gui-dialogue", ["dialogue", "menu"], "dialogue"),
    ("gui-badges", ["recipe", "phone"], "badges and counters"),
    ("gui-banners", ["banner", "bells"], "banners"),
    ("gui-paper", ["banner", "inventory"], "paper and edges"),
]
