-- The new world's outdoor study spots (David, new-world fixes): the plaza's picnic table is gone ("not needed"), and the
-- quay's spot is a plain bench ("shouldnt be study table should just be bench"; lib/study/tables.ts). The picnic table
-- is retired, not deleted, so its sessions and chat stay (the store reads active tables only).
UPDATE study_tables SET active = FALSE WHERE id = '00000000-0000-4000-8000-000000005108';
UPDATE study_tables SET label = 'Pier bench' WHERE id = '00000000-0000-4000-8000-000000005109';
