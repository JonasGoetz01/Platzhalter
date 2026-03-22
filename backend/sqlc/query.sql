-- ============================================================
-- User queries (BetterAuth user table)
-- ============================================================

-- name: GetUserByID :one
SELECT id, name, email, "emailVerified", image, role, "createdAt", "updatedAt"
FROM "user"
WHERE id = $1;

-- name: GetUserByEmail :one
SELECT id, name, email, "emailVerified", image, role, "createdAt", "updatedAt"
FROM "user"
WHERE email = $1;

-- name: ListUsers :many
SELECT id, name, email, "emailVerified", image, role, "createdAt", "updatedAt"
FROM "user"
ORDER BY "createdAt" DESC;

-- name: UpdateUserRole :exec
UPDATE "user" SET role = $2, "updatedAt" = NOW() WHERE id = $1;

-- name: DeleteUser :exec
DELETE FROM "user" WHERE id = $1;

-- name: CountUsers :one
SELECT COUNT(*) FROM "user";

-- ============================================================
-- Event queries
-- ============================================================

-- name: CreateEvent :one
INSERT INTO events (name, event_date, description, created_by)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetEvent :one
SELECT * FROM events WHERE id = $1;

-- name: ListEvents :many
SELECT * FROM events ORDER BY event_date DESC NULLS LAST, created_at DESC;

-- name: ListEventsByUser :many
SELECT * FROM events WHERE created_by = $1 ORDER BY event_date DESC NULLS LAST, created_at DESC;

-- name: UpdateEvent :one
UPDATE events
SET name = $2, event_date = $3, description = $4, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteEvent :exec
DELETE FROM events WHERE id = $1;

-- ============================================================
-- Floor plan queries
-- ============================================================

-- name: CreateFloorPlan :one
INSERT INTO floor_plans (event_id) VALUES ($1) RETURNING *;

-- name: GetFloorPlan :one
SELECT * FROM floor_plans WHERE event_id = $1;

-- name: UpdateFloorPlanLayout :one
UPDATE floor_plans
SET layout = $2, version = version + 1, updated_at = NOW()
WHERE event_id = $1
RETURNING *;

-- name: GetFloorPlanWithVersion :one
SELECT * FROM floor_plans WHERE event_id = $1 AND version = $2;

-- ============================================================
-- Group queries
-- ============================================================

-- name: CreateGroup :one
INSERT INTO groups (event_id, name, color)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetGroup :one
SELECT * FROM groups WHERE id = $1;

-- name: ListGroupsByEvent :many
SELECT * FROM groups WHERE event_id = $1 ORDER BY sort_order, name;

-- name: UpdateGroup :one
UPDATE groups
SET name = $2, color = $3, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteGroup :exec
DELETE FROM groups WHERE id = $1;

-- name: MergeGroups :exec
UPDATE persons SET group_id = $2, updated_at = NOW() WHERE group_id = $1;

-- ============================================================
-- Person queries
-- ============================================================

-- name: CreatePerson :one
INSERT INTO persons (event_id, name, group_id, table_ref, seat_ref, parked, booked_table)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetPerson :one
SELECT * FROM persons WHERE id = $1;

-- name: ListPersonsByEvent :many
SELECT p.*, g.name AS group_name, g.color AS group_color
FROM persons p
LEFT JOIN groups g ON g.id = p.group_id
WHERE p.event_id = $1
ORDER BY p.name;

-- name: ListPersonsByTable :many
SELECT p.*, g.name AS group_name, g.color AS group_color
FROM persons p
LEFT JOIN groups g ON g.id = p.group_id
WHERE p.event_id = $1 AND p.table_ref = $2 AND NOT p.parked
ORDER BY p.seat_ref;

-- name: ListParkedPersons :many
SELECT p.*, g.name AS group_name, g.color AS group_color
FROM persons p
LEFT JOIN groups g ON g.id = p.group_id
WHERE p.event_id = $1 AND p.parked = TRUE
ORDER BY p.name;

-- name: UpdatePerson :one
UPDATE persons
SET name = $2, group_id = $3, booked_table = $4, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: AssignSeat :one
UPDATE persons
SET table_ref = $2, seat_ref = $3, parked = FALSE, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: ParkPerson :one
UPDATE persons
SET table_ref = NULL, seat_ref = NULL, parked = TRUE, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeletePerson :exec
DELETE FROM persons WHERE id = $1;

-- name: CountPersonsByEvent :one
SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE NOT parked AND table_ref IS NOT NULL) AS seated,
    COUNT(*) FILTER (WHERE parked) AS parked_count
FROM persons
WHERE event_id = $1;

-- name: SwapSeats :exec
WITH person_a AS (
    SELECT table_ref, seat_ref FROM persons WHERE persons.id = $1
), person_b AS (
    SELECT table_ref, seat_ref FROM persons WHERE persons.id = $2
)
UPDATE persons SET
    table_ref = CASE
        WHEN persons.id = $1 THEN (SELECT table_ref FROM person_b)
        WHEN persons.id = $2 THEN (SELECT table_ref FROM person_a)
    END,
    seat_ref = CASE
        WHEN persons.id = $1 THEN (SELECT seat_ref FROM person_b)
        WHEN persons.id = $2 THEN (SELECT seat_ref FROM person_a)
    END,
    updated_at = NOW()
WHERE persons.id IN ($1, $2);

-- name: GetPersonBySeat :one
SELECT * FROM persons
WHERE event_id = $1 AND table_ref = $2 AND seat_ref = $3 AND NOT parked
LIMIT 1;

-- name: BulkParkPersons :exec
UPDATE persons
SET table_ref = NULL, seat_ref = NULL, parked = TRUE, updated_at = NOW()
WHERE id = ANY($1::uuid[]);

-- name: ListPersonsByGroup :many
SELECT p.*, g.name AS group_name, g.color AS group_color
FROM persons p
LEFT JOIN groups g ON g.id = p.group_id
WHERE p.group_id = $1
ORDER BY p.name;
