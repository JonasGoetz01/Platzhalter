package handler

import (
	"github.com/gofiber/fiber/v2"
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

	results := make([]any, 0, len(req.Assignments))
	var eventID string

	for _, a := range req.Assignments {
		id, err := parseUUID(a.PersonID)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid person_id: " + a.PersonID,
				"code":  "BAD_REQUEST",
			})
		}

		person, err := h.q.AssignSeat(c.Context(), queries.AssignSeatParams{
			ID:       id,
			TableRef: &a.TableRef,
			SeatRef:  &a.SeatRef,
		})
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to assign seat for person: " + a.PersonID,
				"code":  "INTERNAL_ERROR",
			})
		}

		results = append(results, person)

		// Get event ID for SSE broadcast from first person
		if eventID == "" {
			full, _ := h.q.GetPerson(c.Context(), id)
			if full.EventID.Valid {
				eventID = uuidToString(full.EventID)
			}
		}
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
