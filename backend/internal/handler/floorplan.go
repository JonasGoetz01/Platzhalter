package handler

import (
	"encoding/json"

	"github.com/gofiber/fiber/v2"
	"github.com/jgotz/platzhalter/backend/internal/db/queries"
)

type FloorPlanHandler struct {
	q *queries.Queries
}

func NewFloorPlanHandler(q *queries.Queries) *FloorPlanHandler {
	return &FloorPlanHandler{q: q}
}

// floorPlanResponse wraps the DB model so that Layout is emitted as raw JSON,
// not as a base64 string (which is what encoding/json does for []byte).
type floorPlanResponse struct {
	ID        any             `json:"id"`
	EventID   any             `json:"event_id"`
	Layout    json.RawMessage `json:"layout"`
	Version   int32           `json:"version"`
	CreatedAt any             `json:"created_at"`
	UpdatedAt any             `json:"updated_at"`
}

func toFloorPlanResponse(fp queries.FloorPlan) floorPlanResponse {
	return floorPlanResponse{
		ID:        fp.ID,
		EventID:   fp.EventID,
		Layout:    json.RawMessage(fp.Layout),
		Version:   fp.Version,
		CreatedAt: fp.CreatedAt,
		UpdatedAt: fp.UpdatedAt,
	}
}

func (h *FloorPlanHandler) Get(c *fiber.Ctx) error {
	eventID, err := parseUUID(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid event ID",
			"code":  "BAD_REQUEST",
		})
	}

	if resp := checkEventAccess(c, h.q, eventID); resp != nil {
		return resp
	}

	fp, err := h.q.GetFloorPlan(c.Context(), eventID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "floor plan not found",
			"code":  "NOT_FOUND",
		})
	}
	return c.JSON(toFloorPlanResponse(fp))
}

type updateFloorPlanRequest struct {
	Layout  json.RawMessage `json:"layout"`
	Version int32           `json:"version"`
}

func (h *FloorPlanHandler) Update(c *fiber.Ctx) error {
	eventID, err := parseUUID(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid event ID",
			"code":  "BAD_REQUEST",
		})
	}

	if resp := checkEventAccess(c, h.q, eventID); resp != nil {
		return resp
	}

	var req updateFloorPlanRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
			"code":  "BAD_REQUEST",
		})
	}

	if len(req.Layout) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "layout is required",
			"code":  "BAD_REQUEST",
		})
	}

	// Optimistic locking: check submitted version matches current DB version
	if req.Version > 0 {
		current, err := h.q.GetFloorPlan(c.Context(), eventID)
		if err == nil && current.Version != req.Version {
			return c.Status(fiber.StatusConflict).JSON(fiber.Map{
				"error":           "floor plan was updated by another user",
				"code":            "VERSION_CONFLICT",
				"current_version": current.Version,
			})
		}
	}

	fp, err := h.q.UpdateFloorPlanLayout(c.Context(), queries.UpdateFloorPlanLayoutParams{
		EventID: eventID,
		Layout:  []byte(req.Layout),
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to update floor plan",
			"code":  "INTERNAL_ERROR",
		})
	}
	return c.JSON(toFloorPlanResponse(fp))
}
