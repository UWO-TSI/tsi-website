"use client";

import { useState, useEffect, type CSSProperties } from "react";
import { createClient } from "@/lib/supabase/client";
import { must, settle } from "@/lib/portal/load";
import {
  Users,
  Search,
  UserPlus,
  Clock,
  Check,
  X,
  Minus,
  Plus,
} from "lucide-react";
import { CLASS_META, ClassBadge } from "@/components/portal/classIdentity";
import { Badge, Banner, Button, Card, Empty, ErrorNote, Field, IconButton, Loading, Select, Tabs, TextArea, Toggle } from "@/components/gui";

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
  status: "pending" | "active" | "completed" | "declined";
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

const AVAILABILITY: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Every two weeks",
  monthly: "Monthly",
  as_needed: "As needed",
};

const cardTitle: CSSProperties = { fontSize: 16, fontWeight: 800, color: "var(--gui-ink-strong)" };

function Initial({ name, size = 40 }: { name: string | undefined; size?: number }) {
  return (
    <span
      aria-hidden
      className="shrink-0 grid place-items-center"
      style={{ width: size, height: size, borderRadius: "var(--gui-r-blob)", background: "var(--gui-sage-soft)", color: "var(--gui-sage-deep)", fontSize: size > 40 ? 18 : 15, fontWeight: 800 }}
    >
      {name?.[0]?.toUpperCase()}
    </span>
  );
}

function ClassAndLevel({ cls, level, rank }: { cls: string | null | undefined; level: number | undefined; rank?: string }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1" style={{ fontSize: 13, fontWeight: 700, color: "var(--gui-ink-2)" }}>
      {cls && CLASS_META[cls] ? <ClassBadge cls={cls} iconSize={12} fontSize={13} /> : cls && <span>{cls}</span>}
      {cls && <span aria-hidden style={{ color: "var(--gui-muted)" }}>·</span>}
      <span>Lv {level}{rank ? ` ${rank}` : ""}</span>
    </span>
  );
}

