-- 028_recruitment_archive.sql
-- Archive the May 2026 round (David, 2026-09-04).
--
-- positions.archived_at marks every row of a finished round. Archived
-- positions never surface publicly (is_active is already false for them);
-- the admin page folds their applications into a collapsed "Archived
-- rounds" panel and keeps them out of the list, board, insights, filters
-- and release. Applications are archived through their position; they get
-- no column of their own.
--
-- Also closes a latent hole: the student dashboard joins positions through
-- the applicant's own session, and until now the only SELECT policies
-- required is_active = true, so an applicant to a closed round lost the
-- role title and essay prompts on their dashboard the moment the round
-- went dark. Applicants may read any position they hold an application for.
--
-- Idempotent: safe to re-run. Apply after 027.

BEGIN;

ALTER TABLE public.positions
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

COMMENT ON COLUMN public.positions.archived_at IS
  'Set when the round this position belonged to is over. Admin folds its applications into the archive panel; never shown publicly.';

CREATE INDEX IF NOT EXISTS idx_positions_archived_at
  ON public.positions (archived_at);

-- The May 2026 round: the five roles opened May 4-12 (vp-marketing was
-- retired to vp-marketing-may26 by 027). Never touches a live row.
UPDATE public.positions
SET archived_at = COALESCE(archived_at, '2026-09-04T00:00:00Z')
WHERE slug IN ('vp-internal', 'vp-external', 'vp-marketing-may26', 'pm-internal', 'advisor')
  AND is_active = false;

DROP POLICY IF EXISTS "Applicants can read positions they applied to" ON public.positions;
CREATE POLICY "Applicants can read positions they applied to"
  ON public.positions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      WHERE a.position_id = positions.id
        AND a.user_id = auth.uid()
    )
  );

COMMIT;
