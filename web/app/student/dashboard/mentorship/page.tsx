"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Users,
  Search,
  UserPlus,
  Shield,
  Clock,
  Check,
  X,
  ChevronRight,
  Sparkles,
  Minus,
  Plus,
} from "lucide-react";

interface MentorProfile {
  id: string;
  user_id: string;
  is_mentor: boolean;
  skills: string[];
  availability: string;
  max_mentees: number;
  bio: string | null;
  profile: {
    display_name: string;
    class: string | null;
    level: number;
    rank: string;
  };
  mentee_count?: number;
}

interface MentorshipMatch {
  id: string;
  mentor_id: string;
  mentee_id: string;
  status: "pending" | "active" | "completed" | "rejected";
  created_at: string;
  mentor_profile?: {
    display_name: string;
    class: string | null;
    level: number;
    rank: string;
  };
  mentee_profile?: {
    display_name: string;
    class: string | null;
    level: number;
    rank: string;
  };
}

export default function MentorshipPage() {
  const [tab, setTab] = useState<"find" | "my">("find");
  const [mentors, setMentors] = useState<MentorProfile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");

  // My Mentorship state
  const [myMentorProfile, setMyMentorProfile] = useState<MentorProfile | null>(null);
  const [myMentor, setMyMentor] = useState<MentorshipMatch | null>(null);
  const [myMentees, setMyMentees] = useState<MentorshipMatch[]>([]);
  const [pendingRequests, setPendingRequests] = useState<MentorshipMatch[]>([]);
  const [requestsSent, setRequestsSent] = useState<string[]>([]);

  // Become a Mentor form
  const [showMentorForm, setShowMentorForm] = useState(false);
  const [mentorSkills, setMentorSkills] = useState("");
  const [mentorAvailability, setMentorAvailability] = useState("weekly");
  const [mentorMaxMentees, setMentorMaxMentees] = useState(3);
  const [mentorBio, setMentorBio] = useState("");
  const [savingMentor, setSavingMentor] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    // Fetch mentors
    const { data: mentorProfiles } = await supabase
      .from("mentorship_profiles")
      .select("*, profile:profiles(display_name, class, level, rank)")
      .eq("is_mentor", true);

    // Get mentee counts for each mentor
    if (mentorProfiles) {
      const enriched = await Promise.all(
        (mentorProfiles as unknown as MentorProfile[]).map(async (m) => {
          const { count } = await supabase
            .from("mentorship_matches")
            .select("*", { count: "exact", head: true })
            .eq("mentor_id", m.user_id)
            .eq("status", "active");
          return { ...m, mentee_count: count ?? 0 };
        })
      );
      setMentors(enriched.filter((m) => m.user_id !== user.id));
    }

    // Fetch my mentor profile
    const { data: myMP } = await supabase
      .from("mentorship_profiles")
      .select("*, profile:profiles(display_name, class, level, rank)")
      .eq("user_id", user.id)
      .single();

    if (myMP) {
      setMyMentorProfile(myMP as unknown as MentorProfile);
      if (myMP.is_mentor) {
        setMentorSkills((myMP.skills as string[])?.join(", ") ?? "");
        setMentorAvailability(myMP.availability ?? "weekly");
        setMentorMaxMentees(myMP.max_mentees ?? 3);
        setMentorBio(myMP.bio ?? "");
      }
    }

    // Fetch my mentor (where I'm the mentee)
    const { data: mentorMatch } = await supabase
      .from("mentorship_matches")
      .select("*, mentor_profile:profiles!mentorship_matches_mentor_id_fkey(display_name, class, level, rank)")
      .eq("mentee_id", user.id)
      .in("status", ["active", "pending"])
      .limit(1)
      .maybeSingle();

    if (mentorMatch) {
      setMyMentor(mentorMatch as unknown as MentorshipMatch);
    }

    // If I'm a mentor, fetch my mentees
    if (myMP?.is_mentor) {
      const { data: menteeMatches } = await supabase
        .from("mentorship_matches")
        .select("*, mentee_profile:profiles!mentorship_matches_mentee_id_fkey(display_name, class, level, rank)")
        .eq("mentor_id", user.id)
        .eq("status", "active");

      setMyMentees((menteeMatches as unknown as MentorshipMatch[]) ?? []);

      const { data: pending } = await supabase
        .from("mentorship_matches")
        .select("*, mentee_profile:profiles!mentorship_matches_mentee_id_fkey(display_name, class, level, rank)")
        .eq("mentor_id", user.id)
        .eq("status", "pending");

      setPendingRequests((pending as unknown as MentorshipMatch[]) ?? []);
    }

    // Track which mentors the user already sent requests to
    const { data: sentRequests } = await supabase
      .from("mentorship_matches")
      .select("mentor_id")
      .eq("mentee_id", user.id)
      .in("status", ["pending", "active"]);

    setRequestsSent((sentRequests ?? []).map((r) => r.mentor_id));

    setLoading(false);
  }

  async function requestMentorship(mentorUserId: string) {
    const supabase = createClient();
    await supabase.from("mentorship_matches").insert({
      mentor_id: mentorUserId,
      mentee_id: userId,
      status: "pending",
    });
    setRequestsSent([...requestsSent, mentorUserId]);
  }

  async function handleRequest(matchId: string, accept: boolean) {
    const supabase = createClient();
    await supabase
      .from("mentorship_matches")
      .update({ status: accept ? "active" : "rejected" })
      .eq("id", matchId);

    setPendingRequests(pendingRequests.filter((r) => r.id !== matchId));
    if (accept) {
      const accepted = pendingRequests.find((r) => r.id === matchId);
      if (accepted) setMyMentees([...myMentees, { ...accepted, status: "active" }]);
    }
  }

  async function toggleMentor() {
    if (myMentorProfile?.is_mentor) {
      // Disable mentorship
      const supabase = createClient();
      await supabase
        .from("mentorship_profiles")
        .update({ is_mentor: false })
        .eq("user_id", userId);
      setMyMentorProfile({ ...myMentorProfile, is_mentor: false });
    } else {
      setShowMentorForm(true);
    }
  }

  async function saveMentorProfile() {
    setSavingMentor(true);
    const supabase = createClient();
    const skills = mentorSkills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      user_id: userId,
      is_mentor: true,
      skills,
      availability: mentorAvailability,
      max_mentees: mentorMaxMentees,
      bio: mentorBio.trim() || null,
    };

    if (myMentorProfile) {
      await supabase
        .from("mentorship_profiles")
        .update(payload)
        .eq("user_id", userId);
      setMyMentorProfile({ ...myMentorProfile, ...payload });
    } else {
      const { data } = await supabase
        .from("mentorship_profiles")
        .insert(payload)
        .select("*, profile:profiles(display_name, class, level, rank)")
        .single();
      if (data) setMyMentorProfile(data as unknown as MentorProfile);
    }

    setShowMentorForm(false);
    setSavingMentor(false);
  }

  const filteredMentors = mentors.filter(
    (m) =>
      m.profile.display_name.toLowerCase().includes(search.toLowerCase()) ||
      m.skills.some((s) => s.toLowerCase().includes(search.toLowerCase())) ||
      m.profile.class?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
          Loading mentorship data...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
          Mentorship
        </h1>
        <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
          Learn from experienced members or guide the next generation
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md p-1 w-fit">
        <button
          onClick={() => setTab("find")}
          className={`px-4 py-2 rounded text-sm font-mono transition-all ${
            tab === "find"
              ? "bg-[var(--color-brand-blue)]/10 text-[var(--color-brand-blue)]"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          Find a Mentor
        </button>
        <button
          onClick={() => setTab("my")}
          className={`px-4 py-2 rounded text-sm font-mono transition-all ${
            tab === "my"
              ? "bg-[var(--color-brand-blue)]/10 text-[var(--color-brand-blue)]"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          My Mentorship
        </button>
      </div>

      {/* Find a Mentor Tab */}
      {tab === "find" && (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md pl-9 pr-4 py-2.5 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-blue)] transition-all"
              placeholder="Search by name, skill, or class..."
            />
          </div>

          {/* Mentor Grid */}
          {filteredMentors.length === 0 ? (
            <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-8 text-center">
              <Users size={32} className="text-[var(--color-text-muted)] mx-auto mb-3" />
              <p className="text-sm text-[var(--color-text-muted)] font-mono">
                No mentors found. Check back later or become one yourself.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredMentors.map((mentor) => {
                const isFull = (mentor.mentee_count ?? 0) >= mentor.max_mentees;
                const alreadyRequested = requestsSent.includes(mentor.user_id);

                return (
                  <div
                    key={mentor.id}
                    className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-4 hover:border-[var(--color-brand-blue)]/20 transition-all"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-[var(--color-brand-blue)]/10 border border-[var(--color-brand-blue)]/20 flex items-center justify-center shrink-0">
                        <span className="text-sm font-mono text-[var(--color-brand-blue)]">
                          {mentor.profile.display_name?.[0]?.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                          {mentor.profile.display_name}
                        </h3>
                        <div className="flex items-center gap-2 text-[0.6rem] font-mono">
                          <span className="text-[var(--color-brand-blue)]">
                            {mentor.profile.class}
                          </span>
                          <span className="text-[var(--color-text-muted)]">·</span>
                          <span className="text-[var(--color-brand-yellow)]">
                            LV{mentor.profile.level} {mentor.profile.rank}
                          </span>
                        </div>
                      </div>
                      <div
                        className={`px-2 py-0.5 rounded text-[0.6rem] font-mono ${
                          isFull
                            ? "bg-red-500/10 text-red-400"
                            : "bg-green-500/10 text-green-400"
                        }`}
                      >
                        {isFull ? "Full" : "Open"}
                      </div>
                    </div>

                    {/* Skills */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {mentor.skills.map((skill) => (
                        <span
                          key={skill}
                          className="text-[0.6rem] font-mono px-1.5 py-0.5 rounded bg-[var(--color-accent-cyan)]/10 text-[var(--color-accent-cyan)] border border-[var(--color-accent-cyan)]/20"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>

                    {/* Meta */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-[0.6rem] font-mono text-[var(--color-text-muted)]">
                        <span className="flex items-center gap-1">
                          <Users size={10} />
                          {mentor.mentee_count}/{mentor.max_mentees} mentees
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {mentor.availability}
                        </span>
                      </div>
                      <button
                        onClick={() => requestMentorship(mentor.user_id)}
                        disabled={isFull || alreadyRequested}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-bold transition-all ${
                          alreadyRequested
                            ? "border border-[var(--color-brand-yellow)]/30 text-[var(--color-brand-yellow)] bg-[var(--color-brand-yellow)]/10"
                            : isFull
                            ? "border border-[var(--glass-border)] text-[var(--color-text-muted)] opacity-50 cursor-not-allowed"
                            : "bg-[var(--color-brand-blue)] text-white hover:brightness-110"
                        }`}
                      >
                        {alreadyRequested ? (
                          <>
                            <Clock size={12} />
                            Requested
                          </>
                        ) : (
                          <>
                            <UserPlus size={12} />
                            Request
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* My Mentorship Tab */}
      {tab === "my" && (
        <div className="space-y-6">
          {/* My Mentor */}
          <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--glass-border)]">
              <h2 className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                // My Mentor
              </h2>
            </div>
            <div className="p-4">
              {myMentor ? (
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[var(--color-brand-blue)]/10 border border-[var(--color-brand-blue)]/20 flex items-center justify-center">
                    <span className="text-lg font-mono text-[var(--color-brand-blue)]">
                      {myMentor.mentor_profile?.display_name?.[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                      {myMentor.mentor_profile?.display_name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-[var(--color-brand-blue)]">
                        {myMentor.mentor_profile?.class}
                      </span>
                      <span className="text-[var(--color-text-muted)]">·</span>
                      <span className="text-[var(--color-brand-yellow)]">
                        LV{myMentor.mentor_profile?.level} {myMentor.mentor_profile?.rank}
                      </span>
                    </div>
                    <span
                      className={`text-[0.6rem] font-mono mt-1 inline-block px-2 py-0.5 rounded ${
                        myMentor.status === "active"
                          ? "bg-green-500/10 text-green-400"
                          : "bg-yellow-500/10 text-yellow-400"
                      }`}
                    >
                      {myMentor.status === "active" ? "Active" : "Pending"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)] italic font-mono">
                  You don&apos;t have a mentor yet. Browse the &quot;Find a Mentor&quot; tab to request one.
                </p>
              )}
            </div>
          </div>

          {/* Become a Mentor / Mentor Settings */}
          <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--glass-border)] flex items-center justify-between">
              <h2 className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
                <Shield size={14} />
                Mentor Mode
              </h2>
              <button
                onClick={toggleMentor}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  myMentorProfile?.is_mentor
                    ? "bg-[var(--color-brand-blue)]"
                    : "bg-[var(--color-bg-main)] border border-[var(--glass-border)]"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    myMentorProfile?.is_mentor ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {(showMentorForm || myMentorProfile?.is_mentor) && (
              <div className="p-4 space-y-4">
                <div>
                  <label className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                    Skills (comma-separated)
                  </label>
                  <input
                    value={mentorSkills}
                    onChange={(e) => setMentorSkills(e.target.value)}
                    className="mt-1 w-full bg-[var(--color-bg-main)] border border-[var(--glass-border)] rounded-md px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-blue)]"
                    placeholder="React, TypeScript, System Design, Leadership"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                      Availability
                    </label>
                    <select
                      value={mentorAvailability}
                      onChange={(e) => setMentorAvailability(e.target.value)}
                      className="mt-1 w-full bg-[var(--color-bg-main)] border border-[var(--glass-border)] rounded-md px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand-blue)]"
                    >
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Bi-weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="as_needed">As Needed</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                      Max Mentees
                    </label>
                    <div className="mt-1 flex items-center gap-2">
                      <button
                        onClick={() => setMentorMaxMentees(Math.max(1, mentorMaxMentees - 1))}
                        className="w-8 h-8 rounded bg-[var(--color-bg-main)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="text-sm font-mono text-[var(--color-text-primary)] w-8 text-center">
                        {mentorMaxMentees}
                      </span>
                      <button
                        onClick={() => setMentorMaxMentees(Math.min(10, mentorMaxMentees + 1))}
                        className="w-8 h-8 rounded bg-[var(--color-bg-main)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                    Mentor Bio
                  </label>
                  <textarea
                    value={mentorBio}
                    onChange={(e) => setMentorBio(e.target.value)}
                    rows={3}
                    className="mt-1 w-full bg-[var(--color-bg-main)] border border-[var(--glass-border)] rounded-md px-3 py-2 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-blue)] resize-none"
                    placeholder="What can you help mentees with?"
                  />
                </div>

                <button
                  onClick={saveMentorProfile}
                  disabled={savingMentor}
                  className="px-4 py-2 rounded-md bg-[var(--color-brand-blue)] text-white text-sm font-mono font-bold hover:brightness-110 transition-all disabled:opacity-50"
                >
                  {savingMentor ? "Saving..." : "Save Mentor Profile"}
                </button>
              </div>
            )}

            {!showMentorForm && !myMentorProfile?.is_mentor && (
              <div className="p-4">
                <p className="text-sm text-[var(--color-text-muted)] italic font-mono">
                  Enable Mentor Mode to start mentoring other members.
                </p>
              </div>
            )}
          </div>

          {/* Pending Requests (for mentors) */}
          {myMentorProfile?.is_mentor && pendingRequests.length > 0 && (
            <div className="bg-[var(--color-bg-alt)] border border-[var(--color-brand-yellow)]/20 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--glass-border)]">
                <h2 className="text-xs font-mono text-[var(--color-brand-yellow)] uppercase tracking-wider flex items-center gap-2">
                  <Sparkles size={14} />
                  Pending Requests ({pendingRequests.length})
                </h2>
              </div>
              <div className="p-4 space-y-2">
                {pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-center justify-between bg-[var(--color-bg-main)] border border-[var(--glass-border)] rounded-lg p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[var(--color-brand-blue)]/10 border border-[var(--color-brand-blue)]/20 flex items-center justify-center">
                        <span className="text-xs font-mono text-[var(--color-brand-blue)]">
                          {req.mentee_profile?.display_name?.[0]?.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[var(--color-text-primary)]">
                          {req.mentee_profile?.display_name}
                        </p>
                        <p className="text-[0.6rem] font-mono text-[var(--color-text-muted)]">
                          {req.mentee_profile?.class} · LV{req.mentee_profile?.level}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRequest(req.id, true)}
                        className="p-1.5 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => handleRequest(req.id, false)}
                        className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* My Mentees (for mentors) */}
          {myMentorProfile?.is_mentor && (
            <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--glass-border)]">
                <h2 className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider flex items-center gap-2">
                  <Users size={14} />
                  My Mentees ({myMentees.length})
                </h2>
              </div>
              <div className="p-4">
                {myMentees.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-muted)] italic font-mono">
                    No active mentees yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {myMentees.map((mentee) => (
                      <div
                        key={mentee.id}
                        className="flex items-center gap-3 bg-[var(--color-bg-main)] border border-[var(--glass-border)] rounded-lg p-3"
                      >
                        <div className="w-8 h-8 rounded-full bg-[var(--color-accent-cyan)]/10 border border-[var(--color-accent-cyan)]/20 flex items-center justify-center">
                          <span className="text-xs font-mono text-[var(--color-accent-cyan)]">
                            {mentee.mentee_profile?.display_name?.[0]?.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-[var(--color-text-primary)]">
                            {mentee.mentee_profile?.display_name}
                          </p>
                          <p className="text-[0.6rem] font-mono text-[var(--color-text-muted)]">
                            {mentee.mentee_profile?.class} · LV{mentee.mentee_profile?.level}{" "}
                            {mentee.mentee_profile?.rank}
                          </p>
                        </div>
                        <ChevronRight
                          size={14}
                          className="text-[var(--color-text-muted)]"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
