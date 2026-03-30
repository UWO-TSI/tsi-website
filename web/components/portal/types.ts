/**
 * Temporary frontend types — will be replaced when Backend commits
 * web/lib/supabase/types.ts with the real Supabase-generated types.
 */

export type Tier = 1 | 2 | 3 | 4 | 5;

export interface Profile {
  id: string;
  display_name: string;
  email?: string;
  bio?: string;
  avatar_url?: string;
  avatar_config: Record<string, unknown>;
  tier: Tier;
  level: number;
  xp: number;
  coin_balance: number;
  class?: string;
  subclass?: string;
  skills: string[];
  social_links: Record<string, string>;
  year?: number;
  is_active: boolean;
  onboarding_completed: boolean;
  created_at: string;
}

export interface DirectoryMember {
  id: string;
  display_name: string;
  avatar_url?: string;
  tier: Tier;
  level: number;
  xp: number;
  class?: string;
  skills: string[];
  is_active: boolean;
}

export const TIER_LABELS: Record<Tier, string> = {
  1: "Founder",
  2: "President",
  3: "PM / VP",
  4: "Developer",
  5: "Volunteer",
};

// Matches specs/ux-directory.md Section 5 and specs/tokens.md Section 8
export const TIER_COLORS: Record<Tier, { color: string; bg: string; border: string }> = {
  1: { color: "#ffd166", bg: "rgba(255, 209, 102, 0.2)", border: "#ffd166" },
  2: { color: "#4A7AFF", bg: "rgba(0, 47, 167, 0.2)", border: "#002fa7" },
  3: { color: "#22d3ee", bg: "rgba(34, 211, 238, 0.2)", border: "#22d3ee" },
  4: { color: "#22c55e", bg: "rgba(34, 197, 94, 0.2)", border: "#22c55e" },
  5: { color: "#a1a1aa", bg: "rgba(161, 161, 170, 0.15)", border: "#52525b" },
};

export const XP_PER_LEVEL = 100;

export function getXpProgress(xp: number) {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const current = xp % XP_PER_LEVEL;
  return {
    level,
    current,
    needed: XP_PER_LEVEL,
    percent: (current / XP_PER_LEVEL) * 100,
  };
}

// Mock data for development — remove when Backend API is ready
export const MOCK_MEMBERS: DirectoryMember[] = [
  { id: "1", display_name: "David Liu", tier: 1, level: 24, xp: 2380, class: "Architect", skills: ["React", "Three.js", "Systems Design"], is_active: true },
  { id: "2", display_name: "Sarah Chen", tier: 2, level: 18, xp: 1760, class: "Strategist", skills: ["Product", "UX Research", "Figma"], is_active: true },
  { id: "3", display_name: "Marcus Rivera", tier: 3, level: 14, xp: 1350, class: "Paladin", skills: ["Node.js", "PostgreSQL", "DevOps"], is_active: true },
  { id: "4", display_name: "Aisha Patel", tier: 4, level: 9, xp: 870, class: "Ranger", skills: ["Python", "Data Science", "ML"], is_active: true },
  { id: "5", display_name: "Jordan Hayes", tier: 4, level: 7, xp: 680, class: "Mage", skills: ["React", "TypeScript", "CSS"], is_active: true },
  { id: "6", display_name: "Lily Nakamura", tier: 5, level: 3, xp: 250, class: "Scout", skills: ["UI Design", "Figma"], is_active: true },
  { id: "7", display_name: "Kai Thompson", tier: 4, level: 11, xp: 1080, class: "Artificer", skills: ["Rust", "WebAssembly", "Systems"], is_active: true },
  { id: "8", display_name: "Elena Vasquez", tier: 3, level: 15, xp: 1490, class: "Healer", skills: ["Community", "Mentorship", "Writing"], is_active: false },
  { id: "9", display_name: "Ryan Okafor", tier: 5, level: 2, xp: 140, class: "Apprentice", skills: ["JavaScript", "HTML/CSS"], is_active: true },
];
