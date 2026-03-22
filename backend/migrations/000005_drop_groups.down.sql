-- Recreate groups table
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#6366f1',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_groups_event ON groups(event_id);

-- Re-add group_id column to persons
ALTER TABLE persons ADD COLUMN group_id UUID REFERENCES groups(id) ON DELETE SET NULL;
CREATE INDEX idx_persons_group ON persons(group_id);
