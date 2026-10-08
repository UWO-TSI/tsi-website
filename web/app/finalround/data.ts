export const TIME_LIMIT_SECONDS = 180;
export const MAX_ATTEMPTS = 8;

export const NEAR_MISS = [
  "One digit away.",
  "So close. Your logic holds.",
  "One digit. Think.",
  "Almost there.",
];

// TODO: replace with the real onboarding steps and links.
export const ONBOARDING = [
  { title: "Join the Discord", body: "Your private onboarding channel is waiting.", href: "" },
  { title: "Introduce yourself", body: "Say hi and tell us what you want to build.", href: "" },
  { title: "Show up to kickoff", body: "Date and location drop in Discord.", href: "" },
];

export function teamStep(project: string) {
  return {
    title: project ? `Meet your ${project} lead` : "Meet your team lead",
    body: `Your ${project || "team"} lead will DM you within 48 hours.`,
    href: "",
  };
}
