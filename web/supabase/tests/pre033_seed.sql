-- Run after 024-032 and BEFORE 033: a member with 024-era coins and gear,
-- so 033's migration of profiles.coins / profiles.gear can be checked.
\set ON_ERROR_STOP 1
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-0000000000cc', 'c@x');
INSERT INTO profiles (id, email, display_name, coins, gear, tethos_coins)
VALUES ('00000000-0000-4000-8000-0000000000cc', 'c@x', 'Priya', 777, '["rod_cedar"]', 900);
