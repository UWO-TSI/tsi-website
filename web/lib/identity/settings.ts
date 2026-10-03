/**
 * Account settings (row 220): text size, high contrast, and key remap for
 * menus. Persisted per account (member_settings, 034); applied to the page as
 * `data-text-size` / `data-contrast` on <html> plus `--tsi-text-scale`.
 */
export const TEXT_SIZES = ["small", "default", "large", "xl"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];
export const TEXT_SCALE: Record<TextSize, number> = { small: 0.9, default: 1, large: 1.15, xl: 1.3 };

export const MENU_ACTIONS = ["openJournal", "openBag", "openMap", "openWallet", "openMail", "nextTab", "prevTab", "confirm"] as const;
export type MenuAction = (typeof MENU_ACTIONS)[number];
/** The naming pass (menus §4): `openJournal` opens the Collection (catches), `openBag` the Bag (items); the Journal (quests) is J. */
export const ACTION_LABEL: Record<MenuAction, string> = {
  openJournal: "Open collection", openBag: "Open bag", openMap: "Open map", openWallet: "Open wallet", openMail: "Open mailbox",
  nextTab: "Next tab", prevTab: "Previous tab", confirm: "Confirm",
};
/** The menu actions Settings offers to remap. `confirm` (Enter) stays a stored setting but isn't offered: Enter already presses the focused button. */
export const REMAPPABLE_ACTIONS: readonly MenuAction[] = MENU_ACTIONS.filter(a => a !== "confirm");
export const DEFAULT_KEYS: Record<MenuAction, string> = {
  openJournal: "b", openBag: "i", openMap: "m", openWallet: "k", openMail: "l", nextTab: "]", prevTab: "[", confirm: "enter",
};
/** Keys no remap can take: interact E, Escape, Tab, zoom Z, quests J, decorate F, emotes G, put away X, the camera back to its default view V. */
export const FIXED_KEYS: readonly string[] = ["e", "escape", "tab", "z", "j", "f", "g", "x", "v"];
/** Fixed keys, the movement defaults (Space jump, Q dash, Shift, C sneak, WASD), which belong to the game remap (rows 49, 244), and the arrows, which turn the camera. */
export const RESERVED_KEYS = [...FIXED_KEYS, "w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " ", "shift", "q", "c"];
const ALLOWED = /^(?:[a-z0-9]|f(?:[1-9]|1[0-2])|enter|backspace|\[|\]|;|'|,|\.|\/|-|=|`|\\)$/;

export interface AccountSettings {
  text_size: TextSize;
  high_contrast: boolean;
  key_bindings: Record<MenuAction, string>;
}
export const DEFAULT_SETTINGS: AccountSettings = { text_size: "default", high_contrast: false, key_bindings: { ...DEFAULT_KEYS } };

export function normalizeKey(key: string): string {
  return key.toLowerCase() === "spacebar" ? " " : key.toLowerCase();
}

export type SettingsCheck = { ok: true; settings: AccountSettings } | { ok: false; error: string };

/** Merge a partial update onto current settings and validate the result. */
export function mergeSettings(current: AccountSettings, patch: unknown): SettingsCheck {
  const p = (patch && typeof patch === "object" ? patch : {}) as Record<string, unknown>;
  const next: AccountSettings = { ...current, key_bindings: { ...current.key_bindings } };
  if (p.text_size !== undefined) {
    if (!TEXT_SIZES.includes(p.text_size as TextSize)) return { ok: false, error: "Unknown text size." };
    next.text_size = p.text_size as TextSize;
  }
  if (p.high_contrast !== undefined) {
    if (typeof p.high_contrast !== "boolean") return { ok: false, error: "High contrast is on or off." };
    next.high_contrast = p.high_contrast;
  }
  if (p.key_bindings !== undefined) {
    if (!p.key_bindings || typeof p.key_bindings !== "object") return { ok: false, error: "Key bindings must be a map." };
    for (const [action, raw] of Object.entries(p.key_bindings as Record<string, unknown>)) {
      if (!MENU_ACTIONS.includes(action as MenuAction)) return { ok: false, error: `Unknown action ${action}.` };
      if (typeof raw !== "string") return { ok: false, error: "Keys are strings." };
      const key = normalizeKey(raw);
      if (RESERVED_KEYS.includes(key)) return { ok: false, error: `${key === " " ? "Space" : key} is reserved.` };
      if (!ALLOWED.test(key)) return { ok: false, error: `${raw} can't be bound.` };
      next.key_bindings[action as MenuAction] = key;
    }
  }
  const keys = Object.values(next.key_bindings);
  const dup = keys.find((k, i) => keys.indexOf(k) !== i);
  if (dup) return { ok: false, error: `${dup} is bound twice.` };
  return { ok: true, settings: next };
}

export function readSettings(raw: unknown): AccountSettings {
  const r = mergeSettings(DEFAULT_SETTINGS, raw);
  return r.ok ? r.settings : DEFAULT_SETTINGS;
}

/** Apply to the document (island agent calls this from its settings sheet / boot). */
export function applySettings(s: AccountSettings, root: HTMLElement = document.documentElement): void {
  root.dataset.textSize = s.text_size;
  root.dataset.contrast = s.high_contrast ? "high" : "normal";
  root.style.setProperty("--tsi-text-scale", String(TEXT_SCALE[s.text_size]));
}

/** Which menu action a keydown triggers, if any (Escape handled by sheets). */
export function actionForKey(s: AccountSettings, key: string): MenuAction | null {
  const k = normalizeKey(key);
  return (Object.entries(s.key_bindings).find(([, v]) => v === k)?.[0] as MenuAction) ?? null;
}
