"use client";

/**
 * /student/apply/portal — the applicant island. Desktop only: phones and
 * tablets get a card with a copy-link button. Signed-out visitors get the
 * recruitment AuthModal, then land back here. `?preview=1` (never on the
 * production deployment) skips auth and mocks the open roles so the walk
 * can be checked without a database.
 */

import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Copy, Monitor } from "lucide-react";
import AuthModal from "@/components/recruit/AuthModal";
import { TransitionProvider } from "@/components/game/TransitionOverlay";
import { createClient } from "@/lib/supabase/client";
import type { MiniWorldSession } from "@/components/game/mini/MiniWorld";
import type { Position } from "@/lib/recruitment";
import type { Profile } from "@/lib/supabase/types";

const MiniWorld = dynamic(() => import("@/components/game/mini/MiniWorld"), {
  ssr: false,
  loading: () => <Loading label="Loading the island" />,
});

const SMALL_QUERY = "(max-width: 900px), (pointer: coarse)";
function subscribeSmall(cb: () => void) {
  const mq = window.matchMedia(SMALL_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const getSmall = () => window.matchMedia(SMALL_QUERY).matches;
const getSmallServer = () => false;

const PREVIEW_POSITIONS: Position[] = [
  {
    id: "preview-vp-marketing",
    slug: "vp-marketing",
    title: "VP Marketing",
    description: "Own TSI's creative vision. Posts that stop the scroll, videos that tell our story, mastery of one craft.",
    phase: 1,
    visibility: "public",
    access_code: null,
    essay_questions: [
      { id: "vp-mkt-f26-1", question: "Pick one craft (design, video, photo, content) and tell us what makes you elite at it. Specific examples beat adjectives.", max_words: 400 },
      { id: "vp-mkt-f26-2", question: "Show us, don't just tell us. Paste a link to one creative piece that makes the case for why you're the one for this role.", max_words: 80 },
    ],
    opens_at: "2026-09-01T04:00:00Z",
    closes_at: "2026-09-12T04:10:00Z",
    is_active: true,
    created_at: "2026-09-01T00:00:00Z",
    calendly_url: null,
  },
  {
    id: "preview-pm",
    slug: "pm",
    title: "Project Manager",
    description: "CEO of your own project. Lead a team of developers building real software for a nonprofit client, kickoff to GENESIS.",
    phase: 1,
    visibility: "public",
    access_code: null,
    essay_questions: [
      { id: "pm-f26-1", question: "Tell us about a time you led a team through a hard project. What did you own, what did you delegate, and what would you do differently?", max_words: 400 },
      { id: "pm-f26-2", question: "Walk us through your most impressive technical project. What did you build, what was your role, and what did you learn?", max_words: 400 },
    ],
    opens_at: "2026-09-01T04:00:00Z",
    closes_at: "2026-09-12T04:10:00Z",
    is_active: true,
    created_at: "2026-09-01T00:00:00Z",
    calendly_url: null,
  },
];

export default function PortalPage() {
  return (
    <Suspense fallback={<Loading label="Loading" />}>
      <Portal />
    </Suspense>
  );
}

function Portal() {
  const small = useSyncExternalStore(subscribeSmall, getSmall, getSmallServer);
  const params = useSearchParams();
  const preview = params.get("preview") === "1" && process.env.NEXT_PUBLIC_VERCEL_ENV !== "production";
  const [session, setSession] = useState<MiniWorldSession | null | "signed-out">(() =>
    preview
      ? { userId: "preview-user", email: "you@uwo.ca", profile: null, preview: { positions: PREVIEW_POSITIONS } }
      : null
  );

  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) {
          setSession("signed-out");
          return;
        }
        let profile: Profile | null = null;
        try {
          const res = await fetch("/api/profile");
          if (res.ok) profile = ((await res.json())?.profile as Profile) ?? null;
        } catch {
          /* world still opens; creation will ask again */
        }
        if (cancelled) return;
        setSession({ userId: user.id, email: user.email ?? "", profile });
      } catch {
        if (!cancelled) setSession("signed-out");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preview]);

  if (small) return <DesktopOnly />;
  if (session === null) return <Loading label="Checking your session" />;
  if (session === "signed-out") return <SignIn />;

  return (
    <div className="fixed inset-0 z-50" style={{ background: "#0F0F10" }}>
      <TransitionProvider>
        <MiniWorld session={session} />
      </TransitionProvider>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "#0F0F10" }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-[#1D9BF0] border-t-transparent animate-spin" />
        <p className="font-mono text-xs text-[#6B7280] tracking-wider">{label}</p>
      </div>
    </div>
  );
}

function SignIn() {
  const [open, setOpen] = useState(true);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: "#0F0F10" }}>
      <div className="max-w-md w-full text-center">
        <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#1D9BF0] mb-3">Tethos application portal</p>
        <h1 className="text-2xl font-semibold text-[#F1FFFF] mb-2">Sign in to enter</h1>
        <p className="text-sm text-[#6B7280] mb-8">Your character and your applications are tied to your account.</p>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-[#1D9BF0] text-[#F1FFFF] text-sm font-medium hover:bg-[#0e7dbf] transition"
        >
          Sign in
        </button>
        <div className="mt-8">
          <Link href="/student/apply" className="text-sm text-[#6B7280] hover:text-[#F1FFFF] transition">
            Back to roles
          </Link>
        </div>
      </div>
      <AuthModal isOpen={open} onClose={() => setOpen(false)} redirectTo="/student/apply/portal" />
    </div>
  );
}

function DesktopOnly() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(typeof window !== "undefined" ? window.location.href : "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background: "#0F0F10" }}>
      <div className="max-w-sm w-full text-center">
        <div className="w-12 h-12 rounded-full bg-[#1D9BF0]/15 flex items-center justify-center mx-auto mb-5">
          <Monitor className="w-5 h-5 text-[#1D9BF0]" />
        </div>
        <h1 className="text-xl font-semibold text-[#F1FFFF] mb-2">Open this on a laptop</h1>
        <p className="text-sm text-[#6B7280] mb-8 leading-relaxed">
          The application portal is a small world you walk through with a keyboard. Send yourself the link and come back on a bigger screen.
        </p>
        <button
          onClick={copy}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#1D9BF0] text-[#F1FFFF] text-sm font-medium hover:bg-[#0e7dbf] transition"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied" : "Copy link"}
        </button>
        <div className="mt-8">
          <Link href="/student/apply" className="text-sm text-[#6B7280] hover:text-[#F1FFFF] transition">
            Read about the roles instead
          </Link>
        </div>
      </div>
    </div>
  );
}
