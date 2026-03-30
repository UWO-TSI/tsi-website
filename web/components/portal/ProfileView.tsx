"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Github, Linkedin, Globe, Twitter, Pencil } from "lucide-react";
import {
  TIER_COLORS,
  TIER_LABELS,
  getXpProgress,
  type Profile,
  type Tier,
} from "./types";

// Mock profile for development — replace with API fetch
const MOCK_PROFILE: Profile = {
  id: "1",
  display_name: "David Liu",
  email: "david@tethos.ca",
  bio: "Building the future of tech for social good. CS student at Western.",
  avatar_url: undefined,
  avatar_config: {},
  tier: 1 as Tier,
  level: 24,
  xp: 2380,
  coin_balance: 1250,
  class: "Architect",
  subclass: "Systems Designer",
  skills: ["React", "Three.js", "TypeScript", "Systems Design", "Node.js", "PostgreSQL"],
  social_links: {
    github: "https://github.com/davidliu",
    linkedin: "https://linkedin.com/in/davidliu",
    portfolio: "https://davidliu.dev",
  },
  year: 3,
  is_active: true,
  onboarding_completed: true,
  created_at: "2026-01-15T00:00:00Z",
};

const SOCIAL_ICONS: Record<string, typeof Github> = {
  github: Github,
  linkedin: Linkedin,
  portfolio: Globe,
  twitter: Twitter,
  website: Globe,
};

interface ProfileViewProps {
  profile?: Profile;
  isOwnProfile?: boolean;
}

