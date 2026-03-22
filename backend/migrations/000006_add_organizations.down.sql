DROP INDEX IF EXISTS idx_events_organization;
ALTER TABLE events DROP COLUMN IF EXISTS organization_id;

ALTER TABLE session DROP COLUMN IF EXISTS "activeOrganizationId";

DROP TABLE IF EXISTS invitation;
DROP TABLE IF EXISTS member;
DROP TABLE IF EXISTS organization;
