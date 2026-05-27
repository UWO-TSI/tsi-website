"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Settings, Save, Github, Linkedin, Instagram, Globe, MessageCircle, Check, Brain, ChevronRight } from "lucide-react";
import type { Profile, SocialLinks } from "@/lib/supabase/types";

export default function SettingsPage() {
  const [profile, setProfile] = useState<Partial<Profile> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState("");
  const [social, setSocial] = useState<SocialLinks>({});

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

  const inputStyle = {
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

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-sm" style={{ color: "var(--color-text-muted)" }}>Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: 24 }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255, 255, 255, 0.06)" }}>
              <Settings className="w-5 h-5" style={{ color: "var(--color-text-muted)" }} />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-main)" }}>Settings</h1>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 text-sm font-semibold rounded-lg transition-all"
            style={{ height: 36, padding: "0 16px", background: saved ? "#22c55e" : "#002fa7", color: "#f1ffff", opacity: saving ? 0.6 : 1 }}
          >
            {saved ? <><Check className="w-4 h-4" /> Saved</> : <><Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Changes"}</>}
          </button>
        </div>

        {/* Profile Section */}
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

        {/* Social Links Section */}
        <Section title="Social Links">
          <SocialField icon={Github} label="GitHub" value={social.github ?? ""} onChange={(v) => setSocial((s) => ({ ...s, github: v }))} placeholder="username" />
          <SocialField icon={Linkedin} label="LinkedIn" value={social.linkedin ?? ""} onChange={(v) => setSocial((s) => ({ ...s, linkedin: v }))} placeholder="profile URL or username" />
          <SocialField icon={Instagram} label="Instagram" value={social.instagram ?? ""} onChange={(v) => setSocial((s) => ({ ...s, instagram: v }))} placeholder="@handle" />
          <SocialField icon={MessageCircle} label="Discord" value={social.discord ?? ""} onChange={(v) => setSocial((s) => ({ ...s, discord: v }))} placeholder="username#1234" />
          <SocialField icon={Globe} label="Website" value={social.website ?? ""} onChange={(v) => setSocial((s) => ({ ...s, website: v }))} placeholder="https://..." />
        </Section>

        {/* NPC Memories */}
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

        {/* Account Info (read-only) */}
        <Section title="Account">
          <div className="grid grid-cols-2 gap-4">
            <ReadOnlyField label="Email" value={profile?.email ?? "—"} />
            <ReadOnlyField label="Tier" value={`T${profile?.tier ?? "?"}`} />
            <ReadOnlyField label="Position" value={profile?.position ?? "—"} />
            <ReadOnlyField label="Member Since" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"} />
          </div>
        </Section>
      </div>
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
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
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
