# Fail-first runs (vitest, before the fix -> after)

## Item 5: lib/game/roomHeading.test.ts
before: module missing, suite fails to load (0 tests run)
after: 3 passed

## Item 1: components/game/CollectionBook.test.tsx
before: 3 failed | 2 passed (no data-gui-dialog frame; '0 in your bag'; collectionNote missing)
after: 5 passed

## Item 4: components/game/oracle/closeMotion.test.tsx
before: 2 failed | 1 passed (PathSheet ignored open and rendered closed; FamilyReveal had no open/data-state)
after: 3 passed

## Item 13: components/game/DailyGift.test.ts
before: 4 failed (giftKey missing: no E, Escape only with focus inside the card)
after: 4 passed
