package handler

import (
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jgotz/platzhalter/backend/internal/db/queries"
)

type PersonHandler struct {
	q    *queries.Queries
	pool *pgxpool.Pool
	sse  *SSEHandler
}

func NewPersonHandler(q *queries.Queries, pool *pgxpool.Pool, sse *SSEHandler) *PersonHandler {
	return &PersonHandler{q: q, pool: pool, sse: sse}
}

type createPersonRequest struct {
	Name        string  `json:"name"`
	GroupID     *string `json:"group_id"`
	TableRef    *string `json:"table_ref"`
	SeatRef     *string `json:"seat_ref"`
	BookedTable *string `json:"booked_table"`
}

func (h *PersonHandler) Create(c *fiber.Ctx) error {
	eventID, err := parseUUID(c.Params("eventId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid event ID",
			"code":  "BAD_REQUEST",
		})
	}

	if resp := checkEventOwnership(c, h.q, eventID); resp != nil {
		return resp
	}

	var req createPersonRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
			"code":  "BAD_REQUEST",
		})
	}

	if len(req.Name) < 2 || len(req.Name) > 80 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "name must be 2-80 characters",
			"code":  "VALIDATION_ERROR",
		})
	}

	var groupID pgtype.UUID
	if req.GroupID != nil {
		groupID, err = parseUUID(*req.GroupID)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid group ID",
				"code":  "BAD_REQUEST",
			})
		}
	}

	parked := req.TableRef == nil || req.SeatRef == nil

	person, err := h.q.CreatePerson(c.Context(), queries.CreatePersonParams{
		EventID:     eventID,
		Name:        req.Name,
		GroupID:     groupID,
		TableRef:    req.TableRef,
		SeatRef:     req.SeatRef,
		Parked:      parked,
		BookedTable: req.BookedTable,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to create person",
			"code":  "INTERNAL_ERROR",
		})
	}

	h.sse.Broadcast(uuidToString(eventID), "person_created", person)
	return c.Status(fiber.StatusCreated).JSON(person)
}

func (h *PersonHandler) List(c *fiber.Ctx) error {
	eventID, err := parseUUID(c.Params("eventId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid event ID",
			"code":  "BAD_REQUEST",
		})
	}

	if resp := checkEventOwnership(c, h.q, eventID); resp != nil {
		return resp
	}

	persons, err := h.q.ListPersonsByEvent(c.Context(), eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to list persons",
			"code":  "INTERNAL_ERROR",
		})
	}
	return c.JSON(persons)
}

type updatePersonRequest struct {
	Name        string  `json:"name"`
	GroupID     *string `json:"group_id"`
	BookedTable *string `json:"booked_table"`
}

func (h *PersonHandler) Update(c *fiber.Ctx) error {
	id, err := parseUUID(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid person ID",
			"code":  "BAD_REQUEST",
		})
	}

	existing, err := h.q.GetPerson(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "person not found",
			"code":  "NOT_FOUND",
		})
	}
	if resp := checkEventOwnership(c, h.q, existing.EventID); resp != nil {
		return resp
	}

	var req updatePersonRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
			"code":  "BAD_REQUEST",
		})
	}

	var groupID pgtype.UUID
	if req.GroupID != nil {
		groupID, err = parseUUID(*req.GroupID)
		if err != nil {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid group ID",
				"code":  "BAD_REQUEST",
			})
		}
	}

	person, err := h.q.UpdatePerson(c.Context(), queries.UpdatePersonParams{
		ID:          id,
		Name:        req.Name,
		GroupID:     groupID,
		BookedTable: req.BookedTable,
	})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "person not found",
			"code":  "NOT_FOUND",
		})
	}
	return c.JSON(person)
}

type assignSeatRequest struct {
	TableRef string `json:"table_ref"`
	SeatRef  string `json:"seat_ref"`
}

