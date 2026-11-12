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
  /** A photo of the team (or its project), from the club's own photos. */
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
      { client: "World Vision", slug: "world-vision", logo: "/logos/projects/world-vision.svg", mark: "WV", built: "An internal multi-agent platform and reusable workflows that speed up research, segmentation and project discovery." },
      { client: "International Rescue Committee", slug: "irc", logo: "/logos/projects/irc.svg", mark: "IRC", built: "A pipeline that uses language models to turn inconsistent provider spreadsheets into one standard format, ready for a database." },
      { client: "London Children's Museum", slug: "lcm", logo: "/logos/projects/lcm.png", mark: "LCM", built: "A spacewalk repair exhibit: kids use a sensor glove and a joystick to control a virtual hand." },
      { client: "ChildCan", slug: "childcan", logo: "/logos/projects/childcan.png", mark: "CC", built: "A website redesign and migration for better accessibility, navigation, donations and resources." },
      { client: "Plan International", slug: "plan-international", logo: "/logos/projects/plan-international.svg", mark: "PI", built: "A web app that replaces a legacy reconciliation tool and automates monthly expense intake, calculations and reports." },
      { client: "Plan Catalyst", slug: "plan-catalyst", logo: "/logos/projects/plan-catalyst.png", logoDark: true, mark: "PC", built: "A cloud pipeline and machine-learning forecasts of public development indicators, shown on an interactive map." },
      { client: "Canadian Red Cross", slug: "red-cross", mark: "CRC", built: "SharePoint tagging, better search and automated reminders, so teams find accurate internal resources faster." },
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
      { client: "Jet Aircraft Museum", slug: "jam", logo: "/logos/projects/jam.png", mark: "JAM", built: "An interactive exhibit triggered by RFID tags, and a website redesign." },
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
export const ALUMNI_COMPANIES: readonly { name: string; logo: string }[] = [
  { name: "Meta", logo: "/logos/alumni/meta.svg" },
  { name: "Apple", logo: "/logos/alumni/apple.svg" },
  { name: "Shopify", logo: "/logos/alumni/shopify.svg" },
  { name: "AMD", logo: "/logos/alumni/amd.svg" },
  { name: "IBM", logo: "/logos/alumni/ibm.svg" },
  { name: "Y Combinator", logo: "/logos/alumni/ycombinator.svg" },
  { name: "RBC", logo: "/logos/alumni/rbc.svg" },
  { name: "TD", logo: "/logos/alumni/td.svg" },
  { name: "Scotiabank", logo: "/logos/alumni/scotiabank.svg" },
  { name: "KPMG", logo: "/logos/alumni/kpmg.svg" },
];
