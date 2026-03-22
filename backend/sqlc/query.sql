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
-- Organization queries
-- ============================================================

-- name: GetMemberRole :one
SELECT role FROM member WHERE "organizationId" = $1 AND "userId" = $2;

-- ============================================================
-- Event queries
-- ============================================================

-- name: CreateEvent :one
INSERT INTO events (name, event_date, description, created_by, organization_id)
VALUES ($1, $2, $3, $4, $5)
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

-- name: ListEventsByOrganization :many
SELECT * FROM events WHERE organization_id = $1 ORDER BY event_date DESC NULLS LAST, created_at DESC;

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
-- Person queries
-- ============================================================

-- name: CreatePerson :one
INSERT INTO persons (event_id, name, table_ref, seat_ref, parked, booked_table)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetPerson :one
SELECT * FROM persons WHERE id = $1;

-- name: ListPersonsByEvent :many
SELECT * FROM persons WHERE event_id = $1 ORDER BY name;

-- name: ListPersonsByTable :many
SELECT * FROM persons
WHERE event_id = $1 AND table_ref = $2 AND NOT parked
ORDER BY seat_ref;

-- name: ListParkedPersons :many
SELECT * FROM persons
WHERE event_id = $1 AND parked = TRUE
ORDER BY name;

-- name: UpdatePerson :one
UPDATE persons
SET name = $2, booked_table = $3, updated_at = NOW()
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