export default function MentorshipPage() {
  const [tab, setTab] = useState<"find" | "my">("find");
  const [mentors, setMentors] = useState<MentorProfile[]>([]);
  const [search, setSearch] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "signed-out" | "error">("loading");
  const [saveError, setSaveError] = useState<string | null>(null);
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

  /** A write's result: true when it saved, else the failure is shown and nothing on screen changes. */
  const saved = (r: { error: unknown }) => {
    setSaveError(r.error ? "That didn’t save. Try again." : null);
    return !r.error;
  };

  async function loadData() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    setUserId(user.id);

    // Fetch mentors
    const mentorProfiles = must(await supabase
      .from("mentorship_profiles")
      .select("*, profile:profiles(display_name, class, level, rank)")
      .eq("is_mentor", true));

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
    const myMP = must(await supabase
      .from("mentorship_profiles")
      .select("*, profile:profiles(display_name, class, level, rank)")
      .eq("user_id", user.id)
      .maybeSingle());

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
    const mentorMatch = must(await supabase
      .from("mentorship_matches")
      .select("*, mentor_profile:profiles!mentorship_matches_mentor_id_fkey(display_name, class, level, rank)")
      .eq("mentee_id", user.id)
      .in("status", ["active", "pending"])
      .limit(1)
      .maybeSingle());

    if (mentorMatch) {
      setMyMentor(mentorMatch as unknown as MentorshipMatch);
    }

    // If I'm a mentor, fetch my mentees
    if (myMP?.is_mentor) {
      const menteeMatches = must(await supabase
        .from("mentorship_matches")
        .select("*, mentee_profile:profiles!mentorship_matches_mentee_id_fkey(display_name, class, level, rank)")
        .eq("mentor_id", user.id)
        .eq("status", "active"));

      setMyMentees((menteeMatches as unknown as MentorshipMatch[]) ?? []);

      const pending = must(await supabase
        .from("mentorship_matches")
        .select("*, mentee_profile:profiles!mentorship_matches_mentee_id_fkey(display_name, class, level, rank)")
        .eq("mentor_id", user.id)
        .eq("status", "pending"));

      setPendingRequests((pending as unknown as MentorshipMatch[]) ?? []);
    }

    // Track which mentors the user already sent requests to
    const sentRequests = must(await supabase
      .from("mentorship_matches")
      .select("mentor_id")
      .eq("mentee_id", user.id)
      .in("status", ["pending", "active"]));

    setRequestsSent((sentRequests ?? []).map((r) => r.mentor_id));
    return true;
  }

  useEffect(() => {
    void settle(loadData).then(setState);
  }, []);

  async function requestMentorship(mentorUserId: string) {
    const supabase = createClient();
    const r = await supabase.from("mentorship_matches").insert({
      mentor_id: mentorUserId,
      mentee_id: userId,
      status: "pending",
    });
    if (saved(r)) setRequestsSent([...requestsSent, mentorUserId]);
  }

  async function handleRequest(matchId: string, accept: boolean) {
    const supabase = createClient();
    const r = await supabase
      .from("mentorship_matches")
      .update({ status: accept ? "active" : "declined" })
      .eq("id", matchId);
    if (!saved(r)) return;

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
      const r = await supabase
        .from("mentorship_profiles")
        .update({ is_mentor: false })
        .eq("user_id", userId);
      if (saved(r)) setMyMentorProfile({ ...myMentorProfile, is_mentor: false });
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
      const r = await supabase
        .from("mentorship_profiles")
        .update(payload)
        .eq("user_id", userId);
      if (saved(r)) setMyMentorProfile({ ...myMentorProfile, ...payload });
      else return setSavingMentor(false);
    } else {
      const r = await supabase
        .from("mentorship_profiles")
        .insert(payload)
        .select("*, profile:profiles(display_name, class, level, rank)")
        .single();
      if (saved(r) && r.data) setMyMentorProfile(r.data as unknown as MentorProfile);
      else return setSavingMentor(false);
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

  if (state !== "ready") {
    return (
      <div className="flex-1 overflow-y-auto" style={{ padding: "24px 20px 48px" }}>
        <div className="max-w-4xl mx-auto">
          {state === "loading" ? <Loading label="Finding mentors…" />
            : state === "signed-out" ? <Empty icon={<Users size={32} />} title="Sign in to find a mentor">Mentorship opens once you’re signed in.</Empty>
            : <ErrorNote onRetry={() => { setState("loading"); void settle(loadData).then(setState); }}>Mentorship didn’t load.</ErrorNote>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: "24px 20px 48px" }}>
      <div className="max-w-4xl mx-auto space-y-6">
        <Banner title="Mentorship" icon={<Users size={26} />} tone="sage">
          Learn from experienced members, or guide the next ones.
        </Banner>

        {saveError && <ErrorNote className="sticky top-4 z-10 shadow-[var(--gui-shadow-md)]">{saveError}</ErrorNote>}

        <Tabs
          label="Mentorship"
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "find", label: "Find a mentor" },
            { id: "my", label: "My mentorship", badge: myMentorProfile?.is_mentor ? pendingRequests.length : 0 },
          ]}
        />

        {/* Find a Mentor Tab */}
        {tab === "find" && (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search
                aria-hidden
                className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left: 16, width: 18, height: 18, color: "var(--gui-muted)" }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search mentors"
                className="w-full transition-colors border-2 border-[var(--gui-paper-line)] focus:border-[var(--gui-sage)] bg-[var(--gui-paper-hi)] text-[var(--gui-ink)] placeholder:text-[var(--gui-muted)]"
                style={{ height: 48, padding: "0 16px 0 44px", borderRadius: "18px 15px 17px 16px", fontSize: 15, fontWeight: 600 }}
                placeholder="Search by name, skill or class…"
              />
            </div>

            {/* Mentor Grid */}
            {filteredMentors.length === 0 ? (
              <Card>
                <Empty icon={<Users size={32} />} title="No mentors found">
                  Check back later, or become one yourself under My mentorship.
                </Empty>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredMentors.map((mentor) => {
                  const isFull = (mentor.mentee_count ?? 0) >= mentor.max_mentees;
                  const alreadyRequested = requestsSent.includes(mentor.user_id);

                  return (
                    <Card key={mentor.id} as="article" className="flex flex-col gap-3" style={{ padding: 18 }}>
                      <div className="flex items-start gap-3">
                        <Initial name={mentor.profile.display_name} />
                        <div className="flex-1 min-w-0">
                          <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--gui-ink-strong)", overflowWrap: "anywhere" }}>
                            {mentor.profile.display_name}
                          </h3>
                          <ClassAndLevel cls={mentor.profile.class} level={mentor.profile.level} rank={mentor.profile.rank} />
                        </div>
                        <Badge tone={isFull ? "danger" : "success"} className="shrink-0">{isFull ? "Full" : "Open"}</Badge>
                      </div>

                      {/* Skills */}
                      {mentor.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {mentor.skills.map((skill) => (
                            <Badge key={skill}>{skill}</Badge>
                          ))}
                        </div>
                      )}

                      {/* Meta */}
                      <div className="flex flex-wrap items-center justify-between gap-3 mt-auto">
                        <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: "var(--gui-muted)", fontWeight: 700 }}>
                          <span className="flex items-center gap-1.5">
                            <Users size={14} aria-hidden />
                            {mentor.mentee_count}/{mentor.max_mentees} mentees
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Clock size={14} aria-hidden />
                            {AVAILABILITY[mentor.availability] ?? mentor.availability}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant={alreadyRequested ? "secondary" : "primary"}
                          onClick={() => requestMentorship(mentor.user_id)}
                          disabled={isFull || alreadyRequested}
                        >
                          {alreadyRequested ? (
                            <>
                              <Clock size={16} aria-hidden />
                              Requested
                            </>
                          ) : (
                            <>
                              <UserPlus size={16} aria-hidden />
                              Request
                            </>
                          )}
                        </Button>
                      </div>
                    </Card>
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
            <Card style={{ padding: 20 }}>
              <h2 className="mb-3" style={cardTitle}>My mentor</h2>
              {myMentor ? (
                <div className="flex items-center gap-4">
                  <Initial name={myMentor.mentor_profile?.display_name} size={48} />
                  <div className="min-w-0">
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: "var(--gui-ink-strong)" }}>
                      {myMentor.mentor_profile?.display_name}
                    </h3>
                    <ClassAndLevel cls={myMentor.mentor_profile?.class} level={myMentor.mentor_profile?.level} rank={myMentor.mentor_profile?.rank} />
                    <Badge tone={myMentor.status === "active" ? "success" : "warn"} className="mt-1.5">
                      {myMentor.status === "active" ? "Active" : "Pending"}
                    </Badge>
                  </div>
                </div>
              ) : (
                <p className="text-sm" style={{ color: "var(--gui-ink-2)" }}>
                  You don&apos;t have a mentor yet. Find one in the Find a mentor tab and send a request.
                </p>
              )}
            </Card>

            {/* Become a Mentor / Mentor Settings */}
            <Card style={{ padding: 20 }}>
              <Toggle checked={!!myMentorProfile?.is_mentor} onChange={() => toggleMentor()} hint="Let other members ask you to mentor them.">
                Mentor mode
              </Toggle>

              {(showMentorForm || myMentorProfile?.is_mentor) && (
                <div className="space-y-4 mt-4 pt-4" style={{ borderTop: "2px dashed var(--gui-paper-edge)" }}>
                  <Field
                    label="Skills"
                    hint="Separate them with commas."
                    value={mentorSkills}
                    onChange={(e) => setMentorSkills(e.target.value)}
                    placeholder="React, TypeScript, system design, leadership"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Select label="Availability" value={mentorAvailability} onChange={(e) => setMentorAvailability(e.target.value)}>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Every two weeks</option>
                      <option value="monthly">Monthly</option>
                      <option value="as_needed">As needed</option>
                    </Select>
                    <div className="flex items-center justify-between gap-3" style={{ minHeight: 48 }}>
                      <span style={{ fontWeight: 700 }}>Max mentees</span>
                      <div className="flex items-center gap-2">
                        <IconButton label="Fewer mentees" size="sm" onClick={() => setMentorMaxMentees(Math.max(1, mentorMaxMentees - 1))}>
                          <Minus size={16} aria-hidden />
                        </IconButton>
                        <span aria-live="polite" className="text-center" style={{ width: 28, fontSize: 18, fontWeight: 800, color: "var(--gui-ink-strong)" }}>
                          {mentorMaxMentees}
                        </span>
                        <IconButton label="More mentees" size="sm" onClick={() => setMentorMaxMentees(Math.min(10, mentorMaxMentees + 1))}>
                          <Plus size={16} aria-hidden />
                        </IconButton>
                      </div>
                    </div>
                  </div>

                  <TextArea
                    label="Mentor bio"
                    value={mentorBio}
                    onChange={(e) => setMentorBio(e.target.value)}
                    rows={3}
                    placeholder="What can you help mentees with?"
                    style={{ minHeight: 96 }}
                  />

                  <Button size="sm" onClick={saveMentorProfile} disabled={savingMentor}>
                    {savingMentor ? "Saving…" : "Save mentor profile"}
                  </Button>
                </div>
              )}

              {!showMentorForm && !myMentorProfile?.is_mentor && (
                <p className="text-sm mt-2" style={{ color: "var(--gui-ink-2)" }}>
                  Turn on mentor mode to start mentoring other members.
                </p>
              )}
            </Card>

            {/* Pending Requests (for mentors) */}
            {myMentorProfile?.is_mentor && pendingRequests.length > 0 && (
              <Card tone="butter" style={{ padding: 20 }}>
                <h2 className="mb-3" style={cardTitle}>Requests waiting ({pendingRequests.length})</h2>
                <div className="space-y-2">
                  {pendingRequests.map((req) => (
                    <div
                      key={req.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl"
                      style={{ background: "var(--gui-paper-hi)", padding: "10px 12px", boxShadow: "var(--gui-shadow-sm)" }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Initial name={req.mentee_profile?.display_name} size={36} />
                        <div className="min-w-0">
                          <p style={{ fontSize: 15, fontWeight: 800, color: "var(--gui-ink-strong)" }}>
                            {req.mentee_profile?.display_name}
                          </p>
                          <ClassAndLevel cls={req.mentee_profile?.class} level={req.mentee_profile?.level} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <IconButton label={`Accept ${req.mentee_profile?.display_name ?? "this request"}`} tone="sage" size="sm" onClick={() => handleRequest(req.id, true)}>
                          <Check size={18} aria-hidden />
                        </IconButton>
                        <IconButton label={`Decline ${req.mentee_profile?.display_name ?? "this request"}`} size="sm" onClick={() => handleRequest(req.id, false)}>
                          <X size={18} aria-hidden style={{ color: "var(--gui-danger)" }} />
                        </IconButton>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* My Mentees (for mentors) */}
            {myMentorProfile?.is_mentor && (
              <Card style={{ padding: 20 }}>
                <h2 className="mb-3" style={cardTitle}>My mentees ({myMentees.length})</h2>
                {myMentees.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--gui-ink-2)" }}>
                    No active mentees yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {myMentees.map((mentee) => (
                      <div
                        key={mentee.id}
                        className="flex items-center gap-3 rounded-2xl"
                        style={{ background: "var(--gui-paper-warm)", padding: "10px 12px" }}
                      >
                        <Initial name={mentee.mentee_profile?.display_name} size={36} />
                        <div className="flex-1 min-w-0">
                          <p style={{ fontSize: 15, fontWeight: 800, color: "var(--gui-ink-strong)" }}>
                            {mentee.mentee_profile?.display_name}
                          </p>
                          <ClassAndLevel cls={mentee.mentee_profile?.class} level={mentee.mentee_profile?.level} rank={mentee.mentee_profile?.rank} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
