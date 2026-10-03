"use client";

import { useState, useEffect, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Github, Linkedin, Globe, Twitter, Pencil, User } from "lucide-react";
import { TIER_LABELS, getXpProgress } from "./types";
import { CLASS_META, ClassBadge, TIER_LOOK } from "./classIdentity";
import { Amount } from "@/components/economy/Amount";
import { Badge, Button, Card, Empty, ErrorNote, Field, Loading, Progress, TextArea } from "@/components/gui";
import type { Profile, PublicProfile, SocialLinks } from "@/lib/supabase/types";
import { saveProfile } from "@/lib/portal/load";

const SOCIAL_ICONS: Record<string, typeof Github> = {
  github: Github, linkedin: Linkedin, website: Globe,
  twitter: Twitter, instagram: Globe, discord: Globe,
};

const SOCIAL_NAMES: Record<string, string> = {
  github: "GitHub", linkedin: "LinkedIn", website: "Website",
  twitter: "Twitter", instagram: "Instagram", discord: "Discord",
};

const section: CSSProperties = { borderTop: "2px dashed var(--gui-paper-edge)", padding: "18px 0" };
const sectionTitle: CSSProperties = { fontSize: "16px", fontWeight: 800, color: "var(--gui-ink-strong)", marginBottom: "12px" };

interface ProfileViewProps {
  profileId?: string;
  isOwnProfile?: boolean;
}

