"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search, Filter } from "lucide-react";

interface Member {
  id: string;
  display_name: string;
  position: string | null;
  class: string | null;
  subclass: string | null;
  level: number;
  rank: string;
  year: string | null;
  program: string | null;
  hometown: string | null;
  preferred_email: string | null;
  github_username: string | null;
  instagram: string | null;
  linkedin: string | null;
  discord_tag: string | null;
  favourite_music: string | null;
  dream_retirement: string | null;
  spirit_animal: string | null;
  fun_fact: string | null;
  avatar_url: string | null;
  is_alumni: boolean;
  team: { name: string; side: string; portfolio: string | null } | null;
}

export default function DirectoryPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "current" | "alumni">("current");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMembers() {
      const supabase = createClient();
      let query = supabase
        .from("profiles")
        .select(
          "id, display_name, position, class, subclass, level, rank, year, program, hometown, preferred_email, github_username, instagram, linkedin, discord_tag, favourite_music, dream_retirement, spirit_animal, fun_fact, avatar_url, is_alumni, team:teams(name, side, portfolio)"
        )
        .eq("is_active", true)
        .order("display_name");

      if (filter === "current") {
        query = query.eq("is_alumni", false);
      } else if (filter === "alumni") {
        query = query.eq("is_alumni", true);
      }

      const { data } = await query;
      setMembers((data as unknown as Member[]) ?? []);
      setLoading(false);
    }
    fetchMembers();
  }, [filter]);

  const filtered = members.filter(
    (m) =>
      m.display_name.toLowerCase().includes(search.toLowerCase()) ||
      m.position?.toLowerCase().includes(search.toLowerCase()) ||
      m.program?.toLowerCase().includes(search.toLowerCase())
  );

  const positionLabels: Record<string, string> = {
    president: "President",
    senior_advisor: "Senior Advisor",
    pmo: "PM Officer",
    pm: "Project Manager",
    vp: "Vice President",
    developer: "Developer",
    director: "Director",
    general: "General Member",
    volunteer: "Volunteer",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
            Member Directory
          </h1>
          <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
            {filtered.length} agents in the system
          </p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md pl-9 pr-4 py-2.5 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-blue)] transition-all"
            placeholder="Search by name, position, or program..."
          />
        </div>

        <div className="flex items-center gap-1 bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md p-1">
          {(["current", "alumni", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-xs font-mono transition-all ${
                filter === f
                  ? "bg-[var(--color-brand-blue)]/10 text-[var(--color-brand-blue)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Member Grid */}
      {loading ? (
        <div className="text-center py-12">
          <p className="font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
            Loading agents...
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((member) => (
            <button
              key={member.id}
              onClick={() => setSelectedMember(member)}
              className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-4 text-left hover:border-[var(--color-brand-blue)]/30 hover:shadow-[0_0_12px_rgba(0,47,167,0.1)] transition-all group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-[var(--color-brand-blue)]/10 border border-[var(--color-brand-blue)]/20 flex items-center justify-center shrink-0">
                  <span className="text-sm font-mono text-[var(--color-brand-blue)]">
                    {member.display_name?.[0]?.toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--color-text-primary)] truncate">
                    {member.display_name}
                  </p>
                  <p className="text-[0.65rem] font-mono text-[var(--color-text-muted)]">
                    {positionLabels[member.position ?? ""] ?? member.position}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[0.6rem] font-mono">
                <span className="text-[var(--color-brand-blue)]">
                  {member.class}
                </span>
                <span className="text-[var(--color-text-muted)]">·</span>
                <span className="text-[var(--color-text-muted)]">
                  LV{member.level}
                </span>
                {member.is_alumni && (
                  <>
                    <span className="text-[var(--color-text-muted)]">·</span>
                    <span className="text-[var(--color-brand-yellow)]">
                      ALUMNI
                    </span>
                  </>
                )}
              </div>

              {member.program && (
                <p className="text-xs text-[var(--color-text-muted)] mt-2 truncate">
                  {member.program}
                  {member.year ? ` · ${member.year}` : ""}
                </p>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Member Detail Modal */}
      {selectedMember && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedMember(null)}
        >
          <div
            className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg w-full max-w-md max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-[var(--glass-border)]">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[var(--color-brand-blue)]/10 border border-[var(--color-brand-blue)]/20 flex items-center justify-center">
                  <span className="text-xl font-mono text-[var(--color-brand-blue)]">
                    {selectedMember.display_name?.[0]?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="text-lg font-heading font-bold text-[var(--color-text-primary)]">
                    {selectedMember.display_name}
                  </h2>
                  <p className="text-sm font-mono text-[var(--color-text-muted)]">
                    {positionLabels[selectedMember.position ?? ""] ??
                      selectedMember.position}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs font-mono">
                    <span className="text-[var(--color-brand-blue)]">
                      {selectedMember.class}
                    </span>
                    {selectedMember.subclass && (
                      <>
                        <span className="text-[var(--color-text-muted)]">
                          /
                        </span>
                        <span className="text-[var(--color-accent-cyan)]">
                          {selectedMember.subclass}
                        </span>
                      </>
                    )}
                    <span className="text-[var(--color-text-muted)]">·</span>
                    <span className="text-[var(--color-brand-yellow)]">
                      LV{selectedMember.level} {selectedMember.rank}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
              {/* Academic */}
              <div>
                <h3 className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                  Academic
                </h3>
                <div className="space-y-1 text-sm">
                  {selectedMember.program && (
                    <p className="text-[var(--color-text-secondary)]">
                      {selectedMember.program}
                      {selectedMember.year ? ` · ${selectedMember.year}` : ""}
                    </p>
                  )}
                  {selectedMember.hometown && (
                    <p className="text-[var(--color-text-muted)]">
                      From: {selectedMember.hometown}
                    </p>
                  )}
                </div>
              </div>

              {/* Socials */}
              <div>
                <h3 className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                  Connect
                </h3>
                <div className="space-y-1 text-sm font-mono">
                  {selectedMember.preferred_email && (
                    <p className="text-[var(--color-text-secondary)]">
                      📧 {selectedMember.preferred_email}
                    </p>
                  )}
                  {selectedMember.github_username && (
                    <p className="text-[var(--color-text-secondary)]">
                      🐙 {selectedMember.github_username}
                    </p>
                  )}
                  {selectedMember.discord_tag && (
                    <p className="text-[var(--color-text-secondary)]">
                      💬 {selectedMember.discord_tag}
                    </p>
                  )}
                  {selectedMember.linkedin && (
                    <p className="text-[var(--color-text-secondary)]">
                      💼 {selectedMember.linkedin}
                    </p>
                  )}
                  {selectedMember.instagram && (
                    <p className="text-[var(--color-text-secondary)]">
                      📷 {selectedMember.instagram}
                    </p>
                  )}
                </div>
              </div>

              {/* Fun */}
              {(selectedMember.spirit_animal ||
                selectedMember.favourite_music ||
                selectedMember.dream_retirement ||
                selectedMember.fun_fact) && (
                <div>
                  <h3 className="text-[0.65rem] font-mono text-[var(--color-brand-yellow)] uppercase tracking-wider mb-2">
                    // Personal
                  </h3>
                  <div className="space-y-1 text-sm">
                    {selectedMember.spirit_animal && (
                      <p className="text-[var(--color-text-secondary)]">
                        Spirit Animal: {selectedMember.spirit_animal}
                      </p>
                    )}
                    {selectedMember.favourite_music && (
                      <p className="text-[var(--color-text-secondary)]">
                        Music: {selectedMember.favourite_music}
                      </p>
                    )}
                    {selectedMember.dream_retirement && (
                      <p className="text-[var(--color-text-secondary)]">
                        Retiring to: {selectedMember.dream_retirement}
                      </p>
                    )}
                    {selectedMember.fun_fact && (
                      <p className="text-[var(--color-text-muted)] italic">
                        &ldquo;{selectedMember.fun_fact}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Close */}
            <div className="p-4 border-t border-[var(--glass-border)]">
              <button
                onClick={() => setSelectedMember(null)}
                className="w-full py-2 text-sm font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
