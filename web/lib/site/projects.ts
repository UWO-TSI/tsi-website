/**
 * Every project TSI teams have built, by year, from the club's own records: the 2026 and 2027 GENESIS sponsorship
 * packages, the 2026-27 project list (lib/recruitment-projects.ts), the first site's project pages and the project
 * channels in the club's Discord. Each line says only what the team built; nothing here is estimated.
 */
/** `mark`: the short name drawn in characters on the file's cover (the club's own abbreviations where it has them). */
export type ArchiveProject = {
  client: string;
  slug: string;
  mark: string;
  built: string;
  teams?: number;
  /** The client's logo, shown as a sticker on the file; `logoDark` puts a white logo on a dark sticker. */
  logo?: string;
  logoDark?: boolean;
  /** The team, from the club's own photos (GENESIS 2026, and JAM's 2024-25 folder); checked against a sign in the shot. */
  photo?: string;
};
export type ArchiveYear = { year: string; note: string; projects: readonly ArchiveProject[] };

export const PROJECT_YEARS: readonly ArchiveYear[] = [
  {
    year: "2026–27",
    note: "Building now",
    projects: [
      { client: "Boys and Girls Club London", slug: "bgc-2026", logo: "/logos/partners/bgc.svg", mark: "BGC", built: "The MAP Program App: registration, each student's action plan, tutoring bookings and progress toward scholarship eligibility, in one app." },
      { client: "Ark Aid Mission", slug: "ark-aid", logo: "/logos/partners/arkaid.svg", mark: "AAM", built: "A kitchen dashboard for meals produced, people served, what goes into the meals and inventory on hand, plus the logging behind it." },
      { client: "Grand Theatre", slug: "grand-theatre", logo: "/logos/partners/grand-theatre.svg", mark: "GT", built: "A carbon and energy dashboard that replaces an emissions spreadsheet and pulls in the building's live energy data." },
      { client: "Brain Tumour Foundation of Canada", slug: "brain-tumour", logo: "/logos/partners/brain-tumour.svg", mark: "BTF", built: "A support hub for the Brain Tumour Walk: registration, donations, volunteer assignments and point of sale." },
      { client: "Growing Chefs!", slug: "growing-chefs", logo: "/logos/partners/growing-chefs.svg", mark: "GC", built: "A dietary restriction system that tells chefs what a child can't eat and what to substitute." },
    ],
  },
  {
    year: "2025–26",
    note: "Shown at GENESIS 2026",
    projects: [
      { client: "World Vision", slug: "world-vision", photo: "/images/site/projects/world-vision.webp", logo: "/logos/projects/world-vision.svg", mark: "WV", built: "An internal multi-agent platform and reusable workflows that speed up research, segmentation and project discovery." },
      { client: "International Rescue Committee", slug: "irc", photo: "/images/site/projects/irc.webp", logo: "/logos/projects/irc.svg", mark: "IRC", built: "A pipeline that uses language models to turn inconsistent provider spreadsheets into one standard format, ready for a database." },
      { client: "London Children's Museum", slug: "lcm", photo: "/images/site/projects/lcm.webp", logo: "/logos/projects/lcm.png", mark: "LCM", built: "A spacewalk repair exhibit: kids use a sensor glove and a joystick to control a virtual hand." },
      { client: "ChildCan", slug: "childcan", photo: "/images/site/projects/childcan.webp", logo: "/logos/projects/childcan.png", mark: "CC", built: "A website redesign and migration for better accessibility, navigation, donations and resources." },
      { client: "Plan International", slug: "plan-international", photo: "/images/site/projects/plan-international.webp", logo: "/logos/projects/plan-international.svg", mark: "PI", built: "A web app that replaces a legacy reconciliation tool and automates monthly expense intake, calculations and reports." },
      { client: "Plan Catalyst", slug: "plan-catalyst", photo: "/images/site/projects/plan-catalyst.webp", logo: "/logos/projects/plan-catalyst.png", logoDark: true, mark: "PC", built: "A cloud pipeline and machine-learning forecasts of public development indicators, shown on an interactive map." },
      { client: "Canadian Red Cross", slug: "red-cross", photo: "/images/site/projects/red-cross.webp", mark: "CRC", built: "SharePoint tagging, better search and automated reminders, so teams find accurate internal resources faster." },
    ],
  },
  {
    year: "2024–25",
    note: "The first year",
    projects: [
      { client: "Daya Counselling Centre", slug: "daya", logo: "/logos/projects/daya.png", mark: "DAYA", built: "A redesign and upgrade of its WordPress site." },
      { client: "Youth Opportunities Unlimited", slug: "you", logo: "/logos/projects/you.png", mark: "YOU", built: "A workflow tool for workshop tasks that ties them to skills and issues completion certificates." },
      { client: "Boys and Girls Club London", slug: "bgc-2024", logo: "/logos/projects/bgc-2024.png", mark: "BGC", built: "Campaign tracking: a link and a QR code for every channel, all landing on one tracked page." },
      { client: "Thames Region Ecological Association", slug: "trea", logo: "/logos/projects/trea.png", mark: "TREA", built: "A circular-economy website it can run itself, and a social media plan." },
      { client: "United Way Elgin-Middlesex", slug: "united-way", logo: "/logos/projects/united-way.png", mark: "UW", built: "A leaderboard app for the TD StairClimb fundraiser." },
      { client: "Jet Aircraft Museum", slug: "jam", photo: "/images/site/projects/jam.webp", logo: "/logos/projects/jam.png", mark: "JAM", built: "An interactive exhibit triggered by RFID tags, and a website redesign." },
      { client: "GO Hockey", slug: "go-hockey", logo: "/logos/projects/go-hockey.png", mark: "GO", built: "A membership website with registration, admin controls and checkout." },
      { client: "EmpowHER TO", slug: "empowher", logo: "/logos/projects/empowher.png", mark: "EHTO", built: "A website with FAQ pages and an admin dashboard, from one of its two teams.", teams: 2 },
      { client: "Fund Homecare Canada", slug: "fund-homecare", logo: "/logos/projects/fund-homecare.png", mark: "FHC", built: "A weekly grant scraper and dashboard, a website redesign and an analytics prototype.", teams: 3 },
      { client: "Western Sales Club", slug: "wsc", logo: "/logos/projects/wsc.png", mark: "WSC", built: "A website and an event-management app." },
    ],
  },
];

