import {
  Sword,
  Sparkles,
  Heart,
  Wrench,
  Crown,
  Shield,
  Zap,
  Brain,
  Compass,
  BookOpen,
  Eye,
  Feather,
  Sun,
  Flame,
  HeartHandshake,
  Home,
  Cog,
  Palette,
  Anchor,
  Mic,
  type LucideIcon,
} from "lucide-react";
import type { GuildClass } from "@/lib/guild";

// Icon picks mirror the Oracle Temple page so the two surfaces agree.
export const CLASS_ICONS: Record<GuildClass, LucideIcon> = {
  Warrior: Sword,
  Mage: Sparkles,
  Healer: Heart,
  Rogue: Wrench,
};

export const SUBCLASS_ICONS: Record<string, LucideIcon> = {
  "Tactical Commander": Crown,
  "Iron Marshal": Shield,
  "Vanguard Striker": Zap,
  "Battle Strategist": Brain,
  "Arcane Architect": Compass,
  "Lore Seeker": BookOpen,
  "Oracle Sage": Eye,
  "Dream Weaver": Feather,
  "Beacon Guide": Sun,
  "Spirit Catalyst": Flame,
  "Shield Warden": HeartHandshake,
  "Sanctuary Keeper": Home,
  "Shadow Tinker": Cog,
  "Wandering Artisan": Palette,
  "Silent Sentinel": Anchor,
  "Blaze Performer": Mic,
};
