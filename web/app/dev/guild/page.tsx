"use client";

/**
 * Dev-only preview of the guild apply flow with a mock position, so the
 * quiz, quest rail, review step and character card can be checked without
 * auth, storage, or a database. 404s on the production deployment only
 * (Vercel previews and local dev can open it).
 *
 *   /dev/guild            apply flow from quest 1
 *   /dev/guild?seeded=1   same, with a complete draft pre-seeded so every
 *                         quest passes validation (fake resume path)
 *   /dev/guild?view=success   success screen with a rolled character
 *   /dev/guild?view=cards     all four class cards side by side
 */

import { Suspense, useState } from "react";
import { notFound, useSearchParams } from "next/navigation";
import ApplicationForm from "@/components/recruit/ApplicationForm";
import SuccessScreen from "@/components/recruit/SuccessScreen";
import CharacterCard from "@/components/recruit/guild/CharacterCard";
import type { Position } from "@/lib/recruitment";
import { rollCharacter, type Character } from "@/lib/guild";

const MOCK_POSITION: Position = {
  id: "00000000-0000-0000-0000-00000000dead",
  slug: "vp-marketing",
  title: "VP Marketing",
  description: "Own TSI's creative vision.",
  phase: 1,
  visibility: "public",
  access_code: null,
  essay_questions: [
    {
      id: "vp-mkt-f26-1",
      question:
        "Pick one craft (design, video, photo, content) and tell us what makes you elite at it. Specific examples beat adjectives.",
      max_words: 400,
    },
    {
      id: "vp-mkt-f26-2",
      question:
        "Show us, don't just tell us. Paste a link to one creative piece that makes the case for why you're the one for this role.",
      max_words: 80,
    },
  ],
  opens_at: "2026-09-05T04:00:00Z",
  closes_at: "2026-09-12T04:10:00Z",
  is_active: true,
  created_at: "2026-09-02T00:00:00Z",
  calendly_url: null,
};

// INTJ → Mage, Arcane Architect
const MOCK_CHARACTER: Character = rollCharacter([1, 1, 0, 0])!;

const SAMPLE_CHARACTERS: Character[] = [
  rollCharacter([0, 1, 0, 0])!, // ENTJ Warrior
  rollCharacter([1, 1, 0, 0])!, // INTJ Mage
  rollCharacter([0, 1, 1, 0])!, // ENFJ Healer
  rollCharacter([1, 0, 0, 0])!, // ISTJ Rogue
];

export default function GuildPreviewPage() {
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === "production") notFound();
  return (
    <Suspense fallback={null}>
      <GuildPreview />
    </Suspense>
  );
}

function GuildPreview() {
  const params = useSearchParams();
  const view = params.get("view") ?? "apply";
  const seeded = params.get("seeded") === "1";
  // Seed the draft before the form mounts (lazy initializer, client only)
  // so ApplicationForm hydrates from it on its first effect.
  useState(() => {
    if (!seeded || typeof window === "undefined") return false;
    localStorage.setItem(
      `tethos:draft:${MOCK_POSITION.id}`,
      JSON.stringify({
        updated_at: new Date().toISOString(),
        form_data: {
          full_name: "Priya Raman",
          email: "priya@uwo.ca",
          phone: "",
          program_major: "Software Engineering",
          year_of_study: "3",
          linkedin_url: "",
          other_links: "",
          commitments_next_year: "",
          heard_about_us: "Instagram",
          essay_answers: {
            "vp-mkt-f26-1":
              "Short-form video. I cut a 40-second reel for the design club that did 12k views in a week because the first frame was a question, not a logo.",
            "vp-mkt-f26-2": "https://example.com/reel",
          },
          resume_storage_path: "preview/priya_resume.pdf",
          resume_filename: "priya_resume.pdf",
          resume_size_bytes: 120000,
          portfolio_files: [],
          portfolio_link: "",
          creative_piece_files: [],
          character: MOCK_CHARACTER,
        },
      })
    );
    return true;
  });

  return (
    <div className="min-h-screen bg-[#0F0F10] text-[#F1FFFF] px-6 md:px-16 pt-24 pb-24">
      <div className="max-w-5xl mx-auto">
        <p className="text-xs text-[#6B7280] mb-8">
          Dev preview. Mock position, no auth, no storage.
        </p>

        {view === "apply" && (
          <>
            <div className="mb-8">
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#1D9BF0] mb-2">
                Applying for
              </p>
              <h1 className="text-2xl md:text-3xl font-semibold text-[#F1FFFF]">
                {MOCK_POSITION.title}
              </h1>
            </div>
            <ApplicationForm position={MOCK_POSITION} userId="preview-user" />
          </>
        )}

        {view === "success" && (
          <SuccessScreen
            positionTitle={MOCK_POSITION.title}
            applicantName="Priya Raman"
            position={MOCK_POSITION}
            positionSlug={MOCK_POSITION.slug}
            character={MOCK_CHARACTER}
          />
        )}

        {view === "cards" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {SAMPLE_CHARACTERS.map((c) => (
              <CharacterCard
                key={c.mbti}
                name="Priya Raman"
                character={c}
                roleTitle="VP Marketing"
                status="Screening"
                issued={new Date("2026-09-06T12:00:00Z")}
                xp={100}
                still
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