/**
 * Where members and alumni have worked: the list in the club's 2026-27 GENESIS sponsorship package ("Our members and
 * alumni have worked at"). Logos: Simple Icons (CC0) for Meta, AMD, Shopify, Apple and Y Combinator; Wikimedia Commons
 * for IBM, TD, KPMG and Scotiabank; RBC's own site for RBC.
 */
/** A logo on a wall: `logo` is drawn in characters, `color` is the real logo shown on hover, `href` its site. */
export type WallLogo = { name: string; logo: string; color?: string; href?: string };

export const ALUMNI_COMPANIES: readonly WallLogo[] = [
  { name: "Meta", logo: "/logos/alumni/meta.svg", color: "/logos/alumni/color/meta.svg" },
  { name: "Apple", logo: "/logos/alumni/apple.svg", color: "/logos/alumni/color/apple.svg" },
  { name: "Shopify", logo: "/logos/alumni/shopify.svg", color: "/logos/alumni/color/shopify.svg" },
  { name: "AMD", logo: "/logos/alumni/amd.svg", color: "/logos/alumni/color/amd.svg" },
  { name: "IBM", logo: "/logos/alumni/ibm.svg", color: "/logos/alumni/color/ibm.svg" },
  { name: "Y Combinator", logo: "/logos/alumni/ycombinator.svg", color: "/logos/alumni/color/ycombinator.svg" },
  { name: "RBC", logo: "/logos/alumni/rbc.svg", color: "/logos/alumni/color/rbc.svg" },
  { name: "TD", logo: "/logos/alumni/td.svg", color: "/logos/alumni/color/td.svg" },
  { name: "Scotiabank", logo: "/logos/alumni/scotiabank.svg", color: "/logos/alumni/color/scotiabank.svg" },
  { name: "KPMG", logo: "/logos/alumni/kpmg.svg", color: "/logos/alumni/color/kpmg.svg" },
];

/**
 * Every nonprofit a team has built for, once each, newest first, for the logo wall on /npo. Western Sales Club (a
 * student club) and Plan Catalyst (Plan International's for-profit arm) aren't nonprofits, and the Red Cross emblem
 * can't be used without the Red Cross's permission, so those three aren't on it.
 */
const NOT_ON_WALL = new Set(["wsc", "plan-catalyst"]);
/** Each nonprofit's own site (checked live, 2026-11-12). */
const SITES: Record<string, string> = {
  "bgc-2026": "https://www.bgclondon.ca/",
  "ark-aid": "https://arkaidmission.ca/",
  "grand-theatre": "https://www.grandtheatre.com/",
  "brain-tumour": "https://www.braintumour.ca/",
  "growing-chefs": "https://www.growingchefs.ca/",
  "world-vision": "https://www.worldvision.ca/",
  irc: "https://www.rescue.org/",
  lcm: "https://www.londonchildrensmuseum.ca/",
  childcan: "https://childcan.com/",
  "plan-international": "https://plancanada.ca/",
  daya: "https://www.dayacounselling.on.ca/",
  you: "https://www.you.ca/",
  trea: "https://www.trea.ca/",
  "united-way": "https://unitedwayem.ca/",
  jam: "https://jetaircraftmuseum.ca/",
  "go-hockey": "https://gohockey.org/",
  empowher: "https://www.empowherto.org/",
  "fund-homecare": "https://www.fundhomecare.ca/",
};
const SVG_COLOR = new Set(["world-vision", "irc", "plan-international"]);
export const BUILT_FOR: readonly WallLogo[] = PROJECT_YEARS.flatMap((y) => y.projects)
  .filter((p) => p.logo && !NOT_ON_WALL.has(p.slug))
  .filter((p, i, all) => all.findIndex((q) => q.client === p.client) === i)
  // Each one's icon (its mark alone, cropped from the logo and turned into black ink, so it reads in characters), and
  // its full logo in colour for the hover.
  .map((p) => ({ name: p.client, logo: `/logos/icons/${p.slug}.png`, color: `/logos/color/${p.slug}.${SVG_COLOR.has(p.slug) ? "svg" : "png"}`, href: SITES[p.slug] }));
