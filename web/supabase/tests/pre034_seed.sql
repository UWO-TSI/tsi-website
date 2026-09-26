-- Run after 033 and BEFORE 034: members with legacy classes from both old quizzes.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'e1@x'), ('00000000-0000-4000-8000-0000000000e2', 'e2@x'),
  ('00000000-0000-4000-8000-0000000000e3', 'e3@x'), ('00000000-0000-4000-8000-0000000000e4', 'e4@x');
INSERT INTO profiles (id, email, display_name, class, subclass) VALUES
  ('00000000-0000-4000-8000-0000000000e1', 'e1@x', 'Old API INTP', 'ORACLE', 'Sage'),
  ('00000000-0000-4000-8000-0000000000e2', 'e2@x', 'Old dashboard ESFJ', 'Healer', 'Shield Warden'),
  ('00000000-0000-4000-8000-0000000000e3', 'e3@x', 'Ambiguous', 'COMMANDER', NULL),
  ('00000000-0000-4000-8000-0000000000e4', 'e4@x', 'No quiz', NULL, NULL);
