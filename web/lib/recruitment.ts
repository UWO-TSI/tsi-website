/**
 * Tethos Recruitment System — Shared Types, Constants & Helpers
 */

// ============================================
// STATUS PIPELINE
// ============================================

export const APPLICATION_STATUSES = [
  "submitted",
  "screening",
  "interview_invite",
  "interview",
  "final_review",
  "offer",
  "waitlist",
  "declined",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: "Submitted",
  screening: "Screening",
  interview_invite: "Interview Invite",
  interview: "Interview",
  final_review: "Final Review",
  offer: "Offer",
  waitlist: "Waitlist",
  declined: "Declined",
};

export const STATUS_COLORS: Record<ApplicationStatus, string> = {
  submitted: "#9CA3AF",      // gray
  screening: "#22D3EE",      // cyan
  interview_invite: "#FFD166", // yellow
  interview: "#1D9BF0",      // brand blue
  final_review: "#A78BFA",   // purple
  offer: "#22C55E",          // green
  waitlist: "#F97316",       // orange
  declined: "#EF4444",       // red
};

// ============================================
// POSITION TYPES
// ============================================

export type PositionVisibility = "public" | "internal";

export interface EssayQuestion {
  id: string;
  question: string;
  max_words: number;
}

export interface Position {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  phase: number;
  visibility: PositionVisibility;
  access_code: string | null;
  essay_questions: EssayQuestion[];
  opens_at: string | null;
  closes_at: string | null;
  is_active: boolean;
  created_at: string;
  calendly_url?: string | null;
}

// ============================================
// APPLICATION TYPES
// ============================================

export interface EssayAnswer {
  question_id: string;
  answer: string;
}

export interface Application {
  id: string;
  user_id: string;
  position_id: string;
  full_name: string;
  email: string;
  phone: string;
  program_major: string;
  year_of_study: number;
  linkedin_url: string | null;
  heard_about_us: string;
  resume_drive_url: string | null;
  resume_filename: string | null;
  essay_answers: EssayAnswer[];
  status: ApplicationStatus;
  draft_status: ApplicationStatus | null;
  tags: string[];
  admin_notes: string | null;
  submitted_at: string;
  released_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  position?: Position;
  releases?: StatusRelease[];
}

export interface StatusRelease {
  id: string;
  application_id: string;
  old_status: ApplicationStatus;
  new_status: ApplicationStatus;
  released_by: string;
  released_at: string;
}

// ============================================
// FORM FIELD CONFIG
// ============================================

export const HEARD_ABOUT_OPTIONS = [
  "Instagram",
  "LinkedIn",
  "Friend / Word of Mouth",
  "Club Fair / Campus Event",
  "Professor / TA",
  "Website / Google Search",
  "Other",
] as const;

export const YEAR_OPTIONS = [
  { value: 1, label: "1st Year" },
  { value: 2, label: "2nd Year" },
  { value: 3, label: "3rd Year" },
  { value: 4, label: "4th Year" },
  { value: 5, label: "5th Year+" },
] as const;

export const MAX_RESUME_SIZE_MB = 5;
export const MAX_RESUME_SIZE_BYTES = MAX_RESUME_SIZE_MB * 1024 * 1024;

// ============================================
// PHASE CONFIG
// ============================================

export interface RecruitmentPhase {
  phase: number;
  title: string;
  description: string;
  dateLabel: string;
  positions: string[]; // slugs
}

export const RECRUITMENT_PHASES: RecruitmentPhase[] = [
  {
    phase: 1,
    title: "Executive Applications",
    description: "VP and leadership roles open for the 2026-27 year.",
    dateLabel: "May 2026",
    positions: ["vp-internal", "vp-external", "vp-marketing"],
  },
  {
    phase: 2,
    title: "PM & Director Applications",
    description: "Project management and technical director positions.",
    dateLabel: "September 2026",
    positions: ["pm-general", "dev-directors"],
  },
];

// ============================================
// POSITION SEED DATA
// ============================================

