-- ============================================
-- Tethos Recruitment System — Database Schema
-- ============================================

-- Positions table
CREATE TABLE IF NOT EXISTS positions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,
  title           text NOT NULL,
  description     text,
  phase           integer NOT NULL DEFAULT 1,
  visibility      text NOT NULL DEFAULT 'public'
                    CHECK (visibility IN ('public', 'internal')),
  access_code     text,
  essay_questions jsonb DEFAULT '[]'::jsonb,
  opens_at        timestamptz,
  closes_at       timestamptz,
  is_active       boolean DEFAULT false,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Applications table
CREATE TABLE IF NOT EXISTS applications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position_id     uuid NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  full_name       text NOT NULL,
  email           text NOT NULL,
  phone           text NOT NULL,
  program_major   text NOT NULL,
  year_of_study   integer NOT NULL,
  linkedin_url    text,
  heard_about_us  text NOT NULL,
  resume_drive_url text,
  resume_filename  text,
  essay_answers   jsonb DEFAULT '[]'::jsonb,
  status          text NOT NULL DEFAULT 'submitted'
                    CHECK (status IN (
                      'submitted', 'screening', 'interview_invite',
                      'interview', 'final_review',
                      'offer', 'waitlist', 'declined'
                    )),
  draft_status    text
                    CHECK (draft_status IS NULL OR draft_status IN (
                      'submitted', 'screening', 'interview_invite',
                      'interview', 'final_review',
                      'offer', 'waitlist', 'declined'
                    )),
  tags            text[] DEFAULT '{}',
  admin_notes     text,
  submitted_at    timestamptz DEFAULT now(),
  released_at     timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),

  UNIQUE(user_id, position_id)
);

-- Status release audit log
CREATE TABLE IF NOT EXISTS status_releases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  old_status      text NOT NULL,
  new_status      text NOT NULL,
  released_by     uuid NOT NULL REFERENCES auth.users(id),
  released_at     timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_position_id ON applications(position_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_positions_phase ON positions(phase);
CREATE INDEX IF NOT EXISTS idx_positions_visibility ON positions(visibility);
CREATE INDEX IF NOT EXISTS idx_status_releases_app ON status_releases(application_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_positions_updated_at
  BEFORE UPDATE ON positions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_releases ENABLE ROW LEVEL SECURITY;

-- Admin check function (uses env-based whitelist via app_settings)
-- In practice, admin checks are done at the API layer using SUPABASE_SERVICE_ROLE_KEY.
-- These RLS policies protect the anon/authenticated paths.

-- Positions: anyone can read active public positions
CREATE POLICY "Public can read active positions"
  ON positions FOR SELECT
  USING (is_active = true AND visibility = 'public');

-- Positions: authenticated can read internal positions (code check is at API layer)
CREATE POLICY "Authenticated can read internal positions"
  ON positions FOR SELECT
  TO authenticated
  USING (is_active = true AND visibility = 'internal');

-- Applications: users can read their own
CREATE POLICY "Users can read own applications"
  ON applications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Applications: users can insert their own
CREATE POLICY "Users can insert own applications"
  ON applications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Status releases: users can read their own (via application)
CREATE POLICY "Users can read own status releases"
  ON status_releases FOR SELECT
  TO authenticated
  USING (
    application_id IN (
      SELECT id FROM applications WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- Seed Phase 1 positions
-- ============================================

INSERT INTO positions (slug, title, description, phase, visibility, essay_questions, opens_at, closes_at, is_active)
VALUES
  (
    'vp-internal',
    'VP Internal',
    'Lead internal operations, team culture, and member experience. You''ll manage onboarding, events, and cross-team coordination.',
    1, 'public',
    '[{"id":"vp-int-1","question":"Describe a time you built or improved an internal process for a team or organization. What was the outcome?","max_words":500},{"id":"vp-int-2","question":"How would you approach building team culture in a remote-first student organization?","max_words":400}]'::jsonb,
    '2026-05-01T00:00:00Z', '2026-05-31T23:59:59Z', true
  ),
  (
    'vp-external',
    'VP External',
    'Own partnerships, sponsorships, and external communications. You''ll represent Tethos to companies, nonprofits, and the broader community.',
    1, 'public',
    '[{"id":"vp-ext-1","question":"Tell us about a partnership or sponsorship you secured. How did you approach it?","max_words":500},{"id":"vp-ext-2","question":"What''s your strategy for growing Tethos''s presence beyond Western University?","max_words":400}]'::jsonb,
    '2026-05-01T00:00:00Z', '2026-05-31T23:59:59Z', true
  ),
  (
    'vp-marketing',
    'VP Marketing',
    'Drive brand strategy, social media, and creative output. You''ll shape how Tethos looks, sounds, and reaches its audience.',
    1, 'public',
    '[{"id":"vp-mkt-1","question":"Share a campaign or creative project you led. What was the impact?","max_words":500},{"id":"vp-mkt-2","question":"How would you differentiate Tethos''s brand from other tech clubs on campus?","max_words":400}]'::jsonb,
    '2026-05-01T00:00:00Z', '2026-05-31T23:59:59Z', true
  ),
  (
    'pm-internal',
    'Project Manager',
    'Lead a cross-functional team delivering software for nonprofit clients. Manage timelines, scope, and stakeholder communication.',
    1, 'internal',
    '[{"id":"pm-int-1","question":"Describe a project where you had to manage competing priorities. How did you handle trade-offs?","max_words":500}]'::jsonb,
    '2026-05-01T00:00:00Z', '2026-05-31T23:59:59Z', true
  ),
  (
    'advisor',
    'Advisor',
    'Provide strategic guidance and mentorship to the executive team. Leverage your Tethos experience to shape the org''s direction.',
    1, 'internal',
    '[{"id":"adv-1","question":"What was your most impactful contribution during your time at Tethos, and what would you do differently?","max_words":500}]'::jsonb,
    '2026-05-01T00:00:00Z', '2026-05-31T23:59:59Z', true
  ),
  (
    'pm-general',
    'Project Manager',
    'Lead a cross-functional team delivering software for nonprofit clients. Open to all applicants.',
    2, 'public',
    '[{"id":"pm-gen-1","question":"Describe a project where you had to manage competing priorities. How did you handle trade-offs?","max_words":500}]'::jsonb,
    '2026-09-01T00:00:00Z', '2026-09-15T23:59:59Z', false
  ),
  (
    'dev-directors',
    'Dev/Directors',
    'Technical leads and directors driving engineering execution across Tethos projects.',
    2, 'public',
    '[{"id":"dev-dir-1","question":"Tell us about a technical challenge you solved. What was your approach and what did you learn?","max_words":500}]'::jsonb,
    '2026-09-15T00:00:00Z', '2026-09-30T23:59:59Z', false
  )
ON CONFLICT (slug) DO NOTHING;
