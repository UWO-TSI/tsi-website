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
  User,
  Link as LinkIcon,
  TreePalm,
  Shield,
  LogOut,
} from "lucide-react";
import type { Profile, SocialLinks } from "@/lib/supabase/types";
import { TIER_LABELS } from "@/lib/supabase/types";
import { TIER_LOOK } from "@/components/portal/classIdentity";
import { createClient } from "@/lib/supabase/client";
import { useGhostReplaySetting } from "@/lib/game/useGhostReplaySetting";
import { useQuestsMuted } from "@/components/portal/QuestChecklist";
import { Badge, Banner, Button, Card, Field, Loading, Tabs, TextArea, Toggle } from "@/components/gui";

type TabKey = "profile" | "social" | "world" | "account";

const TABS: { key: TabKey; label: string; icon: typeof User }[] = [
  { key: "profile", label: "Profile", icon: User },
  { key: "social", label: "Social", icon: LinkIcon },
  { key: "world", label: "World", icon: TreePalm },
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
  const [questsMuted, setQuestsMuted] = useQuestsMuted();

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
      router.push("/student");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ minHeight: "60vh" }}>
        <Loading label="Loading your settings…" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: "24px 20px 48px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Banner title="Settings" icon={<Settings size={26} />} tone="sage">Your profile, your links, and how the world behaves for you.</Banner>

        {/* Tabs: they scroll sideways on narrow screens (spec §10) */}
        <Tabs
          label="Settings sections"
          value={activeTab}
          onChange={setActiveTab}
          tabs={TABS.map(({ key, label, icon: Icon }) => ({ id: key, label, icon: <Icon size={16} aria-hidden /> }))}
          className="mb-6"
        />

        {/* Tab Panels */}
        {activeTab === "profile" && (
          <TabPanel id="profile">
            <Section title="Profile">
              <Field label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your display name" />
              <TextArea label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell us about yourself…" rows={3} style={{ minHeight: 96 }} />
              <Field label="Skills" hint="Separate them with commas." value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="React, TypeScript, Figma…" />
            </Section>
            <SaveBar saving={saving} saved={saved} onClick={handleSave} />
          </TabPanel>
        )}

        {activeTab === "social" && (
          <TabPanel id="social">
            <Section title="Social links">
              <p className="text-sm" style={{ color: "var(--gui-ink-2)" }}>
                Connect your social profiles. They show on your public profile.
              </p>
              <SocialField icon={Github} label="GitHub" value={social.github ?? ""} onChange={(v) => setSocial((s) => ({ ...s, github: v }))} placeholder="username" />
              <SocialField icon={Linkedin} label="LinkedIn" value={social.linkedin ?? ""} onChange={(v) => setSocial((s) => ({ ...s, linkedin: v }))} placeholder="profile URL or username" />
              <SocialField icon={Instagram} label="Instagram" value={social.instagram ?? ""} onChange={(v) => setSocial((s) => ({ ...s, instagram: v }))} placeholder="@handle" />
              <SocialField icon={MessageCircle} label="Discord" value={social.discord ?? ""} onChange={(v) => setSocial((s) => ({ ...s, discord: v }))} placeholder="username#1234" />
              <SocialField icon={Globe} label="Website" value={social.website ?? ""} onChange={(v) => setSocial((s) => ({ ...s, website: v }))} placeholder="https://…" />
            </Section>
            <SaveBar saving={saving} saved={saved} onClick={handleSave} />
          </TabPanel>
        )}

        {activeTab === "world" && (
          <TabPanel id="world">
            <Section title="World">
              <Toggle
                checked={ghostsEnabled}
                onChange={setGhostsEnabled}
                hint="Faded outlines of members who were here recently. Turn them off if they’re distracting."
              >
                Show ghost replays of past members
              </Toggle>
              {/* R3-1: quest checklist mute (the widget's useQuestsMuted is the single source of truth) */}
              <Toggle
                checked={!questsMuted}
                onChange={(on) => setQuestsMuted(!on)}
                hint="A floating checklist that walks new members through the portal. Quests are signposts only, no rewards."
              >
                Show onboarding quests
              </Toggle>
            </Section>
          </TabPanel>
        )}

        {activeTab === "account" && (
          <TabPanel id="account">
            <Section title="Account">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ReadOnlyField label="Email" value={profile?.email ?? "Not set"} />
                <TierField tier={profile?.tier} />
                <ReadOnlyField label="Position" value={profile?.position ?? "Not set"} />
                <ReadOnlyField
                  label="Member since"
                  value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Toronto" }) : "Not set"}
                />
              </div>
            </Section>

            <Section title="NPC memories">
              <Link
                href="/student/dashboard/settings/npc-memories"
                className="flex items-center justify-between gap-3 rounded-2xl transition-colors hover:bg-[var(--gui-paper-warm)]"
                style={{ padding: "8px 10px", margin: "-8px -10px" }}
              >
                <div className="flex items-center gap-3">
                  <Brain aria-hidden className="w-5 h-5 shrink-0" style={{ color: "var(--gui-bark)" }} />
                  <div>
                    <p className="text-sm" style={{ color: "var(--gui-ink-strong)", fontWeight: 800 }}>Manage NPC memories</p>
                    <p className="text-sm" style={{ color: "var(--gui-muted)" }}>
                      Wipe an NPC&apos;s memory of you. They&apos;ll greet you as a stranger.
                    </p>
                  </div>
                </div>
                <ChevronRight aria-hidden className="w-5 h-5 shrink-0" style={{ color: "var(--gui-muted)" }} />
              </Link>
            </Section>

            {/* Danger Zone: spec §7.3 + §7.4 */}
            <div className="mb-8" style={{ marginTop: 24, borderTop: "2px dashed var(--gui-paper-edge)", paddingTop: 16 }}>
              <h2 className="mb-3" style={{ fontSize: 16, fontWeight: 800, color: "var(--gui-danger)" }}>
                Danger zone
              </h2>
              <Button size="sm" variant="danger" onClick={handleSignOut} disabled={signingOut}>
                <LogOut size={16} aria-hidden />
                {signingOut ? "Signing out…" : "Sign out"}
              </Button>
            </div>
          </TabPanel>
        )}
      </div>
    </div>
  );
}