export const POSITION_SEED_DATA: Omit<Position, "id" | "created_at">[] = [
  {
    slug: "vp-internal",
    title: "VP Internal",
    description:
      "Lead internal operations, team culture, and member experience. You'll manage onboarding, events, and cross-team coordination.",
    phase: 1,
    visibility: "public",
    access_code: null,
    essay_questions: [
      {
        id: "vp-int-1",
        question:
          "Describe a time you built or improved an internal process for a team or organization. What was the outcome?",
        max_words: 500,
      },
      {
        id: "vp-int-2",
        question:
          "How would you approach building team culture in a remote-first student organization?",
        max_words: 400,
      },
    ],
    opens_at: "2026-05-01T00:00:00Z",
    closes_at: "2026-05-31T23:59:59Z",
    is_active: true,
  },
  {
    slug: "vp-external",
    title: "VP External",
    description:
      "Own partnerships, sponsorships, and external communications. You'll represent Tethos to companies, nonprofits, and the broader community.",
    phase: 1,
    visibility: "public",
    access_code: null,
    essay_questions: [
      {
        id: "vp-ext-1",
        question:
          "Tell us about a partnership or sponsorship you secured. How did you approach it?",
        max_words: 500,
      },
      {
        id: "vp-ext-2",
        question:
          "What's your strategy for growing Tethos's presence beyond Western University?",
        max_words: 400,
      },
    ],
    opens_at: "2026-05-01T00:00:00Z",
    closes_at: "2026-05-31T23:59:59Z",
    is_active: true,
  },
  {
    slug: "vp-marketing",
    title: "VP Marketing",
    description:
      "Drive brand strategy, social media, and creative output. You'll shape how Tethos looks, sounds, and reaches its audience.",
    phase: 1,
    visibility: "public",
    access_code: null,
    essay_questions: [
      {
        id: "vp-mkt-1",
        question:
          "Share a campaign or creative project you led. What was the impact?",
        max_words: 500,
      },
      {
        id: "vp-mkt-2",
        question:
          "How would you differentiate Tethos's brand from other tech clubs on campus?",
        max_words: 400,
      },
    ],
    opens_at: "2026-05-01T00:00:00Z",
    closes_at: "2026-05-31T23:59:59Z",
    is_active: true,
  },
  {
    slug: "pm-internal",
    title: "Project Manager",
    description:
      "Lead a cross-functional team delivering software for nonprofit clients. Manage timelines, scope, and stakeholder communication.",
    phase: 1,
    visibility: "internal",
    access_code: null, // set via env var at runtime
    essay_questions: [
      {
        id: "pm-int-1",
        question:
          "Describe a project where you had to manage competing priorities. How did you handle trade-offs?",
        max_words: 500,
      },
    ],
    opens_at: "2026-05-01T00:00:00Z",
    closes_at: "2026-05-31T23:59:59Z",
    is_active: true,
  },
  {
    slug: "advisor",
    title: "Advisor",
    description:
      "Provide strategic guidance and mentorship to the executive team. Leverage your Tethos experience to shape the org's direction.",
    phase: 1,
    visibility: "internal",
    access_code: null, // set via env var at runtime
    essay_questions: [
      {
        id: "adv-1",
        question:
          "What was your most impactful contribution during your time at Tethos, and what would you do differently?",
        max_words: 500,
      },
    ],
    opens_at: "2026-05-01T00:00:00Z",
    closes_at: "2026-05-31T23:59:59Z",
    is_active: true,
  },
  {
    slug: "pm-general",
    title: "Project Manager",
    description:
      "Lead a cross-functional team delivering software for nonprofit clients. Open to all applicants.",
    phase: 2,
    visibility: "public",
    access_code: null,
    essay_questions: [
      {
        id: "pm-gen-1",
        question:
          "Describe a project where you had to manage competing priorities. How did you handle trade-offs?",
        max_words: 500,
      },
    ],
    opens_at: "2026-09-01T00:00:00Z",
    closes_at: "2026-09-15T23:59:59Z",
    is_active: false,
  },
  {
    slug: "dev-directors",
    title: "Dev/Directors",
    description:
      "Technical leads and directors driving engineering execution across Tethos projects.",
    phase: 2,
    visibility: "public",
    access_code: null,
    essay_questions: [
      {
        id: "dev-dir-1",
        question:
          "Tell us about a technical challenge you solved. What was your approach and what did you learn?",
        max_words: 500,
      },
    ],
    opens_at: "2026-09-15T00:00:00Z",
    closes_at: "2026-09-30T23:59:59Z",
    is_active: false,
  },
];

// ============================================
// HELPERS
// ============================================

/** Check if a position is currently accepting applications */
export function isPositionOpen(position: Position): boolean {
  if (!position.is_active) return false;
  const now = new Date();
  if (position.opens_at && new Date(position.opens_at) > now) return false;
  if (position.closes_at && new Date(position.closes_at) < now) return false;
  return true;
}

export type PositionStatus = "upcoming" | "open" | "closed";

/** Get the display status of a position based on dates and active flag */
export function getPositionStatus(position: Position): PositionStatus {
  const now = new Date();
  if (!position.is_active) return "upcoming";
  if (position.opens_at && new Date(position.opens_at) > now) return "upcoming";
  if (position.closes_at && new Date(position.closes_at) < now) return "closed";
  return "open";
}

/** Format the opens_at date for display (e.g. "Opens May 6").
 *  Pinned to Toronto time so the displayed date matches the club's
 *  announced schedule regardless of the visitor's locale. */
export function formatOpensAt(opensAt: string): string {
  const date = new Date(opensAt);
  return `Opens ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Toronto",
  })}`;
}

/** Format the closes_at date for display (e.g. "May 12").
 *  Subtracts 30 minutes so a deadline of "May 13 00:10 EDT" reads as
 *  "May 12" — matching how end-of-day deadlines are usually framed. */
export function formatClosesAt(closesAt: string): string {
  const shifted = new Date(new Date(closesAt).getTime() - 30 * 60 * 1000);
  return shifted.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Toronto",
  });
}

/** Get the current recruitment phase based on date */
export function getCurrentPhase(): number {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-indexed
  if (month >= 5 && month <= 8) return 1;
  if (month >= 9) return 2;
  return 1;
}

/** Get status index for pipeline visualization */
export function getStatusIndex(status: ApplicationStatus): number {
  const pipelineOrder: ApplicationStatus[] = [
    "submitted",
    "screening",
    "interview_invite",
    "interview",
    "final_review",
  ];
  const idx = pipelineOrder.indexOf(status);
  return idx === -1 ? pipelineOrder.length : idx;
}

/** Check if status is a terminal state */
export function isTerminalStatus(status: ApplicationStatus): boolean {
  return ["offer", "waitlist", "declined"].includes(status);
}
