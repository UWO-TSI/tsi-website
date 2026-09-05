// Long-form, role-specific content for the apply portal.
// The DB stores only short fields (description, essay_questions).
// Anything richer — bullet lists, callouts, role-specific notes —
// lives here and is keyed by position slug.
//
// Updates require redeploy. That's fine for ~3 roles per cycle.
//
// IMPORTANT: copy is reproduced verbatim from the finalized posting.
// Don't add periods to bullets, don't restructure sentences,
// don't substitute punctuation. Word-for-word matters here.

export interface AboutCallout {
  title: string;
  body: string;
  subtitle?: string;
  stats?: string[];
}

export interface RoleContent {
  /** Display string like "2" or "1–2" (en-dash) — appears next to "Positions". */
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
      "As VP External, you're the face of TSI to the world. You'll build the partnerships that power our projects and lead GENESIS Project Showcase, TSI's biggest & most exciting event of the year, from concept to execution.",
    whatYoullDo: [
      "Source and secure non-profit project clients locally and globally, from building outreach lists to hopping on calls and closing partnerships over the summer",
      "Develop a compelling project partnership package and sponsorship package that represent TSI's value to the outside world",
      "Own GENESIS Project Showcase end-to-end, from logistics, sponsorships, to all the details that make it unforgettable",
      "Work cross-functionally with operations and project teams to keep everything aligned",
      "Cultivate relationships with organizations inside and outside of Western and London",
    ],
    whoYouAre: [
      "Organized and on top of your responsibilities",
      "A strong communicator who can hold a client call just as well as write an outreach email",
      "Detail-oriented, but can still see the bigger picture",
      "A leader who knows how to build and motivate a team",
      "Someone who brings new ideas to the table and follows through on them",
    ],
    about: {
      title: "About GENESIS",
      body: "GENESIS is TSI's annual project showcase: a live, interactive demo day where our student teams unveil the software, hardware, and AI systems they've spent the year building for nonprofit partners. Think science fair meets tech conference: attendees walk booth to booth, ask questions, and see the technology working in real time alongside the developers who built it.",
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
      "As VP Internal, you're the heartbeat of TSI. You keep the community alive, the calendar full, and make sure everyone from first-year developers to execs feels like they belong here.",
    whatYoullDo: [
      "Plan summer socials and events to kickstart community connection before the year begins",
      "Plan and organize TSI's presence at Clubs Week, including booth logistics and the Annual General Meeting (AGM)",
      "Run at least one social event a month, could be anything from potlucks, outings, parties, volunteer days, etc.",
      "Organize the TSI Cottage Trip from start to finish",
      "Own the logistics of sending TSI projects to external demo days like Canadian Tech Summit and Socratica Symposium",
      "Build and manage a team of directors, setting them up to do their best work",
    ],
    whoYouAre: [
      "Organized and on top of your responsibilities",
      "Passionate about people and genuinely care about building community",
      "A leader who knows how to bring a team together",
      "Detail-oriented, but still know how to keep things fun",
      "Good vibes",
    ],
  },

  "pm-internal": {
    positionsCount: "Multiple",
    tagline:
      "As a Project Manager at TSI, you're the CEO of your own project. You own it end to end, leading a team of developers building real software for real nonprofit clients, from the first kickoff call to the final delivery at GENESIS.",
    whatYoullDo: [
      "Own the full project lifecycle, from initiation to delivery, keeping deadlines and quality standards on point",
      "Lead and mentor your team of developers, helping them grow while keeping the project moving",
      "Run weekly team meetings and facilitate bi-weekly or monthly client check-ins",
      "Build and maintain a strong relationship with your nonprofit client, making sure you understand their needs, and they trust your team",
      "Keep the broader TSI community in the loop on your project's progress, wins, and challenges",
      "Organize socials within your project team and make sure your team shows up for club-wide events",
    ],
    whoYouAre: [
      "Has strong technical skills",
      "A strong leader",
      "Organized",
      "Goes above and beyond",
    ],
    preApplyNote:
      "One thing to know: this role comes with a high degree of autonomy. You won't be micromanaged. You're expected to make decisions, manage your project independently, and keep both your team and your client moving forward.",
    about: {
      title: "What you might build",
      body: "Projects span multiple disciplines, shaped by what nonprofits need that semester. Recent and upcoming examples:",
      stats: [
        "AI",
        "Web development",
        "Data dashboards",
        "Hardware",
        "Anything else a nonprofit needs",
      ],
    },
  },