function TabPanel({ id, children }: { id: TabKey; children: React.ReactNode }) {
  return (
    <div role="tabpanel" id={`tabpanel-${id}`} aria-label={TABS.find((t) => t.key === id)?.label}>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="mb-3" style={{ fontSize: 16, fontWeight: 800, color: "var(--gui-ink-strong)" }}>{title}</h2>
      <Card className="space-y-4" style={{ padding: 20 }}>
        {children}
      </Card>
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
    <div className="flex items-end gap-3">
      <Icon aria-hidden className="w-5 h-5 shrink-0" style={{ color: "var(--gui-bark)", marginBottom: 14 }} />
      <Field label={label} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-sm mb-1" style={{ color: "var(--gui-muted)", fontWeight: 700 }}>{label}</p>
      <p className="text-sm" style={{ color: "var(--gui-ink)", fontWeight: 800, overflowWrap: "anywhere" }}>{value}</p>
    </div>
  );
}

function TierField({ tier }: { tier: number | undefined }) {
  if (!tier || tier < 1 || tier > 5) {
    return <ReadOnlyField label="Tier" value="Not set" />;
  }
  const t = tier as 1 | 2 | 3 | 4 | 5;
  return (
    <div className="min-w-0">
      <p className="text-sm mb-1" style={{ color: "var(--gui-muted)", fontWeight: 700 }}>Tier</p>
      <Badge tone={TIER_LOOK[t].tone}>{`T${t} · ${TIER_LABELS[t]}`}</Badge>
    </div>
  );
}

function SaveBar({ saving, saved, onClick }: { saving: boolean; saved: boolean; onClick: () => void }) {
  return (
    <div className="flex justify-end mb-8">
      <Button size="sm" variant={saved ? "secondary" : "primary"} onClick={onClick} disabled={saving}>
        {saved ? <><Check size={16} aria-hidden /> Saved</> : <><Save size={16} aria-hidden /> {saving ? "Saving…" : "Save changes"}</>}
      </Button>
    </div>
  );
}
