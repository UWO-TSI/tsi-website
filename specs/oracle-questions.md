# Oracle Temple — MBTI Quiz Question Bank

> **Owner:** UXUI · **Date:** 2026-03-30
> **Spec:** `specs/ux-oracle.md`
> **Format:** 12 questions, 2–4 answer cards each, click the most accurate
> **Scoring:** 3 questions per MBTI dichotomy (E/I, S/N, T/F, J/P). Majority wins each axis → 4-letter type → class + subclass.

---

## Scoring Key

Each answer maps to one side of a dichotomy. After 12 questions, tally each axis:
- **E/I** (Extraversion vs Introversion) — Questions 1, 2, 3
- **S/N** (Sensing vs iNtuition) — Questions 4, 5, 6
- **T/F** (Thinking vs Feeling) — Questions 7, 8, 9
- **J/P** (Judging vs Perceiving) — Questions 10, 11, 12

---

## Questions

### Q1 — E/I (Extraversion vs Introversion)

**"When you join a new team or club, you tend to..."**

| Card | Text | Scores |
|------|------|--------|
| A | Jump in, introduce yourself, and start talking to everyone | **E** |
| B | Observe first, then connect with one or two people you click with | **I** |
| C | Look for a role or task to do — you connect through work | **I** |
| D | Bring energy to the room and rally people around an idea | **E** |

---

### Q2 — E/I

**"After a long day of meetings and collaboration, you recharge by..."**

| Card | Text | Scores |
|------|------|--------|
| A | Going out with friends — more people, more energy | **E** |
| B | Spending time alone with music, a book, or a personal project | **I** |

---

### Q3 — E/I

**"In a brainstorm session, your natural role is..."**

| Card | Text | Scores |
|------|------|--------|
| A | Throwing out ideas quickly and building on others' suggestions out loud | **E** |
| B | Listening carefully, then offering one well-thought-out idea | **I** |
| C | Facilitating — making sure everyone's voice is heard | **E** |
| D | Sketching or writing notes quietly, then sharing a synthesis | **I** |

---

### Q4 — S/N (Sensing vs iNtuition)

**"When learning a new technology or framework, you prefer to..."**

| Card | Text | Scores |
|------|------|--------|
| A | Follow the official tutorial step by step, building something concrete | **S** |
| B | Skim the docs to understand the big picture, then experiment | **N** |
| C | Look at real-world examples and replicate what works | **S** |
| D | Imagine what you could build with it, then learn what you need as you go | **N** |

---

### Q5 — S/N

**"When planning a project, you focus first on..."**

| Card | Text | Scores |
|------|------|--------|
| A | What's been done before that works — proven patterns and templates | **S** |
| B | What's possible — new approaches nobody has tried yet | **N** |

---

### Q6 — S/N

**"A teammate says 'this feature is 80% done.' You think..."**

| Card | Text | Scores |
|------|------|--------|
| A | What specific tasks are left? Show me the checklist. | **S** |
| B | Is the remaining 20% the critical part that makes it actually good? | **N** |
| C | Let me test what's built so far — I trust what I can see | **S** |
| D | What could we add to make it 10× better instead of just finishing it? | **N** |

---

### Q7 — T/F (Thinking vs Feeling)

**"Two teammates disagree on a technical approach. You..."**

| Card | Text | Scores |
|------|------|--------|
| A | Evaluate both options on merit — data, performance, maintainability | **T** |
| B | Consider how each person feels about their approach and find a compromise | **F** |
| C | Pick the one that ships faster — efficiency matters most | **T** |
| D | Make sure neither person feels dismissed, even if one approach is clearly better | **F** |

---

### Q8 — T/F

**"When giving feedback on someone's work, you prioritize..."**

| Card | Text | Scores |
|------|------|--------|
| A | Being direct and specific — they need to know exactly what to fix | **T** |
| B | Being encouraging first, then gently suggesting improvements | **F** |

---

### Q9 — T/F

**"A nonprofit client requests a feature that's technically simple but you think is a bad UX decision. You..."**

| Card | Text | Scores |
|------|------|--------|
| A | Present the data and logic for why it's bad UX — let the evidence decide | **T** |
| B | Understand why they want it — there might be user needs you're missing | **F** |
| C | Build both options and A/B test — remove opinions from the equation | **T** |
| D | Find a middle ground that respects their vision while improving the experience | **F** |

---

### Q10 — J/P (Judging vs Perceiving)

**"Your ideal project workflow looks like..."**

| Card | Text | Scores |
|------|------|--------|
| A | Clear milestones, deadlines, and a structured plan from day one | **J** |
| B | A rough direction, then adapt as you learn and discover | **P** |
| C | Sprints with defined goals, but flexibility within each sprint | **J** |
| D | Work on whatever feels most important right now — plans change anyway | **P** |

---

### Q11 — J/P

**"It's Friday and your weekend is free. You..."**

| Card | Text | Scores |
|------|------|--------|
| A | Already have plans — you like knowing what's happening | **J** |
| B | Keep it open — the best weekends are spontaneous | **P** |

---

### Q12 — J/P

**"A deadline just moved up by a week. Your reaction..."**

| Card | Text | Scores |
|------|------|--------|
| A | Immediately restructure the plan — reprioritize tasks, cut scope, notify the team | **J** |
| B | Stay calm — you work well under pressure and figure it out as you go | **P** |
| C | Check what's already done and make a checklist of what absolutely must ship | **J** |
| D | Get excited — constraints force creativity and the best work happens fast | **P** |

---

## Class Mapping (from ux-oracle.md)

| MBTI | Class | Subclass |
|------|-------|----------|
| ENTJ | Warrior | Tactical Commander |
| ESTJ | Warrior | Iron Marshal |
| ESTP | Warrior | Vanguard Striker |
| ENTP | Warrior | Battle Strategist |
| INTJ | Mage | Arcane Architect |
| INTP | Mage | Lore Seeker |
| INFJ | Mage | Oracle Sage |
| INFP | Mage | Dream Weaver |
| ENFJ | Healer | Beacon Guide |
| ENFP | Healer | Spirit Catalyst |
| ESFJ | Healer | Shield Warden |
| ISFJ | Healer | Sanctuary Keeper |
| ISTP | Rogue | Shadow Tinker |
| ISFP | Rogue | Wandering Artisan |
| ISTJ | Rogue | Silent Sentinel |
| ESFP | Rogue | Blaze Performer |

---

## Implementation Notes for Frontend

- Questions should be shuffled order per session (but keep the axis grouping — shuffle within each group of 3)
- Answer cards should also be shuffled order per question (avoid pattern bias)
- Store answers as an array: `[{question: 1, answer: "A", axis: "EI", value: "E"}, ...]`
- After 12 answers: count E vs I, S vs N, T vs F, J vs P → 4-letter type
- Tie-breaker: if 1.5 vs 1.5 on any axis (rare with 3 questions), default to the first letter (E, S, T, J)
- Save result to `profile.class` and `profile.subclass` via PATCH `/api/profile`
