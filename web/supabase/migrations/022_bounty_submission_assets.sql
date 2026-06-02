-- ============================================
-- Migration 022: Bounty submission assets bucket
-- Public bucket for member-uploaded deliverable images attached to bounty
-- submissions. Read: public. Write: any authenticated user with an active
-- bounty_claim (gate enforced at the API layer; RLS below is a belt-and-
-- suspenders fallback for direct-anon-key uploads).
--
-- Sibling to 017_content_assets_bucket.sql, which is T1/T2-only. This one is
-- member-tier (T3-T5) because the bounty claimant uploads their own work.
--
-- NOTE on bucket creation:
--   Self-hosted Supabase: the INSERT below runs as a normal SQL migration.
--   Cloud Supabase: the postgres role often can't INSERT into storage.buckets
--   directly — if this migration errors with a permissions complaint, create
--   the bucket from the Dashboard (Storage → New Bucket → name=bounty-
--   submissions, public=on, file size limit=10MB, allowed MIME types=
--   image/png,image/jpeg,image/webp,image/gif,application/pdf) and re-run the
--   migration; the CREATE POLICY blocks below will then succeed on their own.
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bounty-submissions',
  'bounty-submissions',
  true,
  10485760,                       -- 10 MB (deliverables can be a bit chunkier than sprites)
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/pdf'
  ];

-- Public read — bucket is public; explicit RLS for clarity.
DROP POLICY IF EXISTS "Bounty submission assets readable by anyone" ON storage.objects;
CREATE POLICY "Bounty submission assets readable by anyone"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bounty-submissions');

-- Authenticated members may write. The /api/bounties/[id]/submissions/upload
-- route does the upload via service role (bypasses RLS) AND additionally
-- verifies the caller has an active bounty_claim — that verification can't be
-- expressed in storage RLS without the bounty id in the path, so the API
-- layer is the real gate. This policy is the safety net.
DROP POLICY IF EXISTS "Bounty submission assets writable by authenticated" ON storage.objects;
CREATE POLICY "Bounty submission assets writable by authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'bounty-submissions');

-- Owners may delete their own assets (if we ever expose a "remove attachment"
-- button). T1/T2 may delete anything for moderation.
DROP POLICY IF EXISTS "Bounty submission assets deletable by owner or T1/T2" ON storage.objects;
CREATE POLICY "Bounty submission assets deletable by owner or T1/T2"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'bounty-submissions'
    AND (
      owner = (select auth.uid())
      OR (SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2)
    )
  );