export default function ProfileView({ profileId, isOwnProfile }: ProfileViewProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Editable fields
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editSkills, setEditSkills] = useState("");
  const [editSocial, setEditSocial] = useState<SocialLinks>({});

  useEffect(() => {
    async function fetchProfile() {
      setLoading(true);
      try {
        const url = isOwnProfile ? "/api/profile" : `/api/profile/${profileId}`;
        const res = await fetch(url);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        const p = data.profile;
        setProfile(p);
        setEditName(p.display_name || "");
        setEditBio(p.bio || "");
        setEditSkills((p.skills || []).join(", "));
        setEditSocial(p.social_links || {});
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [profileId, isOwnProfile]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setSaveError(null);
    const r = await saveProfile({
      display_name: editName,
      bio: editBio,
      skills: editSkills.split(",").map((s) => s.trim()).filter(Boolean),
      social_links: editSocial,
    });
    setSaving(false);
    if (!r.ok) return setSaveError(r.error);
    setProfile(r.profile as unknown as Profile);
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center" style={{ minHeight: "60vh" }}>
        <Loading label={isOwnProfile ? "Opening your profile…" : "Opening their profile…"} />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex-1 overflow-y-auto" style={{ padding: "24px 20px 48px" }}>
        <div className="grid justify-items-center gap-4" style={{ maxWidth: "520px", margin: "10vh auto 0" }}>
          {error ? (
            <ErrorNote>This profile didn’t load. Check your connection and try again in a moment.</ErrorNote>
          ) : (
            <Empty icon={<User size={32} />} title="Profile not found">It may not exist any more, or it isn’t shared with you.</Empty>
          )}
          <Button size="sm" variant="quiet" onClick={() => router.back()}>
            <ArrowLeft size={16} aria-hidden /> Go back
          </Button>
        </div>
      </div>
    );
  }

  const p = profile;
  const tier = TIER_LOOK[p.tier];
  const xp = getXpProgress(p.xp, p.level);
  const coins = "tethos_coins" in p ? (p as Profile).tethos_coins : 0;
  const socialLinks: SocialLinks = p.social_links || {};
  const initials = p.display_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: "24px 20px 48px" }}>
      <div style={{ maxWidth: "880px", margin: "0 auto" }}>
        {!isOwnProfile && (
          <Button size="sm" variant="quiet" onClick={() => router.back()} className="mb-5">
            <ArrowLeft size={16} aria-hidden /> Back to the directory
          </Button>
        )}

        <Card as="section" style={{ padding: "24px 24px 8px" }}>
          {saveError && <ErrorNote className="mb-4">{saveError}</ErrorNote>}
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div className="flex items-start gap-5 flex-1 min-w-0">
              <div className="shrink-0 rounded-full flex items-center justify-center overflow-hidden"
                style={{ width: "96px", height: "96px", border: `4px solid ${tier.ring}`, background: "var(--gui-paper-deep)", fontSize: "30px", fontWeight: 800, color: "var(--gui-ink-2)", boxShadow: "var(--gui-shadow-sm)" }}>
                {p.avatar_url ? <img src={p.avatar_url} alt={p.display_name} className="w-full h-full rounded-full object-cover" /> : initials}
              </div>
              <div className="flex-1 min-w-0">
                {editing ? (
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} aria-label="Display name" className="w-full mb-2"
                    style={{ maxWidth: "440px", fontSize: "26px", fontWeight: 800, color: "var(--gui-ink-strong)", background: "var(--gui-paper-hi)", border: "2px solid var(--gui-paper-line)", borderRadius: "16px 14px 16px 15px", padding: "4px 12px" }} />
                ) : (
                  <h1 style={{ fontSize: "30px", fontWeight: 800, lineHeight: 1.15, color: "var(--gui-ink-strong)", marginBottom: "6px", overflowWrap: "anywhere" }}>{p.display_name}</h1>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2" style={{ fontSize: "15px", fontWeight: 700, color: "var(--gui-ink-2)" }}>
                  {/* Class flair per ux-classes.md §4.3: the family chip */}
                  {p.class && CLASS_META[p.class] ? (
                    <ClassBadge cls={p.class} iconSize={16} fontSize={15} />
                  ) : (
                    <span>{p.class || "Unclassed"}</span>
                  )}
                  <Badge tone={tier.tone}>Tier {p.tier} · {TIER_LABELS[p.tier]}</Badge>
                  {"rank" in p && p.rank && <span>{p.rank}</span>}
                </div>
                {editing ? (
                  <TextArea label="Bio" value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={3} className="mt-4" style={{ maxWidth: "600px", minHeight: "96px" }} />
                ) : (
                  p.bio && <p className="mt-3" style={{ fontSize: "16px", color: "var(--gui-ink)", maxWidth: "600px" }}>{p.bio}</p>
                )}
              </div>
            </div>
            {isOwnProfile && (
              <div className="flex gap-2 shrink-0">
                {editing ? (
                  <>
                    <Button size="sm" variant="quiet" onClick={() => { setEditing(false); setSaveError(null); }}>Cancel</Button>
                    <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => setEditing(true)}>
                    <Pencil size={16} aria-hidden /> Edit profile
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-x-10 gap-y-4" style={section}>
            <Stat label="Level">{p.level}</Stat>
            <Stat label="XP">{p.xp.toLocaleString()}</Stat>
            {isOwnProfile && <Stat label="Gems"><Amount n={coins} currency="gems" size={22} /></Stat>}
          </div>

          {/* XP toward the next level */}
          <div style={{ paddingBottom: "20px" }}>
            <Progress kind="xp" value={xp.current} max={xp.needed} label={`Level ${p.level}`} showLabel
              valueText={`${xp.current.toLocaleString()} / ${xp.needed.toLocaleString()} XP to level ${p.level + 1}`} />
          </div>

          {/* Skills */}
          <div style={section}>
            {editing ? (
              <Field label="Skills" hint="Separate them with commas." value={editSkills} onChange={(e) => setEditSkills(e.target.value)} placeholder="React, Figma, public speaking" />
            ) : (
              <>
                <h2 style={sectionTitle}>Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {(p.skills || []).map((skill) => <Badge key={skill} tone="sage">{skill}</Badge>)}
                  {(!p.skills || p.skills.length === 0) && <span style={{ fontSize: "15px", color: "var(--gui-muted)" }}>No skills listed yet.</span>}
                </div>
              </>
            )}
          </div>

          {/* Social Links: editable inline in edit mode per ux-directory.md §7.5 */}
          {editing ? (
            <div style={section}>
              <h2 style={sectionTitle}>Social links</h2>
              <div className="grid gap-3" style={{ maxWidth: "480px" }}>
                {(["github", "linkedin", "instagram", "discord", "website"] as const).map((key) => (
                  <Field
                    key={key}
                    label={SOCIAL_NAMES[key]}
                    value={editSocial[key] ?? ""}
                    onChange={(e) => setEditSocial((s) => ({ ...s, [key]: e.target.value }))}
                    placeholder={key === "website" ? "https://…" : "Username or link"}
                  />
                ))}
              </div>
            </div>
          ) : Object.keys(socialLinks).length > 0 && (
            <div style={section}>
              <h2 style={sectionTitle}>Social links</h2>
              <div className="flex gap-x-5 gap-y-2 flex-wrap">
                {Object.entries(socialLinks).filter(([, url]) => url).map(([key, url]) => {
                  const Icon = SOCIAL_ICONS[key] || Globe;
                  return (
                    <a key={key} href={url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 transition-colors text-[var(--gui-ink-2)] hover:text-[var(--gui-sage)] hover:underline"
                      style={{ fontSize: "15px", fontWeight: 800, minHeight: "32px" }}>
                      <Icon aria-hidden style={{ width: "20px", height: "20px" }} /> {SOCIAL_NAMES[key] ?? key}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* About */}
          <div style={section}>
            <h2 style={sectionTitle}>About</h2>
            <p style={{ fontSize: "16px", color: "var(--gui-ink)" }}>
              Joined {new Date(p.created_at).toLocaleDateString("en-CA", { month: "long", year: "numeric", timeZone: "America/Toronto" })}.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: "13px", fontWeight: 800, color: "var(--gui-muted)", marginBottom: "2px" }}>{label}</p>
      <p style={{ fontSize: "24px", fontWeight: 800, color: "var(--gui-ink-strong)", fontVariantNumeric: "tabular-nums" }}>{children}</p>
    </div>
  );
}
