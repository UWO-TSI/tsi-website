/**
 * Shared bits of the Arcane family's v2 kits (lib/combat/arcane/*.ts): element colours, icon paths and effect shorthands.
 */
import type { Effect } from "../kits";

export type Ramp = [string, string, string];
export const R: Record<string, Ramp> = {
  fire: ["#fff6d8", "#ff8a3d", "#5a1408"], water: ["#f2fdff", "#4fb8ff", "#0c2c5a"], earth: ["#fff3dc", "#c8955a", "#3a2414"], wind: ["#ffffff", "#9ff0d8", "#1f4a46"],
  steam: ["#ffffff", "#cfd8e3", "#4a5566"], lava: ["#fff0b0", "#ff6a1a", "#3a0a04"], grove: ["#f8fff0", "#8be08a", "#1f4a24"],
};
export const icon = (kit: string, name: string) => `/assets/game/classes/${kit}/${name}.svg`;
export const area = (power: number, radius: number, at: "self" | "aim" = "self", more: Partial<Extract<Effect, { kind: "area" }>> = {}): Effect => ({ kind: "area", power, radius, at, ...more });
export const zone = (radius: number, duration: number, at: "self" | "aim", more: Partial<Extract<Effect, { kind: "zone" }>> = {}): Effect => ({ kind: "zone", radius, duration, at, ...more });
export const counter = (negate: number, effects: Effect[] = []): Effect => ({ kind: "counter", window: 0.25, negate, effects });
