-- ============================================================
-- BetterAuth Organization plugin tables
-- Column names must be camelCase to match BetterAuth's defaults
-- ============================================================

CREATE TABLE organization (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logo TEXT,
    metadata TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE member (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    "organizationId" TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE("organizationId", "userId")
);

CREATE TABLE invitation (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    "organizationId" TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMPTZ,
    "inviterId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- BetterAuth stores the active organization on the session
ALTER TABLE session ADD COLUMN "activeOrganizationId" TEXT REFERENCES organization(id) ON DELETE SET NULL;

-- ============================================================
-- Scope events to organizations (nullable for backward compat)
-- ============================================================

ALTER TABLE events ADD COLUMN organization_id TEXT REFERENCES organization(id) ON DELETE CASCADE;
CREATE INDEX idx_events_organization ON events(organization_id);
