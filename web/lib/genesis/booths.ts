/**
 * The five GENESIS 2027 booths (the 2026-27 projects). The copy is Claude's draft from the club's own project write-ups
 * (lib/recruitment-projects.ts, David, 2026-09-16), rewritten for guests; David edits it before GENESIS. The slug is the
 * booth sticker's link: genesis.tethos.ca/s/<slug>.
 */
export type Booth = {
  slug: string; nonprofit: string; project: string; line: string; logo: string; site: string;
  nonprofitAbout: string; problem: string; built: string;
};

export const BOOTHS: readonly Booth[] = [
  {
    slug: "bgc", nonprofit: "Boys and Girls Club London", project: "MAP Program App", logo: "/logos/partners/bgc.svg", site: "https://www.bgclondon.ca/",
    line: "One place for the MAP program: registration, each student's action plan, tutoring and progress.",
    nonprofitAbout: "BGC London has been running since 1956. MAP, My Action Plan to Education, supports about 200 students from Grade 4 through post-secondary, across three pathways from tutoring to a full track toward scholarship eligibility.",
    problem: "All of MAP lived on a website nobody had time to update.",
    built: "An app that brings together registration, messages, each student's action plan and their progress on their pathway, with tutoring booking built in: tutors post their times, students claim a slot and say what they need help with. Parents run the account in junior MAP and students take it over in Grade 9, keeping their whole history.",
  },
  {
    slug: "ark-aid", nonprofit: "Ark Aid Mission", project: "Kitchen Dashboard", logo: "/logos/partners/arkaid.svg", site: "https://arkaidmission.ca/",
    line: "A dashboard for the kitchen: meals made, people served, what goes in, what's on hand.",
    nonprofitAbout: "Ark Aid Mission serves dinner seven days a week from 696 Dundas Street, with laundry, showers and the Out of the Cold program through the winter. Meal volumes doubled after the pandemic.",
    problem: "Meal tracking was manual, spread across spreadsheets and forms. When a funder asked how many meals went out last quarter, someone had to go and count.",
    built: "A kitchen dashboard showing meals produced, people served, what's in the meals and the inventory on hand, and the logging that feeds it: quick enough for whoever is on shift during a busy service.",
  },
  {
    slug: "grand-theatre", nonprofit: "Grand Theatre", project: "Carbon and Energy Dashboard", logo: "/logos/partners/grand-theatre.svg", site: "https://www.grandtheatre.com/",
    line: "A carbon and energy dashboard that replaces an emissions spreadsheet.",
    nonprofitAbout: "The Grand opened in 1901. It's a not-for-profit professional theatre with two stages that produces its own work, September to May.",
    problem: "Emissions were tracked in one Excel workbook, each department typing in its numbers line by line, which locked out anyone not fluent in spreadsheets.",
    built: "A proper way to enter the numbers, with reports and charts, plus the building's own live energy data pulled in to show where energy and money are being lost.",
  },
  {
    slug: "brain-tumour", nonprofit: "Brain Tumour Foundation of Canada", project: "Walk Support Hub", logo: "/logos/partners/brain-tumour.svg", site: "https://www.braintumour.ca/",
    line: "A support hub for the Brain Tumour Walk: registration, donations, volunteers.",
    nonprofitAbout: "A national charity founded in 1982 with its head office in London, funded entirely by donations and events. The Brain Tumour Walk, about 25 walks across the country, is its biggest fundraiser.",
    problem: "On walk days, staff and volunteers are spread across the country and need live access to procedures, registrations and who is assigned where.",
    built: "One hub for registration, donations, volunteer assignments and sales during the walks, connected to the foundation's donor platform and simple enough for a volunteer opening it for the first time.",
  },
  {
    slug: "growing-chefs", nonprofit: "Growing Chefs!", project: "Dietary Restriction System", logo: "/logos/partners/growing-chefs.svg", site: "https://www.growingchefs.ca/",
    line: "A system that tells chefs what a child can't eat and what to substitute.",
    nonprofitAbout: "Growing Chefs! connects chefs, growers and educators through children's food education, and cooks up to 800 scratch-made lunches a day for daycares and schools.",
    problem: "Each child's dietary needs sat in a spreadsheet that chefs spent 30 to 60 minutes reading every morning before they could start cooking.",
    built: "A system that replaces that morning read: what a specific child cannot eat, and what to substitute for a given ingredient.",
  },
];

export const boothBySlug = (slug: string) => BOOTHS.find((b) => b.slug === slug) ?? null;
