"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Settings,
  Save,
  Github,
  Linkedin,
  Instagram,
  Globe,
  MessageCircle,
  Check,
  Brain,
  ChevronRight,
  Users,
  User,
  Link as LinkIcon,
  Palette,
  Shield,
  LogOut,
} from "lucide-react";
import type { Profile, SocialLinks } from "@/lib/supabase/types";
import { TIER_LABELS } from "@/lib/supabase/types";
import { TIER_COLORS } from "@/components/portal/types";
import { createClient } from "@/lib/supabase/client";
import { useGhostReplaySetting } from "@/lib/game/useGhostReplaySetting";

type TabKey = "profile" | "social" | "appearance" | "account";

const TABS: { key: TabKey; label: string; icon: typeof User }[] = [
  { key: "profile", label: "Profile", icon: User },
  { key: "social", label: "Social", icon: LinkIcon },
  { key: "appearance", label: "Appearance", icon: Palette },
  { key: "account", label: "Account", icon: Shield },
];

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Partial<Profile> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [signingOut, setSigningOut] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState("");
  const [social, setSocial] = useState<SocialLinks>({});
  const [ghostsEnabled, setGhostsEnabled] = useGhostReplaySetting();

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.ok ? r.json() : { profile: null })
      .then((d) => {
        const p = d.profile ?? d;
        setProfile(p);
        setDisplayName(p?.display_name ?? "");
        setBio(p?.bio ?? "");
        setSkills((p?.skills ?? []).join(", "));
        setSocial(p?.social_links ?? {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName,
          bio,
          skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
          social_links: social,
        }),
      });
      if (res.ok) setSaved(true);
    } catch { /* ignore */ }
    setSaving(false);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/student/login");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-sm" style={{ color: "var(--color-text-muted)" }}>Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: 24 }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255, 255, 255, 0.06)" }}>
            <Settings className="w-5 h-5" style={{ color: "var(--color-text-muted)" }} />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-main)" }}>Settings</h1>
        </div>

        {/* Tab Bar — horizontal scroll on narrow screens (spec §10) */}
        <div
          role="tablist"
          aria-label="Settings sections"
          className="flex mb-6 overflow-x-auto"
          style={{
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
            scrollbarWidth: "none",
          }}
        >
          {TABS.map(({ key, label, icon: Icon }) => {
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${key}`}
                id={`tab-${key}`}
                onClick={() => setActiveTab(key)}
                className="flex items-center gap-2 shrink-0 transition-colors"
                style={{
                  height: 40,
                  padding: "0 16px",
                  fontSize: 14,
                  fontWeight: 500,
                  color: isActive ? "var(--color-text-main)" : "var(--color-text-muted)",
                  borderBottom: isActive ? "2px solid var(--color-brand-blue)" : "2px solid transparent",
                  background: "transparent",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            );
          })}
        </div>

        {/* Tab Panels */}
        {activeTab === "profile" && (
          <TabPanel id="profile">
            <Section title="Profile">
              <Field label="Display Name">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                  style={inputStyle}
                />
              </Field>
              <Field label="Bio">
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  rows={3}
                  style={{ ...inputStyle, height: "auto", padding: 12, minHeight: 80 }}
                />
              </Field>
              <Field label="Skills (comma separated)">
                <input
                  type="text"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  placeholder="React, TypeScript, Figma..."
                  style={inputStyle}
                />
              </Field>
            </Section>
            <SaveBar saving={saving} saved={saved} onClick={handleSave} />
          </TabPanel>
        )}

        {activeTab === "social" && (
          <TabPanel id="social">
            <Section title="Social Links">
              <p className="text-sm mb-4" style={{ color: "var(--color-text-muted)" }}>
                Connect your social profiles. These appear on your public profile.
              </p>
              <SocialField icon={Github} label="GitHub" value={social.github ?? ""} onChange={(v) => setSocial((s) => ({ ...s, github: v }))} placeholder="username" />
              <SocialField icon={Linkedin} label="LinkedIn" value={social.linkedin ?? ""} onChange={(v) => setSocial((s) => ({ ...s, linkedin: v }))} placeholder="profile URL or username" />
              <SocialField icon={Instagram} label="Instagram" value={social.instagram ?? ""} onChange={(v) => setSocial((s) => ({ ...s, instagram: v }))} placeholder="@handle" />
              <SocialField icon={MessageCircle} label="Discord" value={social.discord ?? ""} onChange={(v) => setSocial((s) => ({ ...s, discord: v }))} placeholder="username#1234" />
              <SocialField icon={Globe} label="Website" value={social.website ?? ""} onChange={(v) => setSocial((s) => ({ ...s, website: v }))} placeholder="https://..." />
            </Section>
            <SaveBar saving={saving} saved={saved} onClick={handleSave} />
          </TabPanel>
        )}

        {activeTab === "appearance" && (
          <TabPanel id="appearance">
            <Section title="World">
              <div className="flex items-start gap-3">
                <Users className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--color-text-muted)" }} />
                <div className="flex-1">
                  <label className="flex items-center justify-between gap-3 cursor-pointer">
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--color-text-main)" }}>
                        Show ghost replays of past members
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--color-text-subtle)" }}>
                        Show faded outlines of members who were here recently. Turn off if it&apos;s distracting.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={ghostsEnabled}
                      onClick={() => setGhostsEnabled(!ghostsEnabled)}
                      className="relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border transition-colors"
                      style={{
                        background: ghostsEnabled ? "#002fa7" : "rgba(255,255,255,0.06)",
                        borderColor: "var(--glass-border-soft)",
                      }}
                    >
                      <span
                        className="inline-block h-4 w-4 mt-0.5 transform rounded-full bg-white transition-transform"
                        style={{ transform: ghostsEnabled ? "translateX(24px)" : "translateX(4px)" }}
                      />
                    </button>
                  </label>
                </div>
              </div>
            </Section>
            <p className="text-sm italic mt-2 mb-6" style={{ color: "var(--color-text-subtle)" }}>
              More appearance options coming soon.
            </p>
          </TabPanel>
        )}

        {activeTab === "account" && (
          <TabPanel id="account">
            <Section title="Account Info">
              <div className="grid grid-cols-2 gap-4">
                <ReadOnlyField label="Email" value={profile?.email ?? "—"} />
                <TierField tier={profile?.tier} />
                <ReadOnlyField label="Position" value={profile?.position ?? "—"} />
                <ReadOnlyField label="Member Since" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"} />
              </div>
            </Section>

            <Section title="NPC Memories">
              <Link
                href="/student/dashboard/settings/npc-memories"
                className="flex items-center justify-between gap-3 rounded-lg transition-all hover:bg-white/[0.02]"
                style={{ padding: "4px 6px", margin: "-4px -6px" }}
              >
                <div className="flex items-center gap-3">
                  <Brain className="w-4 h-4 shrink-0" style={{ color: "var(--color-text-muted)" }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--color-text-main)" }}>Manage NPC memories</p>
                    <p className="text-xs" style={{ color: "var(--color-text-subtle)" }}>
                      Wipe an NPC&apos;s memory of you. They&apos;ll greet you as a stranger.
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--color-text-subtle)" }} />
              </Link>
            </Section>

            {/* Danger Zone — spec §7.3 + §7.4 */}
            <div
              className="mb-8"
              style={{
                marginTop: 24,
                borderTop: "1px solid rgba(239, 68, 68, 0.2)",
                paddingTop: 16,
              }}
            >
              <h2
                className="font-mono uppercase tracking-wider mb-4"
                style={{ fontSize: 12, color: "var(--color-error, #ef4444)" }}
              >
                Danger Zone
              </h2>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex items-center gap-2 rounded-lg transition-colors"
                style={{
                  height: 40,
                  padding: "0 16px",
                  background: "transparent",
                  border: "1px solid var(--color-error, #ef4444)",
                  color: "var(--color-error, #ef4444)",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: signingOut ? "not-allowed" : "pointer",
                  opacity: signingOut ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!signingOut) e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <LogOut className="w-4 h-4" />
                {signingOut ? "Signing out..." : "Sign Out"}
              </button>
            </div>
          </TabPanel>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  height: 40,
  padding: "0 12px",
  background: "#111827",
  border: "1px solid var(--glass-border-soft)",
  borderRadius: 8,
  color: "var(--color-text-main)",
  fontSize: 14,
  width: "100%",
  outline: "none",
};

function TabPanel({ id, children }: { id: TabKey; children: React.ReactNode }) {
  return (
    <div role="tabpanel" id={`tabpanel-${id}`} aria-labelledby={`tab-${id}`}>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-mono uppercase tracking-wider mb-4" style={{ color: "var(--color-text-subtle)" }}>{title}</h2>
      <div className="rounded-2xl space-y-4" style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.06)", padding: 20 }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm mb-1.5" style={{ color: "var(--color-text-muted)" }}>{label}</label>
      {children}
    </div>
  );
}

function SocialField({ icon: Icon, label, value, onChange, placeholder }: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-4 h-4 shrink-0" style={{ color: "var(--color-text-muted)" }} />
      <div className="flex-1">
        <label className="sr-only">{label}</label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={label}
          className="w-full text-sm outline-none"
          style={{
            height: 36,
            padding: "0 10px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--glass-border-soft)",
            borderRadius: 6,
            color: "var(--color-text-main)",
          }}
        />
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs mb-1" style={{ color: "var(--color-text-subtle)" }}>{label}</p>
      <p className="text-sm font-medium" style={{ color: "var(--color-text-soft)" }}>{value}</p>
    </div>
  );
}

function TierField({ tier }: { tier: number | undefined }) {
  if (!tier || tier < 1 || tier > 5) {
    return <ReadOnlyField label="Tier" value="—" />;
  }
  const t = tier as 1 | 2 | 3 | 4 | 5;
  const color = TIER_COLORS[t].color;
  const label = TIER_LABELS[t];
  return (
    <div>
      <p className="text-xs mb-1" style={{ color: "var(--color-text-subtle)" }}>Tier</p>
      <p className="text-sm font-medium" style={{ color }}>{`T${t} · ${label}`}</p>
    </div>
  );
}

function SaveBar({ saving, saved, onClick }: { saving: boolean; saved: boolean; onClick: () => void }) {
  return (
    <div className="flex justify-end mb-8">
      <button
        onClick={onClick}
        disabled={saving}
        className="flex items-center gap-1.5 text-sm font-semibold rounded-lg transition-all"
        style={{ height: 40, padding: "0 20px", background: saved ? "#22c55e" : "#002fa7", color: "#f1ffff", opacity: saving ? 0.6 : 1 }}
      >
        {saved ? <><Check className="w-4 h-4" /> Saved</> : <><Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Changes"}</>}
      </button>
    </div>
  );
}
