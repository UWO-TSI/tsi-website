/**
 * Placement proposals (STATE.md, v1 lanes): agents never edit the map data, so what they would place (barriers, rocks,
 * stargazing spots) comes as a proposal file under web/data/proposals/, which /lab/map shows as a ghosted overlay on
 * its target map with an Accept per object and for all. Accepting copies the objects into the painter's document
 * (undoable); David's Save writes the map. Pure: the painter and the tests share it.
 */
import v1Barriers from "@/data/proposals/v1-barriers.json";
import v1Campfire from "@/data/proposals/v1-campfire.json";
import type { MapObject, ObjectKind } from "./villageMap";

export interface ProposedObject extends MapObject { note?: string }
export interface Proposal {
  title: string;
  /** The map it is for: the v2 world (`/lab/map?fixture=v2`) or the shipped village. */
  target: "world-map" | "village-map";
  spec?: string;
  about?: string;
  objects: ProposedObject[];
}

export const PROPOSALS: readonly Proposal[] = [v1Barriers as Proposal, v1Campfire as Proposal];

const keyOf = (o: Pick<MapObject, "kind" | "id">) => `${o.kind}:${o.id}`;

/** The proposal's objects the document doesn't hold yet (by kind and id: an accepted one, or one David moved, stays his). */
export function pendingOf(p: Pick<Proposal, "objects">, objects: readonly MapObject[]): ProposedObject[] {
  const have = new Set(objects.map(keyOf));
  return p.objects.filter(o => !have.has(keyOf(o)));
}

/** The document with these proposed objects added, as map objects (the note stays in the proposal). */
export function acceptProposed(objects: readonly MapObject[], items: readonly ProposedObject[]): MapObject[] {
  const have = new Set(objects.map(keyOf)), added: MapObject[] = [];
  for (const { note: _note, ...o } of items) {
    void _note;
    if (have.has(keyOf(o))) continue;
    have.add(keyOf(o));
    added.push({ id: o.id, kind: o.kind as ObjectKind, x: o.x, z: o.z, ...(o.yaw ? { yaw: o.yaw } : {}), ...(o.scale && o.scale !== 1 ? { scale: o.scale } : {}),
      ...(o.seed !== undefined ? { seed: o.seed } : {}), ...(o.model ? { model: o.model } : {}) });
  }
  return [...objects, ...added];
}
