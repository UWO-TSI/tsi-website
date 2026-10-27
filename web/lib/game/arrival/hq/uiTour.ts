/**
 * Alice's UI tour (t-hq, specs/launch/v1-gameplay.md): "have a visual ui to show what to press and what to hold".
 * A step at a time over the room: the keys (each marked press or hold, with the player's own bindings), what they do,
 * and where on screen it lives when it's there to point at (`target`, a selector; the overlay rings it). A touch screen
 * gets its own words and no keys. DRAFTS for David.
 */

export interface TourKeys {
  /** Walk: the four move keys, as one label ("W A S D"). */
  move: string; jump: string; wheel: string; hud: string; map: string; mail: string; collection: string; bag: string;
}
export type TourPress = { key: string; hold?: boolean };
export interface TourStep {
  id: string;
  title: string;
  text: string;
  /** What to press (or hold); none on a touch screen. */
  keys: readonly TourPress[];
  /** A touch screen's words instead of `text`. */
  touch: string;
  /** What it points at on screen, if it's there. */
  target?: string;
}

export function tourSteps(k: TourKeys): TourStep[] {
  return [
    { id: "move", title: "Getting around", keys: [{ key: k.move, hold: true }, { key: k.jump }],
      text: "Hold to walk. Tap the jump key to hop over things. Drag the mouse or use the arrow keys to look around.",
      touch: "Hold the left of the screen and drag to walk. Drag the right side to look around." },
    { id: "talk", title: "Talk and use", keys: [{ key: "E" }],
      text: "Talk to people, go through doors, pick things up. The prompt at the bottom says what E does.",
      touch: "Tap the prompt at the bottom to talk to people, go through doors and pick things up." },
    { id: "tools", title: "Your tools", keys: [{ key: k.wheel, hold: true }],
      text: "Hold for your tool wheel, point at a tool and let go to take it out. Click to use it.",
      touch: "Tap the tools button for your tool wheel, then tap a tool. Tap the screen to use it." },
    { id: "hud", title: "Everything at a glance", keys: [{ key: k.hud, hold: true }], target: "[data-hud-right]",
      text: "Hold to see your coins, gems, level and gear up here. Let go and the screen clears again.",
      touch: "Your coins, gems, level and gear live up here." },
    { id: "quests", title: "Your quests", keys: [{ key: "J" }], target: "[data-testid=quest-tracker]",
      text: "Your next step is always written up here. J opens your quests and journal.",
      touch: "Your next step is always written up here. Tap it for your quests and journal." },
    { id: "map", title: "The map", keys: [{ key: k.map }], target: "[aria-label=Minimap]",
      text: "The whole island, and where you are on it. The minimap up top shows what's around you.",
      touch: "Tap the minimap up top for the whole island." },
    { id: "menu", title: "Your menu", keys: [{ key: "Esc" }],
      text: `The map, quests, your bag (${k.bag}) and collection (${k.collection}), friends and mail. Press it twice for settings.`,
      touch: "The menu button has the map, quests, your bag and collection, friends, mail and settings." },
    { id: "mail", title: "Your mailbox", keys: [{ key: k.mail }],
      text: "Letters from HQ and your friends land in your mailbox by the plaza. Open it from anywhere.",
      touch: "Letters from HQ and your friends land in your mailbox by the plaza. It's in the menu too." },
    { id: "chat", title: "Chat", keys: [{ key: "Enter" }], target: "[data-testid=chat-dock]",
      text: "Talk to everyone on the island. Type, then Enter to send. Keep it kind; the island remembers.",
      touch: "Tap the chat to talk to everyone on the island. Keep it kind; the island remembers." },
  ];
}

export const UI_TOUR = { eyebrow: "Alice's tour", press: "press", hold: "hold", next: "Next", back: "Back", done: "Done", skip: "Skip" } as const;