func (h *PersonHandler) AssignSeat(c *fiber.Ctx) error {
	id, err := parseUUID(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid person ID",
			"code":  "BAD_REQUEST",
		})
	}

	existing, err := h.q.GetPerson(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "person not found",
			"code":  "NOT_FOUND",
		})
	}
	if resp := checkEventOwnership(c, h.q, existing.EventID); resp != nil {
		return resp
	}

	var req assignSeatRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
			"code":  "BAD_REQUEST",
		})
	}

	person, err := h.q.AssignSeat(c.Context(), queries.AssignSeatParams{
		ID:       id,
		TableRef: &req.TableRef,
		SeatRef:  &req.SeatRef,
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
			"error": "failed to assign seat",
			"code":  "INTERNAL_ERROR",
		})
	}

	if existing.EventID.Valid {
		h.sse.Broadcast(uuidToString(existing.EventID), "seat_assigned", person)
	}

	return c.JSON(person)
}

func (h *PersonHandler) Park(c *fiber.Ctx) error {
	id, err := parseUUID(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid person ID",
			"code":  "BAD_REQUEST",
		})
	}

	existing, err := h.q.GetPerson(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "person not found",
			"code":  "NOT_FOUND",
		})
	}
	if resp := checkEventOwnership(c, h.q, existing.EventID); resp != nil {
		return resp
	}

	person, err := h.q.ParkPerson(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "person not found",
			"code":  "NOT_FOUND",
		})
	}

	if existing.EventID.Valid {
		h.sse.Broadcast(uuidToString(existing.EventID), "person_parked", person)
	}

	return c.JSON(person)
}

func (h *PersonHandler) Delete(c *fiber.Ctx) error {
	id, err := parseUUID(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid person ID",
			"code":  "BAD_REQUEST",
		})
	}

	// Get person before delete for SSE and ownership check
	person, err := h.q.GetPerson(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "person not found",
			"code":  "NOT_FOUND",
		})
	}
	if resp := checkEventOwnership(c, h.q, person.EventID); resp != nil {
		return resp
	}

	if err := h.q.DeletePerson(c.Context(), id); err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "person not found",
			"code":  "NOT_FOUND",
		})
	}

	if person.EventID.Valid {
		h.sse.Broadcast(uuidToString(person.EventID), "person_deleted", fiber.Map{"id": uuidToString(id)})
	}

	return c.SendStatus(fiber.StatusNoContent)
}

type swapRequest struct {
	PersonAID string `json:"person_a_id"`
	PersonBID string `json:"person_b_id"`
}

func (h *PersonHandler) Swap(c *fiber.Ctx) error {
	var req swapRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
			"code":  "BAD_REQUEST",
		})
	}

	idA, err := parseUUID(req.PersonAID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid person_a_id",
			"code":  "BAD_REQUEST",
		})
	}

	idB, err := parseUUID(req.PersonBID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid person_b_id",
			"code":  "BAD_REQUEST",
		})
	}

	personA, err := h.q.GetPerson(c.Context(), idA)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "person A not found",
			"code":  "NOT_FOUND",
		})
	}
	personB, err := h.q.GetPerson(c.Context(), idB)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "person B not found",
			"code":  "NOT_FOUND",
		})
	}
	if uuidToString(personA.EventID) != uuidToString(personB.EventID) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "persons must belong to the same event",
			"code":  "VALIDATION_ERROR",
		})
	}

	if resp := checkEventOwnership(c, h.q, personA.EventID); resp != nil {
		return resp
	}

	if err := h.q.SwapSeats(c.Context(), queries.SwapSeatsParams{
		ID:   idA,
		ID_2: idB,
	}); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to swap seats",
			"code":  "INTERNAL_ERROR",
		})
	}

	if personA.EventID.Valid {
		h.sse.Broadcast(uuidToString(personA.EventID), "seats_swapped", fiber.Map{
			"person_a_id": req.PersonAID,
			"person_b_id": req.PersonBID,
		})
	}

	return c.JSON(fiber.Map{"status": "swapped"})
}
