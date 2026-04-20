/**
 * Plain text logos for all partner/alumni/sponsor organizations.
 */

import { type LogoItem } from "@/components/ui/LogoLoop";

/* ── Carousel arrays ── */
export const ALUMNI_LOGOS: LogoItem[] = [
  { text: "Apple", title: "Apple" },
  { text: "YC", title: "Y Combinator" },
  { text: "KPMG", title: "KPMG" },
  { text: "RBC", title: "RBC" },
  { text: "BMO", title: "BMO" },
  { text: "CIBC", title: "CIBC" },
  { text: "TD", title: "TD" },
  { text: "IBM", title: "IBM" },
  { text: "AMD", title: "AMD" },
];

export const SPONSOR_LOGOS: LogoItem[] = [
  { text: "Apple", title: "Apple", icon: "/images/logos/apple.png" },
  { text: "Google", title: "Google", icon: "/images/logos/google.png" },
  { text: "Y Combinator", title: "Y Combinator", icon: "/images/logos/yc.png" },
];

export const NPO_LOGOS: LogoItem[] = [
  { text: "Gov of Canada", title: "Government of Canada", icon: "/images/logos/canada.png" },
  { text: "BMO", title: "BMO", icon: "/images/logos/bmo.png" },
  { text: "Ubit", title: "Ubit", icon: "/images/logos/ubit.png" },
];

// Order matters: at initial load the marquee sits at translate=0, and the mask
// fade zones occupy ~22% on each edge. That puts array indices ~4-8 in the
// visible CENTER band. FAANG + big tech are placed there so the first thing
// a user sees is Apple / Google / Amazon / Microsoft.
export const HERO_LOGOS: LogoItem[] = [
  // Edge fade-in (tier 3 — smaller brands absorb the left fade gracefully)
  { text: "AMD",          title: "AMD",                   icon: "/images/logos/svg/amd.svg",         scale: 0.95, colorMode: "solid" },
  { text: "Canada",       title: "Government of Canada",  icon: "/images/logos/svg/leaf.svg",        scale: 1.0,  colorMode: "solid" },
  { text: "Scotiabank",   title: "Scotiabank",            icon: "/images/logos/svg/scotiabank.svg",  scale: 1.15, colorMode: "solid" },
  { text: "BMO",          title: "BMO",                   icon: "/images/logos/svg/bmo.svg",         scale: 1.1,  colorMode: "two"   },

  // Visible center — FAANG + big tech
  { text: "Apple",        title: "Apple",                 icon: "/images/logos/svg/apple.svg",       scale: 1.15, colorMode: "solid" },
  { text: "Google",       title: "Google",                icon: "/images/logos/svg/google.svg",      scale: 1.0,  colorMode: "multi" },
  { text: "Amazon",       title: "Amazon",                icon: "/images/logos/svg/amazon.svg",      scale: 1.1,  colorMode: "solid" },
  { text: "Microsoft",    title: "Microsoft",             icon: "/images/logos/svg/microsoft.svg",   scale: 0.95, colorMode: "multi" },

  // Tier 2 — recognizable tech + finance
  { text: "Y Combinator", title: "Y Combinator",          icon: "/images/logos/svg/ycombinator.svg", scale: 0.9,  colorMode: "two"   },
  { text: "SAP",          title: "SAP",                   icon: "/images/logos/svg/sap.svg",         scale: 0.82, colorMode: "two"   },
  { text: "Lyft",         title: "Lyft",                  icon: "/images/logos/svg/lyft.svg",        scale: 1.05, colorMode: "solid" },
  { text: "Rivian",       title: "Rivian",                icon: "/images/logos/svg/rivian.svg",      scale: 1.0,  colorMode: "solid" },
  { text: "Riot",         title: "Riot Games",            icon: "/images/logos/svg/riot.svg",        scale: 1.15, colorMode: "two"   },
  { text: "Asana",        title: "Asana",                 icon: "/images/logos/svg/asana.svg",       scale: 1.25, colorMode: "multi" },
  { text: "KPMG",         title: "KPMG",                  icon: "/images/logos/svg/kpmg.svg",        scale: 1.0,  colorMode: "solid" },
];
