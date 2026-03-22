package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jgotz/platzhalter/backend/internal/db/queries"
	"github.com/jgotz/platzhalter/backend/internal/middleware"
)

type EventHandler struct {
	q    *queries.Queries
	pool *pgxpool.Pool
}

func NewEventHandler(q *queries.Queries, pool *pgxpool.Pool) *EventHandler {
	return &EventHandler{q: q, pool: pool}
}

type createEventRequest struct {
	Name        string  `json:"name"`
	EventDate   *string `json:"event_date"`
	Description string  `json:"description"`
}

func (h *EventHandler) Create(c *fiber.Ctx) error {
	var req createEventRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
			"code":  "BAD_REQUEST",
		})
	}

	if len(req.Name) == 0 || len(req.Name) > 255 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "name must be 1-255 characters",
			"code":  "VALIDATION_ERROR",
		})
	}

	if len(req.Description) > 5000 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "description must be at most 5000 characters",
			"code":  "VALIDATION_ERROR",
		})
	}

	var eventDate pgtype.Date
	if req.EventDate != nil && *req.EventDate != "" {
		if err := eventDate.Scan(*req.EventDate); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid date format (use YYYY-MM-DD)",
				"code":  "VALIDATION_ERROR",
			})
		}
	}

	userID := middleware.GetUserID(c)
	orgID := middleware.GetOrgID(c)

	// Create event and floor plan in a transaction
	tx, err := h.pool.Begin(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to begin transaction",
			"code":  "INTERNAL_ERROR",
		})
	}
	defer tx.Rollback(c.Context())

	qtx := h.q.WithTx(tx)

	var orgIDParam *string
	if orgID != "" {
		orgIDParam = &orgID
	}

	event, err := qtx.CreateEvent(c.Context(), queries.CreateEventParams{
		Name:           req.Name,
		EventDate:      eventDate,
		Description:    &req.Description,
		CreatedBy:      userID,
		OrganizationID: orgIDParam,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to create event",
			"code":  "INTERNAL_ERROR",
		})
	}

	_, err = qtx.CreateFloorPlan(c.Context(), event.ID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to create floor plan",
			"code":  "INTERNAL_ERROR",
		})
	}

	if err := tx.Commit(c.Context()); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to commit transaction",
			"code":  "INTERNAL_ERROR",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(event)
}

func (h *EventHandler) List(c *fiber.Ctx) error {
	orgID := middleware.GetOrgID(c)
	if orgID != "" {
		events, err := h.q.ListEventsByOrganization(c.Context(), &orgID)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": "failed to list events",
				"code":  "INTERNAL_ERROR",
			})
		}
		return c.JSON(events)
	}

	userID := middleware.GetUserID(c)
	events, err := h.q.ListEventsByUser(c.Context(), userID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to list events",
			"code":  "INTERNAL_ERROR",
		})
	}
	return c.JSON(events)
}

func (h *EventHandler) Get(c *fiber.Ctx) error {
	id, err := parseUUID(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid event ID",
			"code":  "BAD_REQUEST",
		})
	}

	if resp := checkEventAccess(c, h.q, id); resp != nil {
		return resp
	}

	event, err := h.q.GetEvent(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "event not found",
			"code":  "NOT_FOUND",
		})
	}

	return c.JSON(event)
}

func (h *EventHandler) Update(c *fiber.Ctx) error {
	id, err := parseUUID(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid event ID",
			"code":  "BAD_REQUEST",
		})
	}

	if resp := checkEventAccess(c, h.q, id); resp != nil {
		return resp
	}

	var req createEventRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
			"code":  "BAD_REQUEST",
		})
	}

	if len(req.Name) == 0 || len(req.Name) > 255 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "name must be 1-255 characters",
			"code":  "VALIDATION_ERROR",
		})
	}

	if len(req.Description) > 5000 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "description must be at most 5000 characters",
			"code":  "VALIDATION_ERROR",
		})
	}

	var eventDate pgtype.Date
	if req.EventDate != nil && *req.EventDate != "" {
		if err := eventDate.Scan(*req.EventDate); err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid date format",
				"code":  "VALIDATION_ERROR",
			})
		}
	}

	event, err := h.q.UpdateEvent(c.Context(), queries.UpdateEventParams{
		ID:          id,
		Name:        req.Name,
		EventDate:   eventDate,
		Description: &req.Description,
	})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "event not found",
			"code":  "NOT_FOUND",
		})
	}
	return c.JSON(event)
}

func (h *EventHandler) Delete(c *fiber.Ctx) error {
	id, err := parseUUID(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid event ID",
			"code":  "BAD_REQUEST",
		})
	}

	if resp := checkEventAccess(c, h.q, id); resp != nil {
		return resp
	}

	if err := h.q.DeleteEvent(c.Context(), id); err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "event not found",
			"code":  "NOT_FOUND",
		})
	}
	return c.SendStatus(fiber.StatusNoContent)
}
