import { createContext } from "react";
export const AVATAR_SKIN = ["#f0cbb0", "#dca77d", "#b77b55", "#815139", "#4a3026"];
export const AVATAR_HAIR = ["#c59853", "#553626", "#262526", "#a34e32", "#d7d1c5"];
export const AVATAR_SHIRTS = ["#849b73", "#728ead", "#ba7665", "#b39bc2", "#dcc99c"];
export type ApplicantAppearance = { body: "guy" | "girl"; skin: string; hair: string; shirt: string };
export const DEFAULT_APPEARANCE: ApplicantAppearance = { body: "guy", skin: AVATAR_SKIN[1], hair: AVATAR_HAIR[0], shirt: AVATAR_SHIRTS[0] };
export const ApplicantAppearanceContext = createContext(DEFAULT_APPEARANCE);
export function parseAppearance(value: string | null): ApplicantAppearance | null {
  try {
    const parsed = JSON.parse(value ?? "null");
    if (!parsed || !["guy", "girl"].includes(parsed.body) || !AVATAR_SKIN.includes(parsed.skin) || !AVATAR_HAIR.includes(parsed.hair) || !AVATAR_SHIRTS.includes(parsed.shirt)) return null;
    return { body: parsed.body, skin: parsed.skin, hair: parsed.hair, shirt: parsed.shirt };
  } catch { return null; }
}
