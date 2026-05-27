-- ============================================
-- Migration 017: Content assets bucket
-- Public bucket for admin-uploaded sprite/image assets (NPCs, shop items).
-- Read: public. Write: T1/T2 only (via service-role API, but RLS is the
-- belt-and-suspenders layer in case anyone uses an anon-key client).
--
-- NOTE on bucket creation:
--   Self-hosted Supabase: the INSERT below runs as a normal SQL migration.
--   Cloud Supabase: the postgres role often can't INSERT into storage.buckets
--   directly — if this migration errors with a permissions complaint, create
--   the bucket from the Dashboard (Storage → New Bucket → name=content-assets,
--   public=on, file size limit=5MB, allowed MIME types=image/png,image/jpeg,
--   image/webp,image/gif) and re-run the migration; the CREATE POLICY blocks
--   below will then succeed on their own.
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'content-assets',
  'content-assets',
  true,
  5242880,                       -- 5 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

-- Public read — bucket is public anyway, but make it explicit at the RLS layer
DROP POLICY IF EXISTS "Content assets readable by anyone" ON storage.objects;
CREATE POLICY "Content assets readable by anyone"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'content-assets');

-- T1/T2 write. The /api/content/upload route does the upload via service role
-- (which bypasses RLS), so in practice this policy fires only if a client uses
-- an authenticated key directly. Kept here as a safety net.
DROP POLICY IF EXISTS "Content assets writable by T1/T2" ON storage.objects;
CREATE POLICY "Content assets writable by T1/T2"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'content-assets'
    AND (SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2)
  );

DROP POLICY IF EXISTS "Content assets updatable by T1/T2" ON storage.objects;
CREATE POLICY "Content assets updatable by T1/T2"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'content-assets'
    AND (SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2)
  );

DROP POLICY IF EXISTS "Content assets deletable by T1/T2" ON storage.objects;
CREATE POLICY "Content assets deletable by T1/T2"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'content-assets'
    AND (SELECT tier FROM profiles WHERE id = (select auth.uid())) IN (1, 2)
  );
