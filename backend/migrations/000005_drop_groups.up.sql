-- Remove group_id foreign key and column from persons
ALTER TABLE persons DROP COLUMN IF EXISTS group_id;

-- Drop group-related indexes
DROP INDEX IF EXISTS idx_persons_group;

-- Drop the groups table
DROP TABLE IF EXISTS groups;
