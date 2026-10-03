// The island room's synchronized state (specs/multiplayer.md §4.1), with schema 5's
// decorator-free builder. Every field has a default: schema 5 leaves a primitive
// undefined until it is set. Written out by hand so the test that holds it against the
// contract's NET_PLAYER_FIELDS / NET_ROSTER_FIELDS means something: the client reads
// it by reflection and types it with web/lib/net/protocol.ts.
import { schema, t, type SchemaType } from "@colyseus/schema";

export const Player = schema(
  {
    sid: t.uint16().default(0),
    uid: t.string().default(""),
    // The card (rare).
    name: t.string().default(""),
    badge: t.uint8().default(0),
    look: t.string().default(""),
    level: t.uint8().default(0),
    family: t.uint8().default(0),
    kit: t.string().default(""),
    mastery: t.uint8().default(0),
    aura: t.string().default(""),
    frame: t.uint8().default(0),
    // Presence (rare).
    area: t.uint8().default(0),
    flags: t.uint8().default(0),
    held: t.string().default(""),
    weapon: t.string().default(""),
    pose: t.string().default(""),
    seat: t.string().default(""),
    study: t.uint8().default(0),
    studyEnds: t.uint32().default(0),
    // Motion (client-authoritative, server-checked): the pose packet's wire integers.
    t: t.uint32().default(0),
    x: t.int16().default(0),
    y: t.int16().default(0),
    z: t.int16().default(0),
    vx: t.int16().default(0),
    vy: t.int16().default(0),
    vz: t.int16().default(0),
    yaw: t.uint16().default(0),
    move: t.uint8().default(0),
    air: t.uint8().default(0),
    leaf: t.uint8().default(0),
    lift: t.int16().default(0),
    /** Bumped (nextTp) with each applied teleport-flagged sample: receivers snap when it changes. */
    tp: t.uint8().default(0),
  },
  "Player",
);
export type Player = SchemaType<typeof Player>;

/** The whole shard's presence list: who is here and where, for everyone. */
export const RosterEntry = schema(
  {
    uid: t.string().default(""),
    name: t.string().default(""),
    badge: t.uint8().default(0),
    area: t.uint8().default(0),
    flags: t.uint8().default(0),
  },
  "RosterEntry",
);
export type RosterEntry = SchemaType<typeof RosterEntry>;

export const IslandState = schema(
  {
    /** The server's Date.now() when the room was created: the room timeline's 0. */
    epoch: t.float64().default(0),
    shard: t.uint8().default(0),
    /** Each client receives only the players its StateView holds (same area, in range). */
    players: t.map(Player).view(),
    roster: t.map(RosterEntry),
  },
  "IslandState",
);
export type IslandState = SchemaType<typeof IslandState>;

/** A schema class's fields in declaration order, as [name, wire type]. */
export function schemaFields(klass: { [Symbol.metadata]?: unknown }): [string, unknown][] {
  const md = klass[Symbol.metadata] as Record<number, { name: string; type: unknown }> | undefined;
  const out: [string, unknown][] = [];
  for (let i = 0; md && md[i] !== undefined; i++) out.push([md[i].name, md[i].type]);
  return out;
}
