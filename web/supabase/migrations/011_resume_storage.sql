-- ============================================
-- Migration 011: Resume Storage Bucket
-- Replaces server-proxied Drive upload with direct-to-Storage upload.
-- Bypasses Vercel's 4.5MB serverless body limit and removes silent
-- failure path where /api/upload could 500 and the form still submit.
-- ============================================

-- Private bucket — access via signed URLs only
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resumes',
  'resumes',
  false,
  5242880,                       -- 5 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['application/pdf'];

-- RLS: users can only operate on objects under their own user_id folder
-- Path layout: {user_id}/{position_slug}_{timestamp}.pdf

DROP POLICY IF EXISTS "Users can upload to own resume folder" ON storage.objects;
CREATE POLICY "Users can upload to own resume folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can read own resumes" ON storage.objects;
CREATE POLICY "Users can read own resumes"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update own resumes" ON storage.objects;
CREATE POLICY "Users can update own resumes"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete own resumes" ON storage.objects;
CREATE POLICY "Users can delete own resumes"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================
-- Track storage path on applications so we can re-sign URLs after
-- the initial 7-day signed URL stored in resume_drive_url expires.
-- ============================================

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS resume_storage_path text;

CREATE INDEX IF NOT EXISTS idx_applications_resume_path
  ON applications(resume_storage_path)
  WHERE resume_storage_path IS NOT NULL;
