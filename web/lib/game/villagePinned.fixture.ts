/**
 * The village as it played at 80816727, before the main quest (generated from that commit's modules; lane main-quest).
 * villagePinned.test.ts holds today's village to it: its chapters' rows and every line its people say.
 */
/* eslint-disable */
export const VILLAGE_BASE = {
  "WREN_LINES": {
    "welcome": [
      "[happy] There you are! Bram said you'd be up. I'm Alice. I keep HQ running, more or less.",
      "First things first: the island register. Everyone who stays signs it.",
      "Just your world name. That's the one everybody here knows you by."
    ],
    "registered": [
      "[happy] That's you on the register, {name}.",
      "Your friend code's on your card now. Give it to anyone you want to find again.",
      "And your mailbox is set up out by the plaza. Letters from HQ land there. Mostly from me, sorry in advance."
    ],
    "club": [
      "Here's the part people miss. You're not only on the island's register. You're in the real club.",
      "Every real TSI event has a check-in code at the door. Scan it and you're checked in.",
      "That's what levels you up. Not fishing, not chores. Showing up."
    ],
    "realLife": [
      "The island measures you by what you do out there, not in here.",
      "Come and see something. The desk by the notice board."
    ],
    "founder": [
      "That's the Founder's desk. Nobody sits there.",
      "The Founder left it for whoever came next."
    ],
    "menu": [
      "Right. Practical things. {esc}",
      "That's your menu: the map, your quests and journal, your bag, friends and mail. Open the map for me."
    ],
    "map": [
      "[happy] That's the whole island. The village is open. The rest opens as the island gets to know you."
    ],
    "board": [
      "Last thing. The notice board on the back wall. Have a read."
    ],
    "goals": [
      "Those are the club goals. The café and the museum are the club's to fund.",
      "Deliveries at the monument count, and so does showing up to real events. Everyone's bit goes in the same pot."
    ],
    "farewell": [
      "That's you registered. Bring your first find to the museum shell, then come back and tell me.",
      "Oh, and you'll want more than a rod. Odile has a spare net and Pim always has a shovel. Ask them.",
      "[happy] Welcome to Tethos Island, {name}."
    ]
  },
  "HQ_TRACKER": {
    "report": "Report to Alice at HQ",
    "register": "Sign the island register",
    "checkin": "Find out about check-ins",
    "founder": "Look at the Founder's desk",
    "esc": "Open the menu ({esc})",
    "map": "Open the map",
    "board": "Read the notice board"
  },
  "TOOL_LINES": {
    "net": {
      "title": "Odile's bug net",
      "step": "Catch any bug",
      "offer": [
        "[happy] {name}! You're the one Bram brought in. Found anything with wings yet?",
        "No? You'll want a net. Here, my spare. It has seen a few summers.",
        "Catch any bug you like. Then have a proper look at it before you decide what it's for."
      ],
      "during": [
        "Any bug at all. The flowers by the pond are busy this time of day."
      ],
      "given": "Odile handed you her spare bug net.",
      "done": "The bug net is yours now. Odile says keep it."
    },
    "shovel": {
      "title": "Pim's shovel",
      "step": "Dig up one buried thing",
      "offer": [
        "[happy] A new face! Do you dig? Everybody should dig.",
        "Half this island is under the sand, and most of it is perfectly good. Perfectly good!",
        "Here, take the shovel. Dig up one thing, anything, and it's yours to keep."
      ],
      "during": [
        "Look for the little cracks in the ground. There's always something under there."
      ],
      "given": "Pim handed you a shovel.",
      "done": "The shovel is yours now. Pim says it's perfectly good."
    }
  },
  "RESIDENT_LINES": {
    "wren": {
      "talk": [
        [
          "[happy] {name}! Good timing.",
          "I just pinned something new on the notice board. Or I meant to. It's in one of these pockets.",
          "Club goals are coming along, by the way. Everything you chip in shows on the monument."
        ],
        [
          "If you ever lose track of what's next, your Journal has it.",
          "[surprised] Oh! And check the mailbox. Letters from HQ go there. I write most of them. Sorry about the handwriting."
        ],
        [
          "[sleepy] I was up early sorting the volunteer sign-ups.",
          "[happy] Worth it, though. Somebody's always building something here."
        ]
      ],
      "canned_dialogue": [
        "@morning Morning! The notice board has something new, I think. Probably.",
        "Club goals are coming along. Every bit helps.",
        "If you need anything, I'm usually at HQ. Or near it. Or looking for it."
      ]
    },
    "mayor": {
      "talk": [
        [
          "[happy] Ah, {name}. Stay a while, if you like.",
          "This island started as one bench and an argument about where HQ should go.",
          "We were all wrong, of course. It went exactly where it needed to be."
        ],
        [
          "Every club goal you finish, the island remembers.",
          "[happy] The club monument grows a little each time. I check on it every morning."
        ],
        [
          "The light here changes with the seasons. Have you noticed?",
          "[surprised] Autumn's my favourite. The whole path goes gold."
        ]
      ],
      "canned_dialogue": [
        "Welcome back. The light here changes with the season, have you noticed?",
        "Every board on that clubhouse was put up by someone who believed in this place.",
        "If you ever want to hear how this all started, you know where to find me."
      ]
    },
    "shopkeeper": {
      "talk": [
        [
          "Welcome. Browse if you must.",
          "I keep the shelves in order of usefulness. Nobody has ever noticed.",
          "[sad] I've started to take it personally."
        ],
        [
          "Selling your catches? The rarer ones fetch more.",
          "That isn't me being generous. It's the rules.",
          "[happy] I'm a little generous."
        ],
        [
          "[sleepy] Inventory day. I counted the hoodies twice.",
          "There are the same number of hoodies. There are always the same number of hoodies."
        ]
      ],
      "canned_dialogue": [
        "Welcome. Browse if you must.",
        "Everything here is, technically, for sale.",
        "The hoodie is a hoodie. It will keep you warm. That is the entire pitch."
      ]
    },
    "curator": {
      "talk": [
        [
          "[happy] {name}! Found anything with wings lately?",
          "The museum's cases are waiting. The first of every find you bring me goes on show.",
          "With a label. I write very good labels."
        ],
        [
          "Did you see the dragonflies by the pond? Odonata. Lovely things.",
          "[surprised] They can fly backwards, you know. I think about that a lot."
        ],
        [
          "If you catch something you've never seen before, bring it to me before you sell it.",
          "Once it's in a case, it belongs to the whole club."
        ]
      ],
      "canned_dialogue": [
        "Every case in there is waiting for something you'll find.",
        "Did you see the dragonflies by the pond? Odonata. Lovely.",
        "Bring me anything with wings. Or fins. Or a shell."
      ]
    },
    "wharf-keeper": {
      "talk": [
        [
          "Tide's turning. You can hear it if you listen.",
          "[happy] And the gulls are flying low. Rain by supper, mark my words."
        ],
        [
          "Boat's ready whenever you want to go home.",
          "Your island's out past the pier. Small, but the sunsets are all yours."
        ],
        [
          "[surprised] Caught anything big yet?",
          "Best fishing's off the end of the wharf at dawn. Don't tell anyone I told you."
        ]
      ],
      "canned_dialogue": [
        "Tide's turning. You can hear it if you listen.",
        "The gulls are low today. Rain by supper, mark my words.",
        "Boat's ready whenever you want to go home."
      ]
    },
    "oracle-keeper": {
      "talk": [
        [
          "The crystal is quiet today. It's listening.",
          "What would you ask it, if you knew it would answer?"
        ],
        [
          "Which way will you grow, {name}? The temple can help you see it.",
          "[happy] Not decide. Only see. The deciding is yours."
        ],
        [
          "Stars are just old light. So are good friends.",
          "[sleepy] I was up late on the temple steps again. Clear skies."
        ]
      ],
      "canned_dialogue": [
        "The crystal is quiet today. It's listening.",
        "Which way will you grow? Ask the temple.",
        "Stars are just old light. So are good friends."
      ]
    },
    "crafter": {
      "talk": [
        [
          "[happy] Found a perfectly good plank on the beach. Perfectly good!",
          "Bring me some wood and I'll show you a trick at the workbench."
        ],
        [
          "Measure twice, glue once. That's the whole secret.",
          "[surprised] Well. Most of it. The rest is snacks."
        ],
        [
          "Bottles wash up on the beach sometimes.",
          "Some have notes in them. Some have recipes. Keep your eyes open."
        ]
      ],
      "canned_dialogue": [
        "Found a perfectly good plank on the beach. Perfectly good!",
        "Bring me wood and I'll show you a trick.",
        "Measure twice, glue once."
      ]
    },
    "juniper": {
      "talk": [
        [
          "@morning [happy] Morning laps! Want to race to the pier?",
          "Kidding. Mostly. Stretch first, trust me."
        ],
        [
          "The sand's firmest right by the water.",
          "[happy] Best place on the island for a sprint. Try it!"
        ],
        [
          "[sleepy] I've been up since dawn. Is it lunch yet?",
          "No? Then one more lap."
        ]
      ],
      "canned_dialogue": [
        "@morning Morning laps! Want to race to the pier?",
        "Stretch first. Trust me.",
        "The sand's firmest right by the water."
      ]
    },
    "marlo": {
      "talk": [
        [
          "[happy] Hold still, you're in the shot.",
          "Kidding. Mostly. You do make a good shape for a sketch."
        ],
        [
          "I've drawn HQ forty times now.",
          "[sad] I'm not happy with any of them. That roof has a mind of its own."
        ],
        [
          "The pond looks different every hour.",
          "I'm out of the green pencil again. If you find one, it's mine."
        ]
      ],
      "canned_dialogue": [
        "Hold still, you're in the shot. Kidding. Mostly.",
        "The pond looks different every hour.",
        "I'm out of the green pencil again."
      ]
    },
    "nell": {
      "talk": [
        [
          "I named a star after the founders. The bright one over HQ, once it's dark.",
          "[happy] The fainter ones are for everyone who joined after. There's room for plenty more."
        ],
        [
          "[sleepy] Mornings are a rumour. I'm told they're nice.",
          "The island's best after dark anyway. The fireflies come out by the water."
        ],
        [
          "If you can't sleep, come and find me at the lamp bench.",
          "I'll show you the constellation that looks like a fishing rod."
        ]
      ],
      "canned_dialogue": [
        "See that one? I named it after the founders.",
        "The fireflies came out early tonight.",
        "Mornings are a rumour."
      ]
    }
  },
  "SWEEPER_LINES": [
    "Morning! Not open yet. Soon, I promise.",
    "Every board in there is new. I just keep sweeping the same three leaves.",
    "When we open, the window stools are yours. The light's best there.",
    "[happy] The chalkboard? I wrote it myself. Took three tries."
  ],
  "RESIDENT_TALK": {
    "wren": [
      [
        "[happy] {name}! Good timing.",
        "I just pinned something new on the notice board. Or I meant to. It's in one of these pockets.",
        "Club goals are coming along, by the way. Everything you chip in shows on the monument."
      ],
      [
        "If you ever lose track of what's next, your Journal has it.",
        "[surprised] Oh! And check the mailbox. Letters from HQ go there. I write most of them. Sorry about the handwriting."
      ],
      [
        "[sleepy] I was up early sorting the volunteer sign-ups.",
        "[happy] Worth it, though. Somebody's always building something here."
      ]
    ],
    "mayor": [
      [
        "[happy] Ah, {name}. Stay a while, if you like.",
        "This island started as one bench and an argument about where HQ should go.",
        "We were all wrong, of course. It went exactly where it needed to be."
      ],
      [
        "Every club goal you finish, the island remembers.",
        "[happy] The club monument grows a little each time. I check on it every morning."
      ],
      [
        "The light here changes with the seasons. Have you noticed?",
        "[surprised] Autumn's my favourite. The whole path goes gold."
      ]
    ],
    "shopkeeper": [
      [
        "Welcome. Browse if you must.",
        "I keep the shelves in order of usefulness. Nobody has ever noticed.",
        "[sad] I've started to take it personally."
      ],
      [
        "Selling your catches? The rarer ones fetch more.",
        "That isn't me being generous. It's the rules.",
        "[happy] I'm a little generous."
      ],
      [
        "[sleepy] Inventory day. I counted the hoodies twice.",
        "There are the same number of hoodies. There are always the same number of hoodies."
      ]
    ],
    "curator": [
      [
        "[happy] {name}! Found anything with wings lately?",
        "The museum's cases are waiting. The first of every find you bring me goes on show.",
        "With a label. I write very good labels."
      ],
      [
        "Did you see the dragonflies by the pond? Odonata. Lovely things.",
        "[surprised] They can fly backwards, you know. I think about that a lot."
      ],
      [
        "If you catch something you've never seen before, bring it to me before you sell it.",
        "Once it's in a case, it belongs to the whole club."
      ]
    ],
    "wharf-keeper": [
      [
        "Tide's turning. You can hear it if you listen.",
        "[happy] And the gulls are flying low. Rain by supper, mark my words."
      ],
      [
        "Boat's ready whenever you want to go home.",
        "Your island's out past the pier. Small, but the sunsets are all yours."
      ],
      [
        "[surprised] Caught anything big yet?",
        "Best fishing's off the end of the wharf at dawn. Don't tell anyone I told you."
      ]
    ],
    "oracle-keeper": [
      [
        "The crystal is quiet today. It's listening.",
        "What would you ask it, if you knew it would answer?"
      ],
      [
        "Which way will you grow, {name}? The temple can help you see it.",
        "[happy] Not decide. Only see. The deciding is yours."
      ],
      [
        "Stars are just old light. So are good friends.",
        "[sleepy] I was up late on the temple steps again. Clear skies."
      ]
    ],
    "crafter": [
      [
        "[happy] Found a perfectly good plank on the beach. Perfectly good!",
        "Bring me some wood and I'll show you a trick at the workbench."
      ],
      [
        "Measure twice, glue once. That's the whole secret.",
        "[surprised] Well. Most of it. The rest is snacks."
      ],
      [
        "Bottles wash up on the beach sometimes.",
        "Some have notes in them. Some have recipes. Keep your eyes open."
      ]
    ],
    "juniper": [
      [
        "@morning [happy] Morning laps! Want to race to the pier?",
        "Kidding. Mostly. Stretch first, trust me."
      ],
      [
        "The sand's firmest right by the water.",
        "[happy] Best place on the island for a sprint. Try it!"
      ],
      [
        "[sleepy] I've been up since dawn. Is it lunch yet?",
        "No? Then one more lap."
      ]
    ],
    "marlo": [
      [
        "[happy] Hold still, you're in the shot.",
        "Kidding. Mostly. You do make a good shape for a sketch."
      ],
      [
        "I've drawn HQ forty times now.",
        "[sad] I'm not happy with any of them. That roof has a mind of its own."
      ],
      [
        "The pond looks different every hour.",
        "I'm out of the green pencil again. If you find one, it's mine."
      ]
    ],
    "nell": [
      [
        "I named a star after the founders. The bright one over HQ, once it's dark.",
        "[happy] The fainter ones are for everyone who joined after. There's room for plenty more."
      ],
      [
        "[sleepy] Mornings are a rumour. I'm told they're nice.",
        "The island's best after dark anyway. The fireflies come out by the water."
      ],
      [
        "If you can't sleep, come and find me at the lamp bench.",
        "I'll show you the constellation that looks like a fishing rod."
      ]
    ]
  },
  "CHAPTERS": [
    {
      "id": "00000000-0000-4000-8000-0000000000a1",
      "slug": "settle-in",
      "position": 1,
      "title": "Settle in",
      "summary": "Make your first catch and donate it to the museum, then report back to Alice at HQ.",
      "requirement": "settle_in",
      "goal_slug": null,
      "step_copy": {
        "claim_plot": {
          "label": "Claim your plot at HQ"
        },
        "first_catch": {
          "label": "Make your first catch",
          "hint": "Any fish counts. Try the pier."
        },
        "donate_catch": {
          "label": "Donate your catch to the museum shell"
        },
        "report_hq": {
          "label": "Report back to Alice at HQ"
        }
      },
      "unlocks_regions": [
        "village_core"
      ],
      "completion_letter": "Welcome to the island. The village is yours to explore.",
      "skippable_max_tier": 5,
      "reward_coins": 100,
      "active": true
    },
    {
      "id": "00000000-0000-4000-8000-0000000000a2",
      "slug": "reopen-cafe",
      "position": 2,
      "title": "Reopen the cafe",
      "summary": "The whole club is reopening the cafe. Chip in at the monument and come to events.",
      "requirement": "club_goal",
      "goal_slug": "reopen-cafe",
      "step_copy": {
        "contribute": {
          "label": "Contribute to the cafe fund",
          "hint": "Deliveries at the plaza monument, or come to a club event."
        },
        "goal_complete": {
          "label": "Cafe fund reaches its target"
        }
      },
      "unlocks_regions": [
        "cafe",
        "study_tables"
      ],
      "completion_letter": "",
      "skippable_max_tier": 0,
      "reward_coins": 0,
      "active": true
    },
    {
      "id": "00000000-0000-4000-8000-0000000000a3",
      "slug": "fund-museum",
      "position": 3,
      "title": "Fund the museum",
      "summary": "The club is funding the museum. Specimens and coins count.",
      "requirement": "club_goal",
      "goal_slug": "fund-museum",
      "step_copy": {
        "contribute": {
          "label": "Contribute to the museum fund"
        },
        "goal_complete": {
          "label": "Museum fund reaches its target"
        }
      },
      "unlocks_regions": [
        "museum",
        "woods"
      ],
      "completion_letter": "",
      "skippable_max_tier": 0,
      "reward_coins": 0,
      "active": true
    },
    {
      "id": "00000000-0000-4000-8000-0000000000a4",
      "slug": "ruins-gate",
      "position": 4,
      "title": "Reach the ruins gate",
      "summary": "Take the Oracle quiz, reach level 10 and choose your subclass to open the ruins gate.",
      "requirement": "oracle_trial",
      "goal_slug": null,
      "step_copy": {
        "oracle_quiz": {
          "label": "Complete the Oracle quiz"
        },
        "family_trial": {
          "label": "Reach level 10 and choose your subclass",
          "hint": "At the Oracle temple."
        },
        "enter_gate": {
          "label": "Open the ruins gate"
        }
      },
      "unlocks_regions": [
        "cliffs",
        "ruins_gate"
      ],
      "completion_letter": "The ruins gate is open to you. Tread carefully.",
      "skippable_max_tier": 0,
      "reward_coins": 300,
      "active": true
    }
  ]
} as const;
