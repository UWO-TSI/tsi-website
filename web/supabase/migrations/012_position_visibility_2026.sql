-- ============================================
-- Migration 012: 2026-27 Recruitment Launch — Position Visibility
-- Only VP Internal/External/Marketing visible at launch (May 4, 2026).
-- Other positions keep their rows but is_active=false until later
-- (toggle to true when ready; no re-seed needed).
-- ============================================

-- Set the three VP positions live with the correct opens_at/closes_at
UPDATE positions
SET
  is_active  = true,
  opens_at   = '2026-05-04T00:00:00Z',
  closes_at  = '2026-05-31T23:59:59Z',
  visibility = 'public'
WHERE slug IN ('vp-internal', 'vp-external', 'vp-marketing');

-- Hide everything else for now
UPDATE positions
SET is_active = false
WHERE slug NOT IN ('vp-internal', 'vp-external', 'vp-marketing');
