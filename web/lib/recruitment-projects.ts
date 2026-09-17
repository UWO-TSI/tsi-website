// Project descriptions supplied by David on 2026-09-16.
export const DEVELOPER_PROJECTS = [
  {
    partner: "Boys and Girls Club London", title: "MAP Program App",
    paragraphs: [
      "BGC London has been running since 1956. It employs more than 35 full-time and 40 part-time staff, and its Supper Club nutrition program serves over 16,000 meals each school year, plus another 18,000 snacks over the summer. In one evening the Strupat Foundation donated $1 million to MAP alone.",
      "MAP is My Action Plan to Education. It supports students from Grade 4 through post-secondary, and the roughly 200 currently enrolled are split across three pathways: tutoring only, tutoring plus workshops toward a completion certificate, or the full track that accumulates points toward scholarship eligibility.",
      "All of it currently lives on a website nobody has time to update.",
      "The app centralizes registration, communications, each student's action plan, and progress against pathway requirements. Tutoring booking sits inside it. Tutors post availability, students claim a slot and write what they need help with so the tutor can prepare instead of improvising.",
      "Pathway 3 students earn points toward scholarship eligibility, so there's a possible gamification component in how that progress gets surfaced. In junior MAP, Grades 4 to 8, the parent manages the account. In senior MAP, Grades 9 to 12, the student takes it over. The profile carries across that transition, so a student arriving in Grade 9 already has years of history behind them, and the app has to hand control from one person to another without losing any of it.",
    ],
  },
  {
    partner: "ArkAid", title: "Kitchen Dashboard",
    paragraphs: [
      "Ark Aid Mission operates out of 696 Dundas Street. Dinner service runs seven days a week, laundry and showers five days, and the Out of the Cold program runs 24 hours a day from December 1 to March 31. Meal volumes doubled after the pandemic, from around 100 to between 100 and 230.",
      "Then this happened: on April 1, 2026, the City of London withdrew core funding for daytime services at 696 Dundas, roughly one-third of operations, over $1 million a year. Council approved bridge funding on April 28. Grant reporting is not an administrative nicety for them right now.",
      "Meal tracking is manual, spread across Google Sheets and Forms. When a funder asks how many meals went out last quarter, or what was in them, someone goes and counts.",
      "You'd build a dashboard for the kitchen: meals produced, people served, what's in the meals, the types of meals being served, and inventory on hand. You'd also build what feeds it, which is the harder half. Logging that survives a busy service, filled in by whoever is on shift, without adding a clipboard step to a kitchen that's already stretched.",
    ],
  },
  {
    partner: "Grand Theatre", title: "Carbon and Energy Dashboard",
    paragraphs: [
      "The Grand opened on September 9, 1901. It's a not-for-profit professional theatre with two stages, the 839-seat Spriet and the 144-seat Auburn, running a September to May season, and it produces its own work rather than just hosting tours.",
      "Emissions tracking happens in one Excel workbook. Each department types its numbers in, line by line. Staff who aren't fluent in spreadsheets are effectively locked out of it.",
      "Two pieces. The first replaces the workbook with a proper entry frontend plus reporting and charts. The second is more interesting: the building runs a Building Automation System recording live electrical draw and heat pump temperatures on every floor. Enormous detail, zero usable insight. You'd pull that stream in and surface where energy and money are leaking. What's actually possible depends on what the BAS will export, and the team needs that answer in week two, not week ten.",
    ],
  },
  {
    partner: "Brain Tumour Foundation of Canada", title: "Walk Support Hub",
    paragraphs: [
      "National charity, founded in 1982, with its head office at 205 Horton Street East in London. 25 employees. Funded entirely by donations, memorial gifts, planned giving, and events. 27 Canadians are diagnosed with a brain tumour every day, across 120 tumour types.",
      "The Brain Tumour Walk is their largest volunteer-led, peer-to-peer fundraiser. Roughly 25 walks, most of them in June, generating most of the year's revenue. Six of them are in-person flagship events in London, Toronto, Calgary, Edmonton, Ottawa, and Winnipeg, with the rest community-hosted.",
      "The hub handles registration, donations, volunteer assignments, and point of sale during events. Staff and volunteers are scattered across the country on walk days and need live access to procedures, current registration data, and who's assigned where. It pulls from Raiser's Edge, their donor platform. It has to work in June, at volume, in the hands of volunteers who have never opened it before and will not be trained.",
    ],
  },
  {
    partner: "Growing Chefs!", title: "Dietary Restriction System",
    paragraphs: [
      "Incorporated in 2008, a registered charity in London that connects chefs, growers, and educators through children's food education. Over 110,000 children and youth have come through their programs. Last year they delivered 125,000 scratch-made lunches to local schools, generating $1.2 million in revenue, with more than 40% of ingredients sourced from Ontario producers.",
      "Up to 800 meals a day, across daycares, public schools, and private schools. Every new site fills out JotForm intakes for each student. Those feed a spreadsheet that gets updated daily, and chefs spend 30 to 60 minutes every morning reading it before they cook. All meat is halal and nuts are already out of the kitchen, which covers the common cases. It does not cover anaphylaxis. They have sent a child to hospital.",
      "You'd build the system that replaces that morning read: what a specific child cannot eat, and what to substitute for a given ingredient. Real Food for Real Kids runs something similar, but licensing and scale put it out of reach for Growing Chefs right now.",
    ],
  },
];
