-- Old-cleanup (David, 2026-11-28, old-cleanup review page): the retired village's chapter 1 (settle-in) and the old
-- four-chapter quest's club chapters (reopen-cafe, fund-museum, ruins-gate) stop being offered. Row 345 replaced
-- that quest with the progression road (specs/progression.md). An update, not a delete: the rows and every member's
-- progress on them stay, and the three club chapters are kept to be remade ("keep but needs to be remade").
UPDATE quest_chapters SET active = FALSE
WHERE slug IN ('settle-in', 'reopen-cafe', 'fund-museum', 'ruins-gate');
