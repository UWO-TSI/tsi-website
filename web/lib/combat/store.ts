import type { Family } from "@/lib/oracle/engine";
import type { MissionProgress, MissionState } from "./missions";
import type { StatBlock } from "./progression";

export type CombatErrorCode =
  | "unavailable" | "insufficient" | "not_found" | "not_owned" | "needs_reset" | "not_enough_points" | "level_too_low" | "wrong_family"
  | "no_family" | "cooldown" | "not_ready" | "kill_xp_cap" | "unknown_enemy" | "unknown_mission" | "bad_hits" | "failed";
export class CombatError extends Error {
  constructor(public code: CombatErrorCode, message?: string) {
    super(message ?? code);
  }
}

export interface ProgressionRow {
  xp: number;
  level: number;
  stats: StatBlock;
  subclass: string | null;
}
export interface OwnedWeapon {
  weapon_key: string;
  durability: number;
  equipped: boolean;
}
export interface ProgressRow {
  id: string;
  mission_key: string;
  state: MissionState;
  progress: MissionProgress;
  started_at: string;
  completed_at: string | null;
}
export type XpResult = { xp: number; level: number; levelled_up: boolean; replayed: boolean };

export interface CombatStore {
  progression(memberId: string): Promise<ProgressionRow>; // ensures row + starter weapons
  family(memberId: string): Promise<Family | null>;
  grantXp(memberId: string, amount: number, source: "kill" | "mission" | "event" | "admin", ref: string, key: string): Promise<XpResult>;
  recordKill(memberId: string, enemyKey: string, eventKey: string): Promise<XpResult>;
  allocate(memberId: string, stats: StatBlock): Promise<StatBlock>;
  resetStats(memberId: string, key: string): Promise<{ fee: number; replayed: boolean }>;
  chooseSubclass(memberId: string, subclass: string, family: Family, key: string): Promise<{ subclass: string; fee: number; replayed: boolean }>;
  weapons(memberId: string): Promise<OwnedWeapon[]>;
  equip(memberId: string, weaponKey: string): Promise<void>;
  wear(memberId: string, weaponKey: string, hits: number, defeated: boolean, key: string): Promise<{ durability: number; replayed: boolean }>;
  repair(memberId: string, weaponKey: string, key: string): Promise<{ durability: number; cost: number; replayed: boolean }>;
  missionRows(memberId: string): Promise<ProgressRow[]>;
  startMission(memberId: string, missionKey: string, startKey: string): Promise<{ progress_id: string; resumed: boolean }>;
  saveMission(memberId: string, id: string, state: MissionState, progress: MissionProgress): Promise<boolean>;
  completeMission(memberId: string, id: string): Promise<{ xp_awarded: number; coins_awarded: number; replayed: boolean }>;
}
