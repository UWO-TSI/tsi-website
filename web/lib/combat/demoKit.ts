/**
 * The wave-0 test kit (design sheet §4, wave 0): placeholder abilities from today's primitives that exercise every
 * shared system, under `?combat=demo&subclass=demo` only (dev; never offered to members, `dev: true`). One key per
 * input kind (tap, hold, charge, toggle, drawn shape), a pair combo, a heavy ability, a speed rider, the movement
 * hooks (momentum, launch, the movement passive on an air jump), a mastery unlock at 3, ranks, the stat direction
 * and an ult. Numbers follow the §3 authoring budgets loosely; it is not balanced.
 */
import type { ClassKit } from "./classes";

export const DEMO_KIT: ClassKit = {
  key: "demo", name: "Demo Adept", family: "Arcane", role: "damage", style: "skill", dev: true,
  signature: { type: "staff", name: "staff" },
  stat: { kind: "max_mana", at1: 100, at20: 160 },
  keys: [
    { key: "demo.bolt", name: "Arc Bolt", description: "A quick bolt that hits harder the faster you move.", cooldown_s: 1.5, energy: 12,
      effects: [{ kind: "projectile", power: 1.4, speed: 18, range: 11 }], input: { kind: "tap" }, scale: { by: "speed", max: 0.5 },
      clip: { verb: "CastForward", scale: 1.2 }, vfx: { cast: "demo.cast", travel: "demo.bolt", impact: "demo.burst" } },
    { key: "demo.guard", name: "Ward", description: "Hold to ward: less damage and a frontal block while held.", cooldown_s: 3, energy: 10,
      effects: [{ kind: "buff", stat: "guard", value: 0.4, duration: 4 }, { kind: "buff", stat: "block", value: 0.6, duration: 4 }],
      input: { kind: "hold", max_s: 4 }, clip: { verb: "Guard" }, vfx: { cast: "demo.ward" } },
    { key: "demo.slam", name: "Starfall Slam", description: "Hold to charge, release to bring it down where you aim.", cooldown_s: 6, energy: 25,
      effects: [{ kind: "area", power: 2.6, radius: 2.8, at: "aim", knock: 4, status: { hold: 0.8 } }], input: { kind: "charge", min_s: 0.25, max_s: 1.2 }, heavy: true,
      clip: { verb: "Slam" }, vfx: { cast: "demo.charge", impact: "demo.slam", zone: "demo.crack" } },
    { key: "demo.familiar", name: "Familiar", description: "Call a wisp; press again to send it away.", cooldown_s: 2, energy: 15,
      effects: [{ kind: "summon", unit: "wisp" }], input: { kind: "toggle" }, clip: { verb: "Summon" }, vfx: { cast: "demo.summon" } },
    { key: "demo.sigil", name: "Mending Sigil", description: "Draw the circle: heals and wards, stronger the cleaner it is.", cooldown_s: 8, energy: 20,
      effects: [{ kind: "heal", amount: 0.2 }, { kind: "shield", amount: 0.15, duration: 6 }], input: { kind: "drawn", shape: "circle" }, unlock: 3, allies: 6,
      clip: { verb: "Channel" }, vfx: { cast: "demo.sigil" } },
  ],
  combos: [
    { keys: [0, 2], ability: { key: "demo.nova", name: "Surge Nova", description: "Bolt and slam together: a burst around you that throws you forward.", cooldown_s: 0, energy: 30,
      effects: [{ kind: "area", power: 1.8, radius: 3.5, at: "self", knock: 5 }, { kind: "momentum", speed: 4 }, { kind: "launch", height: 0.6 }],
      clip: { verb: "Spin" }, vfx: { cast: "demo.nova", impact: "demo.burst" } } },
  ],
  passive: { name: "Demo Focus", description: "Standing still briefly sharpens your hits.", kind: "still", value: 0.1 },
  movement: { name: "Demo Air Step", description: "In the air, jump again on a burst of wind. Keeps your momentum.", on: "airJump", energy: 15,
    effects: [{ kind: "launch", height: 0.8 }, { kind: "momentum", speed: 2 }], cooldown_s: 0.4 },
  ult: { key: "demo.ult", name: "Demo Cataclysm", description: "A meteor where you aim: the strongest hit in the kit.", cooldown_s: 0, energy: 0,
    effects: [{ kind: "area", power: 9, radius: 4.5, at: "aim", knock: 7, status: { hold: 1 } }], charge: 1, anticipation_ms: 450, impacts: "first",
    clip: { verb: "CastUp" }, vfx: { cast: "demo.ultCharge", impact: "demo.ultImpact", zone: "demo.ultDecal" } },
  ranks: [
    { at: 5, target: "demo.bolt", change: { label: "+20% power", power: 1.2 } },
    { at: 7, target: "demo.slam", change: { label: "+25% radius", radius: 1.25 } },
    { at: 10, target: "ult", change: { label: "+10% power", power: 1.1 } },
    { at: 16, target: "passive", change: { label: "+25%", power: 1.25 } },
    { at: 18, target: "ult", change: { label: "+10% power", power: 1.1 } },
  ],
  look: { ramp: ["#fff6ff", "#b48cff", "#3a2466"], mote: "mote", drift: "orbit", icon: "/assets/game/classes/demo.svg" },
};
