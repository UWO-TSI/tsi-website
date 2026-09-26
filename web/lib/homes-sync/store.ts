import type { HomeLayoutDoc } from "@/lib/homes/layout";

export type HomeStoreErrorCode = "unavailable" | "revision_conflict" | "room_cap" | "insufficient" | "room_count_mismatch" | "failed";
export class HomeStoreError extends Error {
  constructor(public code: HomeStoreErrorCode, message?: string) {
    super(message ?? code);
  }
}

export interface HomeRecord {
  rooms_count: number;
  layout: HomeLayoutDoc;
  revision: number;
}

export interface HomesStore {
  getHome(memberId: string): Promise<HomeRecord>;
  /** Atomic whole-document save (home_save_layout). */
  saveLayout(memberId: string, baseRevision: number, saveKey: string, doc: HomeLayoutDoc): Promise<{ revision: number; replayed: boolean }>;
  /** Atomic purchase (home_buy_room). */
  buyRoom(memberId: string, price: number, maxRooms: number, key: string, room: { id: string; wallpaper: string; flooring: string }): Promise<{ rooms_count: number; coins: number; replayed: boolean }>;
}
