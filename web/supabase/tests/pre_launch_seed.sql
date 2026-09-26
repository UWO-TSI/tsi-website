-- Run after 20260926180000 and BEFORE 20260926200000: production's shape at
-- launch, where 150700_identity grandfathered every existing profile as a member.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-0000000001f1', 'lf-staff@x'), ('00000000-0000-4000-8000-0000000001f2', 'lf-hired@x'),
  ('00000000-0000-4000-8000-0000000001f3', 'lf-drafted@x'), ('00000000-0000-4000-8000-0000000001f4', 'lf-listed@x'),
  ('00000000-0000-4000-8000-0000000001f5', 'lf-plain@x');
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('00000000-0000-4000-8000-0000000001f6', 'lf-w26@x', '{"invite_code":"tethos-w26"}');
UPDATE profiles SET membership = 'member', tier = 4 WHERE email LIKE 'lf-%@x';
UPDATE profiles SET tier = 3 WHERE id = '00000000-0000-4000-8000-0000000001f1';
INSERT INTO member_email_whitelist (email) VALUES ('lf-listed@x');
INSERT INTO positions (id, slug, title, is_active) VALUES ('00000000-0000-4000-8000-0000000001fa', 'lf-vp', 'VP Launch', TRUE);
INSERT INTO applications (user_id, position_id, full_name, email, phone, program_major, year_of_study, heard_about_us, status, draft_status) VALUES
  ('00000000-0000-4000-8000-0000000001f2', '00000000-0000-4000-8000-0000000001fa', 'Hired', 'lf-hired@x', '1', 'SE', 3, 'x', 'accepted', NULL),
  ('00000000-0000-4000-8000-0000000001f3', '00000000-0000-4000-8000-0000000001fa', 'Drafted', 'lf-drafted@x', '1', 'SE', 3, 'x', 'final_review', 'accepted');
