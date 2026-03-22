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

	if req.Name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "name is required",
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

	event, err := qtx.CreateEvent(c.Context(), queries.CreateEventParams{
		Name:        req.Name,
		EventDate:   eventDate,
		Description: &req.Description,
		CreatedBy:   userID,
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
	events, err := h.q.ListEvents(c.Context())
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

	var req createEventRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
			"code":  "BAD_REQUEST",
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

	if err := h.q.DeleteEvent(c.Context(), id); err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "event not found",
			"code":  "NOT_FOUND",
		})
	}
	return c.SendStatus(fiber.StatusNoContent)
}