export default function ProfileView({ profile, isOwnProfile }: ProfileViewProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const p = profile || MOCK_PROFILE;
  const tc = TIER_COLORS[p.tier];
  const xp = getXpProgress(p.xp);
  const initials = p.display_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Editable state
  const [editName, setEditName] = useState(p.display_name);
  const [editBio, setEditBio] = useState(p.bio || "");
  const [editSkills, setEditSkills] = useState(p.skills.join(", "));

  const handleSave = () => {
    // TODO: PATCH /api/profile when Backend is ready
    setEditing(false);
  };

  return (
    <div
      className="mx-auto"
      style={{ maxWidth: "960px", padding: "24px" }}
    >
      {/* Back link */}
      {!isOwnProfile && (
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 mb-6 transition-colors"
          style={{ fontSize: "14px", color: "var(--color-text-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-text-main)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-muted)")}
        >
          <ArrowLeft style={{ width: "16px", height: "16px" }} />
          Back to Directory
        </button>
      )}

      {/* Profile Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div
            className="shrink-0 rounded-full flex items-center justify-center"
            style={{
              width: "96px",
              height: "96px",
              border: `4px solid ${tc.border}`,
              background: "var(--color-surface)",
              fontSize: "28px",
              fontWeight: 700,
              color: "var(--color-text-muted)",
            }}
          >
            {p.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.avatar_url}
                alt={p.display_name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              initials
            )}
          </div>

          <div>
            {editing ? (
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="outline-none mb-1"
                style={{
                  fontSize: "30px",
                  fontWeight: 700,
                  color: "var(--color-text-main)",
                  background: "var(--color-surface)",
                  border: "1px solid var(--glass-border-soft)",
                  borderRadius: "8px",
                  padding: "4px 8px",
                }}
              />
            ) : (
              <h1
                style={{
                  fontSize: "30px",
                  fontWeight: 700,
                  color: "var(--color-text-main)",
                  marginBottom: "2px",
                }}
              >
                {p.display_name}
              </h1>
            )}

            <p style={{ fontSize: "16px", color: "var(--color-text-muted)" }}>
              {p.class || "Unclassed"}
              {" · "}
              <span style={{ color: tc.color }}>
                Tier {p.tier} · {TIER_LABELS[p.tier]}
              </span>
            </p>

            {editing ? (
              <textarea
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                rows={2}
                className="outline-none mt-2 w-full resize-none"
                style={{
                  fontSize: "16px",
                  color: "var(--color-text-soft)",
                  background: "var(--color-surface)",
                  border: "1px solid var(--glass-border-soft)",
                  borderRadius: "8px",
                  padding: "8px",
                  maxWidth: "600px",
                }}
              />
            ) : (
              p.bio && (
                <p
                  className="mt-2"
                  style={{
                    fontSize: "16px",
                    color: "var(--color-text-soft)",
                    maxWidth: "600px",
                  }}
                >
                  {p.bio}
                </p>
              )
            )}
          </div>
        </div>

        {/* Edit / Save buttons */}
        {isOwnProfile && (
          <div className="flex gap-2 shrink-0">
            {editing ? (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 rounded-lg text-sm transition-colors"
                  style={{
                    border: "1px solid var(--gray-700)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    background: "var(--color-brand-blue)",
                    color: "var(--color-brand-light)",
                  }}
                >
                  Save
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors"
                style={{
                  background: "var(--color-brand-blue)",
                  color: "var(--color-brand-light)",
                }}
              >
                <Pencil style={{ width: "14px", height: "14px" }} />
                Edit Profile
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stats Row */}
      <div
        className="flex gap-6 py-6"
        style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}
      >
        <div>
          <p
            className="font-mono uppercase"
            style={{
              fontSize: "12px",
              color: "var(--color-text-subtle)",
              letterSpacing: "0.05em",
              marginBottom: "4px",
            }}
          >
            Level
          </p>
          <p
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "var(--color-text-main)",
            }}
          >
            {p.level}
          </p>
        </div>
        <div>
          <p
            className="font-mono uppercase"
            style={{
              fontSize: "12px",
              color: "var(--color-text-subtle)",
              letterSpacing: "0.05em",
              marginBottom: "4px",
            }}
          >
            XP
          </p>
          <p
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "var(--color-text-main)",
            }}
          >
            {p.xp.toLocaleString()}
          </p>
        </div>
        <div>
          <p
            className="font-mono uppercase"
            style={{
              fontSize: "12px",
              color: "var(--color-text-subtle)",
              letterSpacing: "0.05em",
              marginBottom: "4px",
            }}
          >
            Coins
          </p>
          <p
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "#ffd166",
            }}
          >
            {p.coin_balance.toLocaleString()}
          </p>
        </div>
      </div>

      {/* XP Progress Bar */}
      <div className="mb-6">
        <div
          className="w-full overflow-hidden rounded"
          style={{ height: "8px", background: "var(--gray-800)" }}
        >
          <div
            className="h-full rounded"
            style={{
              width: `${xp.percent}%`,
              background: "var(--color-brand-blue)",
              transition: "width 0.3s ease",
            }}
          />
        </div>
        <p
          className="text-right mt-1"
          style={{
            fontSize: "12px",
            color: "var(--color-text-muted)",
          }}
        >
          {xp.current} / {xp.needed} XP to Level {xp.level + 1}
        </p>
      </div>

      {/* Skills Section */}
      <div
        className="py-4"
        style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}
      >
        <h3
          className="font-mono uppercase mb-3"
          style={{
            fontSize: "12px",
            color: "var(--color-text-subtle)",
            letterSpacing: "0.05em",
          }}
        >
          Skills
        </h3>
        {editing ? (
          <input
            value={editSkills}
            onChange={(e) => setEditSkills(e.target.value)}
            placeholder="Comma-separated skills..."
            className="w-full outline-none"
            style={{
              fontSize: "14px",
              color: "var(--color-text-main)",
              background: "var(--color-surface)",
              border: "1px solid var(--glass-border-soft)",
              borderRadius: "8px",
              padding: "8px 12px",
            }}
          />
        ) : (
          <div className="flex flex-wrap gap-2">
            {p.skills.map((skill) => (
              <span
                key={skill}
                style={{
                  height: "28px",
                  lineHeight: "28px",
                  padding: "0 12px",
                  fontSize: "14px",
                  color: "var(--color-text-soft)",
                  background: "rgba(0, 47, 167, 0.1)",
                  border: "1px solid rgba(0, 47, 167, 0.2)",
                  borderRadius: "9999px",
                }}
              >
                {skill}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Social Links Section */}
      {Object.keys(p.social_links).length > 0 && (
        <div
          className="py-4"
          style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}
        >
          <h3
            className="font-mono uppercase mb-3"
            style={{
              fontSize: "12px",
              color: "var(--color-text-subtle)",
              letterSpacing: "0.05em",
            }}
          >
            Social Links
          </h3>
          <div className="flex gap-3">
            {Object.entries(p.social_links).map(([key, url]) => {
              const Icon = SOCIAL_ICONS[key] || Globe;
              return (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 capitalize transition-colors"
                  style={{
                    fontSize: "14px",
                    color: "var(--color-text-muted)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "var(--color-accent-cyan)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "var(--color-text-muted)")
                  }
                >
                  <Icon style={{ width: "20px", height: "20px" }} />
                  {key}
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* About Section */}
      <div
        className="py-4"
        style={{ borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}
      >
        <h3
          className="font-mono uppercase mb-3"
          style={{
            fontSize: "12px",
            color: "var(--color-text-subtle)",
            letterSpacing: "0.05em",
          }}
        >
          About
        </h3>
        <p style={{ fontSize: "16px", color: "var(--color-text-soft)" }}>
          {p.year ? `${p.year}${p.year === 1 ? "st" : p.year === 2 ? "nd" : p.year === 3 ? "rd" : "th"} year student.` : ""}{" "}
          Joined {new Date(p.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
        </p>
      </div>
    </div>
  );
}
