// Long-form, role-specific content for the apply portal.
// The DB stores only short fields (description, essay_questions).
// Anything richer — bullet lists, callouts, role-specific notes —
// lives here and is keyed by position slug.
//
// Updates require redeploy. That's fine for ~3 roles per cycle.

export interface AboutCallout {
  title: string;
  body: string;
  subtitle?: string;
  stats?: string[];
}

export interface RoleContent {
  /** Display string like "2" or "1–2" (em-dash). */
  positionsCount: string;
  /** Single-paragraph tagline shown under the role title. */
  tagline: string;
  /** Bullet list for the "What you'll do" section. */
  whatYoullDo: string[];
  /** Bullet list for the "Who you are" section. */
  whoYouAre: string[];
  /** Optional callout block (e.g. About GENESIS for VP External). */
  about?: AboutCallout;
  /** Optional pre-apply note (e.g. VP Marketing's "you don't need to do it all"). */
  preApplyNote?: string;
  /** Optional special apply instructions (e.g. VP Marketing's portfolio ask). */
  applyInstructions?: string;
}

export const ROLE_CONTENT: Record<string, RoleContent> = {
  "vp-external": {
    positionsCount: "2",
    tagline:
      "As VP External, you're the face of TSI to the world. You'll build the partnerships that power our projects and lead GENESIS Project Showcase, TSI's biggest and most exciting event of the year, from concept to execution.",
    whatYoullDo: [
      "Source and secure non-profit project clients locally and globally, from building outreach lists to hopping on calls and closing partnerships over the summer.",
      "Develop a compelling project partnership package and sponsorship package that represent TSI's value to the outside world.",
      "Own GENESIS Project Showcase end-to-end, from logistics to sponsorships to all the details that make it unforgettable.",
      "Work cross-functionally with operations and project teams to keep everything aligned.",
      "Cultivate relationships with organizations inside and outside of Western and London.",
    ],
    whoYouAre: [
      "Organized and on top of your responsibilities.",
      "A strong communicator who can hold a client call just as well as write an outreach email.",
      "Detail-oriented, but can still see the bigger picture.",
      "A leader who knows how to build and motivate a team.",
      "Someone who brings new ideas to the table and follows through on them.",
    ],
    about: {
      title: "About GENESIS",
      body: "GENESIS is TSI's annual project showcase: a live, interactive demo day where our student teams unveil the software, hardware, and AI systems they've spent the year building for nonprofit partners. Think science fair meets tech conference — attendees walk booth to booth, ask questions, and see the technology working in real time alongside the developers who built it.",
      subtitle: "GENESIS 2026 by the numbers",
      stats: [
        "330+ sign-ups",
        "250+ attendees, including developers, nonprofit executives, sponsors, and students",
        "Projects ranged from multi-agent AI platforms to a hardware spacewalk exhibit with a sensor glove and joystick",
      ],
    },
  },

  "vp-internal": {
    positionsCount: "1–2",
    tagline:
      "As VP Internal, you're the heartbeat of TSI. You keep the community alive, the calendar full, and make sure everyone — from first-year developers to execs — feels like they belong here.",
    whatYoullDo: [
      "Plan summer socials and events to kickstart community connection before the year begins.",
      "Plan and organize TSI's presence at Clubs Week, including booth logistics and the Annual General Meeting (AGM).",
      "Run at least one social event a month — potlucks, outings, parties, volunteer days, etc.",
      "Organize the TSI Cottage Trip from start to finish.",
      "Own the logistics of sending TSI projects to external demo days like Canadian Tech Summit and Socratica Symposium.",
      "Build and manage a team of directors, setting them up to do their best work.",
    ],
    whoYouAre: [
      "Organized and on top of your responsibilities.",
      "Passionate about people and genuinely care about building community.",
      "A leader who knows how to bring a team together.",
      "Detail-oriented, but still know how to keep things fun.",
      "Good vibes.",
    ],
  },

  "vp-marketing": {
    positionsCount: "2",
    tagline:
      "As VP Marketing, you own TSI's creative vision — from the posts that stop the scroll to the videos that tell our story. You'll take ideas from concept to execution and make sure TSI looks and feels like the world-class organization it is.",
    preApplyNote:
      "You don't need to do it all. We're not looking for someone who's touched every tool — we're looking for someone who has mastered one skill: design, videography, photography, or content creation. We want you to be genuinely elite at your craft and confident about it. A jack of all trades is not what we need here. If you're the best designer in the room, or you make videos that people actually watch till the end, that's who we're looking for.",
    whatYoullDo: [
      "Lead TSI's rebranding package over the summer.",
      "Design sponsorship and partnership packages that represent TSI professionally.",
      "Create and design posts for TSI's social media.",
      "Produce short vlogs and mini-documentaries for each project team and the club overall.",
      "Make reels that get people talking.",
      "Design merch materials for GENESIS, TSI's annual project showcase.",
      "Bring creative ideas that build buzz around TSI.",
      "Build and manage a team of directors, setting them up to do their best work.",
    ],
    whoYouAre: [
      "Have taste.",
      "Master of at least one: graphics (Figma, Photoshop), videography, photography, or content creation.",
      "Bonus points if you bring more than one skill to the table.",
      "Organized and can manage multiple creative projects at once.",
      "A leader who can give clear direction to a team.",
    ],
    applyInstructions:
      "Show us, don't just tell us. Along with your essays, share a link to a creative piece — in whatever medium is your strength — that makes the case for why you're the one for this role.",
  },
};

export function getRoleContent(slug: string): RoleContent | null {
  return ROLE_CONTENT[slug] ?? null;
}
