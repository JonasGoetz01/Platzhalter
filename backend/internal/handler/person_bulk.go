package handler

import (
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jgotz/platzhalter/backend/internal/db/queries"
)

type bulkAssignItem struct {
	PersonID string `json:"person_id"`
	TableRef string `json:"table_ref"`
	SeatRef  string `json:"seat_ref"`
}

type bulkAssignRequest struct {
	Assignments []bulkAssignItem `json:"assignments"`
}

// BulkAssign assigns multiple persons to seats in a single request.
// Used when dropping a group onto a table.
func (h *PersonHandler) BulkAssign(c *fiber.Ctx) error {
	var req bulkAssignRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
			"code":  "BAD_REQUEST",
		})
	}

	if len(req.Assignments) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "no assignments provided",
			"code":  "VALIDATION_ERROR",
		})
	}

	// Validate first person to get event ID and check ownership
	firstID, err := parseUUID(req.Assignments[0].PersonID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid person_id: " + req.Assignments[0].PersonID,
			"code":  "BAD_REQUEST",
		})
	}
	firstPerson, err := h.q.GetPerson(c.Context(), firstID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "person not found: " + req.Assignments[0].PersonID,
			"code":  "NOT_FOUND",
		})
	}
	if resp := checkEventOwnership(c, h.q, firstPerson.EventID); resp != nil {
		return resp
	}
	eventID := uuidToString(firstPerson.EventID)

	// Begin transaction for atomicity
	tx, err := h.pool.Begin(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to begin transaction",
			"code":  "INTERNAL_ERROR",
		})
	}
	defer tx.Rollback(c.Context())

	qtx := queries.New(tx)
	results := make([]any, 0, len(req.Assignments))

	for _, a := range req.Assignments {
		id, err := parseUUID(a.PersonID)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid person_id: " + a.PersonID,
				"code":  "BAD_REQUEST",
			})
		}

		person, err := qtx.AssignSeat(c.Context(), queries.AssignSeatParams{
			ID:       id,
			TableRef: &a.TableRef,
			SeatRef:  &a.SeatRef,
		})
		if err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23505" {
				return c.Status(fiber.StatusConflict).JSON(fiber.Map{
					"error": "seat already occupied",
					"code":  "CONFLICT",
				})
			}
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to assign seat for person: " + a.PersonID,
				"code":  "INTERNAL_ERROR",
			})
		}

		results = append(results, person)
	}

	if err := tx.Commit(c.Context()); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to commit transaction",
			"code":  "INTERNAL_ERROR",
		})
	}

	if eventID != "" {
		h.sse.Broadcast(eventID, "bulk_assigned", fiber.Map{
			"count": len(req.Assignments),
		})
	}

	return c.JSON(fiber.Map{
		"assigned": results,
		"count":    len(results),
	})
}
