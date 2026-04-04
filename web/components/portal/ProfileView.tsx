"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Github, Linkedin, Globe, Twitter, Pencil, Loader2 } from "lucide-react";
import { TIER_COLORS, TIER_LABELS, getXpProgress } from "./types";
import type { Profile, PublicProfile, Tier, SocialLinks } from "@/lib/supabase/types";

const SOCIAL_ICONS: Record<string, typeof Github> = {
  github: Github, linkedin: Linkedin, website: Globe,
  twitter: Twitter, instagram: Globe, discord: Globe,
};

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

  // Editable fields
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editSkills, setEditSkills] = useState("");

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
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: editName,
          bio: editBio,
          skills: editSkills.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      setProfile(data.profile);
      setEditing(false);
    } catch {
      // TODO: show error toast
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center" style={{ minHeight: "60vh" }}>
        <Loader2 className="animate-spin" style={{ width: "24px", height: "24px", color: "var(--color-text-subtle)" }} />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ minHeight: "60vh", padding: "24px" }}>
        <p style={{ fontSize: "16px", color: "var(--color-text-muted)" }}>{error || "Profile not found"}</p>
        <button onClick={() => router.back()} className="mt-4 text-sm underline" style={{ color: "var(--color-text-subtle)" }}>Go back</button>
      </div>
    );
  }

  const p = profile;
  const tc = TIER_COLORS[p.tier];
  const xp = getXpProgress(p.xp, p.level);
  const coins = "tethos_coins" in p ? (p as Profile).tethos_coins : 0;
  const socialLinks: SocialLinks = p.social_links || {};
  const initials = p.display_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="mx-auto" style={{ maxWidth: "960px", padding: "24px" }}>
      {!isOwnProfile && (
        <button onClick={() => router.back()} className="flex items-center gap-2 mb-6 transition-colors"
          style={{ fontSize: "14px", color: "var(--color-text-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text-main)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-muted)")}>
          <ArrowLeft style={{ width: "16px", height: "16px" }} /> Back to Directory
        </button>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-5">
          <div className="shrink-0 rounded-full flex items-center justify-center"
            style={{ width: "96px", height: "96px", border: `4px solid ${tc.border}`, background: "var(--color-surface)", fontSize: "28px", fontWeight: 700, color: "var(--color-text-muted)" }}>
            {p.avatar_url ? <img src={p.avatar_url} alt={p.display_name} className="w-full h-full rounded-full object-cover" /> : initials}
          </div>
          <div>
            {editing ? (
              <input value={editName} onChange={(e) => setEditName(e.target.value)} className="outline-none mb-1"
                style={{ fontSize: "30px", fontWeight: 700, color: "var(--color-text-main)", background: "var(--color-surface)", border: "1px solid var(--glass-border-soft)", borderRadius: "8px", padding: "4px 8px" }} />
            ) : (
              <h1 style={{ fontSize: "30px", fontWeight: 700, color: "var(--color-text-main)", marginBottom: "2px" }}>{p.display_name}</h1>
            )}
            <p style={{ fontSize: "16px", color: "var(--color-text-muted)" }}>
              {p.class || "Unclassed"} {" · "} <span style={{ color: tc.color }}>Tier {p.tier} · {TIER_LABELS[p.tier]}</span>
              {"rank" in p && p.rank && <> {" · "} {p.rank}</>}
            </p>
            {editing ? (
              <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={2} className="outline-none mt-2 w-full resize-none"
                style={{ fontSize: "16px", color: "var(--color-text-soft)", background: "var(--color-surface)", border: "1px solid var(--glass-border-soft)", borderRadius: "8px", padding: "8px", maxWidth: "600px" }} />
            ) : (
              p.bio && <p className="mt-2" style={{ fontSize: "16px", color: "var(--color-text-soft)", maxWidth: "600px" }}>{p.bio}</p>
            )}
          </div>
        </div>
        {isOwnProfile && (
          <div className="flex gap-2 shrink-0">
            {editing ? (
              <>
                <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg text-sm transition-colors" style={{ border: "1px solid var(--gray-700)", color: "var(--color-text-muted)" }}>Cancel</button>
                <button onClick={handleSave} className="px-4 py-2 rounded-lg text-sm font-medium transition-colors" style={{ background: "var(--color-brand-blue)", color: "var(--color-brand-light)" }}>Save</button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors" style={{ background: "var(--color-brand-blue)", color: "var(--color-brand-light)" }}>
                <Pencil style={{ width: "14px", height: "14px" }} /> Edit Profile
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex gap-6 py-6" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
        <div>
          <p className="font-mono uppercase" style={{ fontSize: "12px", color: "var(--color-text-subtle)", letterSpacing: "0.05em", marginBottom: "4px" }}>Level</p>
          <p style={{ fontSize: "24px", fontWeight: 700, color: "var(--color-text-main)" }}>{p.level}</p>
        </div>
        <div>
          <p className="font-mono uppercase" style={{ fontSize: "12px", color: "var(--color-text-subtle)", letterSpacing: "0.05em", marginBottom: "4px" }}>XP</p>
          <p style={{ fontSize: "24px", fontWeight: 700, color: "var(--color-text-main)" }}>{p.xp.toLocaleString()}</p>
        </div>
        {isOwnProfile && (
          <div>
            <p className="font-mono uppercase" style={{ fontSize: "12px", color: "var(--color-text-subtle)", letterSpacing: "0.05em", marginBottom: "4px" }}>Coins</p>
            <p style={{ fontSize: "24px", fontWeight: 700, color: "#ffd166" }}>{coins.toLocaleString()}</p>
          </div>
        )}
      </div>

      {/* XP Bar */}
      <div className="mb-6">
        <div className="w-full overflow-hidden rounded" style={{ height: "8px", background: "var(--gray-800)" }}>
          <div className="h-full rounded" style={{ width: `${xp.percent}%`, background: "var(--color-brand-blue)", transition: "width 0.3s ease" }} />
        </div>
        <p className="text-right mt-1" style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
          {xp.current.toLocaleString()} / {xp.needed.toLocaleString()} XP to Level {p.level + 1}
        </p>
      </div>

      {/* Skills */}
      <div className="py-4" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
        <h3 className="font-mono uppercase mb-3" style={{ fontSize: "12px", color: "var(--color-text-subtle)", letterSpacing: "0.05em" }}>Skills</h3>
        {editing ? (
          <input value={editSkills} onChange={(e) => setEditSkills(e.target.value)} placeholder="Comma-separated skills..." className="w-full outline-none"
            style={{ fontSize: "14px", color: "var(--color-text-main)", background: "var(--color-surface)", border: "1px solid var(--glass-border-soft)", borderRadius: "8px", padding: "8px 12px" }} />
        ) : (
          <div className="flex flex-wrap gap-2">
            {(p.skills || []).map((skill) => (
              <span key={skill} style={{ height: "28px", lineHeight: "28px", padding: "0 12px", fontSize: "14px", color: "var(--color-text-soft)", background: "rgba(0, 47, 167, 0.1)", border: "1px solid rgba(0, 47, 167, 0.2)", borderRadius: "9999px" }}>{skill}</span>
            ))}
            {(!p.skills || p.skills.length === 0) && <span style={{ fontSize: "14px", color: "var(--color-text-subtle)" }}>No skills listed</span>}
          </div>
        )}
      </div>

      {/* Social Links */}
      {Object.keys(socialLinks).length > 0 && (
        <div className="py-4" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
          <h3 className="font-mono uppercase mb-3" style={{ fontSize: "12px", color: "var(--color-text-subtle)", letterSpacing: "0.05em" }}>Social Links</h3>
          <div className="flex gap-3 flex-wrap">
            {Object.entries(socialLinks).filter(([, url]) => url).map(([key, url]) => {
              const Icon = SOCIAL_ICONS[key] || Globe;
              return (
                <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 capitalize transition-colors"
                  style={{ fontSize: "14px", color: "var(--color-text-muted)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-accent-cyan)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-muted)")}>
                  <Icon style={{ width: "20px", height: "20px" }} /> {key}
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* About */}
      <div className="py-4" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
        <h3 className="font-mono uppercase mb-3" style={{ fontSize: "12px", color: "var(--color-text-subtle)", letterSpacing: "0.05em" }}>About</h3>
        <p style={{ fontSize: "16px", color: "var(--color-text-soft)" }}>
          Joined {new Date(p.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
        </p>
      </div>
    </div>
  );
}