  advisor: {
    positionsCount: "Flexible",
    tagline:
      "This isn't your typical Senior Advisor role. As a TSI Advisor, you're actively involved, have access to TSI chats, and play a real role in high-level decision-making. Think board of advisors, but you're actually doing things.",
    preApplyNote:
      "How it works: you'll come in with at least one concrete idea you want to build or improve at TSI, whether that's your own idea or something from the list, and actually implement it. Highly flexible, perfect for past execs who want to keep contributing to TSI's growth without being tied to a specific project or portfolio.",
    whatYoullDo: [
      "Bring at least one concrete idea you want to build or improve at TSI, and ship it",
      "Get involved in high-level decisions across the org",
      "Actively participate in TSI chats and ongoing conversations",
      "Help shape where TSI goes next",
    ],
    whoYouAre: [
      "Past TSI exec who wants to keep contributing",
      "Has at least one concrete idea you've been wanting to ship",
      "Self-directed: you bring the idea, you do the work",
      "Comfortable with ambiguity and full ownership",
    ],
    about: {
      title: "Examples of ideas",
      body: "Just a starting point. If you've got something you've been wanting to build or improve at TSI, this is your chance.",
      stats: [
        "Build out TSI's internal systems",
        "Develop a TSI Alumni Network on the website",
        "Create a training program for new PMs and developers",
        "Run a bi-weekly or monthly workshop series (technical, career, leadership, you pick)",
        "Develop hardware project training (train incoming hardware devs and PMs)",
        "Automate TSI's grants application process",
        "Make a TSI rap song",
        "Or something else entirely, bring your own idea",
      ],
    },
  },

  // May 2026 round, kept for the retired `vp-marketing-may26` row.
  "vp-marketing-may26": {
    positionsCount: "2",
    tagline:
      "As VP Marketing, you own TSI's creative vision, from the posts that stop the scroll to the videos that tell our story. You'll take ideas from concept to execution and make sure TSI looks and feels like the world-class organization it is.",
    preApplyNote:
      "You don't need to do it all. We're not looking for someone who's touched every tool. We're looking for someone who has mastered one skill, whether that's design, videography, photography, or content creation. We want you to be genuinely elite at your craft and confident about it. A jack of all trades is not what we need here. If you're the best designer in the room, or you make videos that people actually watch till the end, that's who we're looking for.",
    whatYoullDo: [
      "Lead TSI's rebranding package over the summer",
      "Design sponsorship and partnership packages that represent TSI professionally",
      "Create and design posts for TSI's social media",
      "Produce short vlogs and mini-documentaries for each project team and the club overall",
      "Make reels that get people talking",
      "Design merch materials for GENESIS, TSI's annual project showcase",
      "Bring creative ideas that build buzz around TSI",
      "Build and manage a team of directors, setting them up to do their best work",
    ],
    whoYouAre: [
      "Have taste",
      "You are a master of at least one: graphics (Figma, Photoshop), videography, photography, or content creation",
      "Bonus points if you bring more than one skill to the table",
      "Organized and can manage multiple creative projects at once",
      "A leader who can give clear direction to a team",
    ],
    applyInstructions:
      "Show us, don't just tell us. Submit a creative piece, in whatever medium is your strength, that makes the case for why you're the one for this role.",
  },

  // Fall 2026 round (migration 027). Copy from "Hiring Descriptions" →
  // Polished → Co-VP Marketing - Video & Content.
  "vp-marketing": {
    positionsCount: "1",
    tagline:
      "As VP Marketing (Video & Content), you own how TSI moves and sounds. You'll tell TSI's story through reels, vlogs, and mini-documentaries that make people stop scrolling and actually watch.",
    preApplyNote:
      "We already have our VP Marketing (Design) locked in. Now we're looking for the other half, someone who lives and breathes video and content creation.",
    whatYoullDo: [
      "Produce short vlogs and mini-documentaries for each project team and the club overall",
      "Make reels that get people talking",
      "Capture TSI events, socials, and GENESIS on video",
      "Collaborate closely with the design VP to make sure visuals and video feel cohesive",
      "Bring creative ideas that build buzz around TSI",
    ],
    whoYouAre: [
      "Someone who has taste",
      "You enjoy making videos and creating content",
      "Someone who has a natural eye for storytelling",
      "Organized and can manage multiple projects at once",
      "A good leader who can give clear direction to a team & has good comms skills",
    ],
    applyInstructions:
      "Show don't tell. Submit a video or reel that makes the case for why you're the one for this role.",
  },
};

// Fall 2026 round (migration 027): the public PM role lives on the `pm`
// slug; it shares the copy written for the May internal PM track.
ROLE_CONTENT.pm = ROLE_CONTENT["pm-internal"];

export function getRoleContent(slug: string): RoleContent | null {
  return ROLE_CONTENT[slug] ?? null;
}
