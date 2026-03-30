"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase/types";
import { xpForLevel } from "@/lib/supabase/types";
import {
  User,
  Save,
  LogOut,
  Trophy,
  Palette,
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  Github,
  Linkedin,
  MessageCircle,
  Instagram,
  Music,
  Sparkles,
  PawPrint,
  Palmtree,
  Pencil,
  Check,
  X,
} from "lucide-react";

interface Achievement {
  id: string;
  achievement: {
    id: string;
    name: string;
    description: string;
    icon: string;
    xp_reward: number;
    coin_reward: number;
  };
  earned_at: string;
}

interface UserTheme {
  id: string;
  theme: {
    id: string;
    name: string;
    slug: string;
  };
}

type EditableField = keyof Pick<
  Profile,
  | "year"
  | "program"
  | "hometown"
  | "birthday"
  | "phone"
  | "preferred_email"
  | "uwo_email"
  | "gdrive_email"
  | "github_username"
  | "instagram"
  | "linkedin"
  | "discord_tag"
  | "favourite_music"
  | "dream_retirement"
  | "spirit_animal"
  | "fun_fact"
  | "bio"
>;

const FIELD_CONFIG: {
  key: EditableField;
  label: string;
  icon: React.ReactNode;
  section: string;
}[] = [
  { key: "year", label: "Year", icon: <GraduationCap size={14} />, section: "Academic" },
  { key: "program", label: "Program", icon: <GraduationCap size={14} />, section: "Academic" },
  { key: "hometown", label: "Hometown", icon: <MapPin size={14} />, section: "Academic" },
  { key: "birthday", label: "Birthday", icon: <Sparkles size={14} />, section: "Academic" },
  { key: "bio", label: "Bio", icon: <User size={14} />, section: "Academic" },
  { key: "phone", label: "Phone", icon: <Phone size={14} />, section: "Contact" },
  { key: "preferred_email", label: "Preferred Email", icon: <Mail size={14} />, section: "Contact" },
  { key: "uwo_email", label: "UWO Email", icon: <Mail size={14} />, section: "Contact" },
  { key: "gdrive_email", label: "Google Drive Email", icon: <Mail size={14} />, section: "Contact" },
  { key: "github_username", label: "GitHub", icon: <Github size={14} />, section: "Socials" },
  { key: "instagram", label: "Instagram", icon: <Instagram size={14} />, section: "Socials" },
  { key: "linkedin", label: "LinkedIn", icon: <Linkedin size={14} />, section: "Socials" },
  { key: "discord_tag", label: "Discord", icon: <MessageCircle size={14} />, section: "Socials" },
  { key: "favourite_music", label: "Favourite Music", icon: <Music size={14} />, section: "Fun" },
  { key: "dream_retirement", label: "Dream Retirement", icon: <Palmtree size={14} />, section: "Fun" },
  { key: "spirit_animal", label: "Spirit Animal", icon: <PawPrint size={14} />, section: "Fun" },
  { key: "fun_fact", label: "Fun Fact", icon: <Sparkles size={14} />, section: "Fun" },
];

