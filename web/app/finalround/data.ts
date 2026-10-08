export const TIME_LIMIT_SECONDS = 60;
export const MAX_ATTEMPTS = 5;
export const CODE_LENGTH = 6;
// Greens the rig aims to hand out on each guess, so it always feels closer.
// The last attempt is never submitted: the clock runs out as it is typed.
export const MIN_GREENS = [1, 2, 3, 5];

export const CLOSER = ["Getting closer.", "You're onto something.", "Closer. Keep going."];

export const NEAR_MISS = [
  "One digit away.",
  "So close. Your logic holds.",
  "One digit. Think.",
  "Almost there.",
];

// TODO: monthly townhall LettuceMeet link still pending.
export const ONBOARDING = [
  {
    title: "Join the Discord",
    cta: "Join Discord",
    body: "New to TSI? Introduce yourself in #introduction. Returning member? Message Alice and she'll give you the Developer role.",
    href: "https://discord.gg/WxRWE2Vmx",
  },
  {
    title: "Pick your first townhall time",
    cta: "Open LettuceMeet",
    body: "Fill out the LettuceMeet for the first townhall on Oct 24 or 25 with the times you're free.",
    href: "https://lettucemeet.com/l/6WRlV",
  },
  {
    title: "Set your monthly townhall availability",
    cta: "Open LettuceMeet",
    body: "Fill out the LettuceMeet for the recurring monthly townhall.",
    href: "",
  },
  {
    title: "Fill out the team directory",
    cta: "Open directory",
    body: "Add yourself so your team can find you.",
    href: "https://docs.google.com/spreadsheets/d/1fN1lbPREbEYDsZ4QgfDHjRHSw0qcJccI2RrO5ggzTXY/edit?usp=sharing",
  },
];