function InlineEdit({
  value,
  onSave,
  label,
  icon,
}: {
  value: string | null;
  onSave: (val: string) => void;
  label: string;
  icon: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function handleSave() {
    onSave(draft);
    setEditing(false);
  }

  function handleCancel() {
    setDraft(value ?? "");
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-md hover:bg-white/[0.02] transition-colors group">
      <span className="text-[var(--color-text-muted)] shrink-0">{icon}</span>
      <span className="text-xs font-mono text-[var(--color-text-muted)] w-32 shrink-0">
        {label}
      </span>
      {editing ? (
        <div className="flex-1 flex items-center gap-2">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
            className="flex-1 bg-[var(--color-bg-main)] border border-[var(--color-brand-blue)]/30 rounded px-2 py-1 text-sm font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand-blue)]"
          />
          <button onClick={handleSave} className="text-[var(--color-brand-blue)] hover:text-[var(--color-accent-cyan)] transition-colors">
            <Check size={14} />
          </button>
          <button onClick={handleCancel} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="flex-1 flex items-center gap-2">
          <span className={`text-sm ${value ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text-muted)] italic"}`}>
            {value || "Not set"}
          </span>
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 text-[var(--color-text-muted)] hover:text-[var(--color-brand-blue)] transition-all"
          >
            <Pencil size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [themes, setThemes] = useState<UserTheme[]>([]);
  const [activeTheme, setActiveTheme] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: prof }, { data: achs }, { data: ths }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase
          .from("user_achievements")
          .select("id, earned_at, achievement:achievements(id, name, description, icon, xp_reward, coin_reward)")
          .eq("user_id", user.id)
          .order("earned_at", { ascending: false }),
        supabase
          .from("user_themes")
          .select("id, theme:themes(id, name, slug)")
          .eq("user_id", user.id),
      ]);

      if (prof) {
        setProfile(prof as Profile);
        setActiveTheme(prof.active_theme);
      }
      setAchievements((achs as unknown as Achievement[]) ?? []);
      setThemes((ths as unknown as UserTheme[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  function updateField(key: EditableField, value: string) {
    if (!profile) return;
    setProfile({ ...profile, [key]: value || null });
    setDirty(true);
  }

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    const supabase = createClient();

    const updates: Record<string, unknown> = {};
    for (const field of FIELD_CONFIG) {
      updates[field.key] = profile[field.key];
    }
    updates.active_theme = activeTheme;

    await supabase.from("profiles").update(updates).eq("id", profile.id);
    setSaving(false);
    setDirty(false);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/student/login";
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
          Loading profile...
        </p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="font-mono text-sm text-[var(--color-text-muted)]">
          Profile not found.
        </p>
      </div>
    );
  }

  const currentLevelXp = xpForLevel(profile.level);
  const nextLevelXp = xpForLevel(profile.level + 1);
  const xpProgress = ((profile.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

  const sections = [...new Set(FIELD_CONFIG.map((f) => f.section))];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Profile Card */}
      <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-full bg-[var(--color-brand-blue)]/10 border border-[var(--color-brand-blue)]/20 flex items-center justify-center shrink-0">
            <span className="text-2xl font-mono text-[var(--color-brand-blue)]">
              {profile.display_name?.[0]?.toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-heading font-bold text-[var(--color-text-primary)]">
              {profile.display_name}
            </h1>
            <div className="flex items-center gap-2 mt-1 text-xs font-mono">
              <span className="text-[var(--color-brand-blue)]">{profile.class}</span>
              {profile.subclass && (
                <>
                  <span className="text-[var(--color-text-muted)]">/</span>
                  <span className="text-[var(--color-accent-cyan)]">{profile.subclass}</span>
                </>
              )}
              <span className="text-[var(--color-text-muted)]">·</span>
              <span className="text-[var(--color-brand-yellow)]">
                LV{profile.level} {profile.rank}
              </span>
            </div>

            {/* XP Bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-[0.6rem] font-mono text-[var(--color-text-muted)] mb-1">
                <span>XP {profile.xp.toLocaleString()} / {nextLevelXp.toLocaleString()}</span>
                <span>{Math.round(xpProgress)}%</span>
              </div>
              <div className="h-2 bg-[var(--color-bg-main)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[var(--color-brand-blue)] to-[var(--color-accent-cyan)] rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, xpProgress))}%` }}
                />
              </div>
            </div>

            {/* TC Balance */}
            <div className="mt-2 flex items-center gap-1.5 text-sm font-mono">
              <span className="text-[var(--color-brand-yellow)]">{"\u20AE"}</span>
              <span className="text-[var(--color-text-primary)]">
                {profile.tethos_coins.toLocaleString()}
              </span>
              <span className="text-[var(--color-text-muted)] text-xs">TC</span>
            </div>
          </div>
        </div>
      </div>

      {/* Editable Fields */}
      {sections.map((section) => (
        <div
          key={section}
          className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-[var(--glass-border)]">
            <h2 className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
              // {section}
            </h2>
          </div>
          <div className="p-2">
            {FIELD_CONFIG.filter((f) => f.section === section).map((field) => (
              <InlineEdit
                key={field.key}
                value={profile[field.key] as string | null}
                label={field.label}
                icon={field.icon}
                onSave={(val) => updateField(field.key, val)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Active Theme */}
      <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--glass-border)]">
          <h2 className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
            <Palette size={14} />
            Active Theme
          </h2>
        </div>
        <div className="p-4">
          {themes.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] italic font-mono">
              No themes purchased yet. Visit the Marketplace to unlock themes.
            </p>
          ) : (
            <select
              value={activeTheme}
              onChange={(e) => {
                setActiveTheme(e.target.value);
                setDirty(true);
              }}
              className="w-full bg-[var(--color-bg-main)] border border-[var(--glass-border)] rounded-md px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand-blue)]"
            >
              <option value="default">Default</option>
              {themes.map((t) => (
                <option key={t.theme.slug} value={t.theme.slug}>
                  {t.theme.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Achievements */}
      <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--glass-border)]">
          <h2 className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
            <Trophy size={14} />
            Achievements ({achievements.length})
          </h2>
        </div>
        <div className="p-4">
          {achievements.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] italic font-mono">
              No achievements earned yet. Complete quests and bounties to earn badges.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {achievements.map((ach) => (
                <div
                  key={ach.id}
                  className="bg-[var(--color-bg-main)] border border-[var(--glass-border)] rounded-lg p-3 text-center hover:border-[var(--color-brand-yellow)]/30 transition-colors"
                >
                  <div className="text-2xl mb-1">{ach.achievement.icon}</div>
                  <p className="text-xs font-bold text-[var(--color-text-primary)]">
                    {ach.achievement.name}
                  </p>
                  <p className="text-[0.6rem] font-mono text-[var(--color-text-muted)] mt-0.5">
                    {ach.achievement.description}
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-1.5 text-[0.6rem] font-mono">
                    {ach.achievement.xp_reward > 0 && (
                      <span className="text-[var(--color-brand-blue)]">
                        +{ach.achievement.xp_reward} XP
                      </span>
                    )}
                    {ach.achievement.coin_reward > 0 && (
                      <span className="text-[var(--color-brand-yellow)]">
                        +{ach.achievement.coin_reward} {"\u20AE"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Account */}
      <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--glass-border)]">
          <h2 className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
            // Account
          </h2>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Mail size={14} className="text-[var(--color-text-muted)]" />
            <span className="text-sm text-[var(--color-text-secondary)] font-mono">
              {profile.email}
            </span>
            <span className="text-[0.6rem] text-[var(--color-text-muted)] font-mono uppercase">
              (cannot change)
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-md border border-red-500/20 text-red-400 text-sm font-mono hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </div>

      {/* Save Button */}
      {dirty && (
        <div className="sticky bottom-6">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-lg bg-[var(--color-brand-blue)] text-white font-mono text-sm font-bold flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}
