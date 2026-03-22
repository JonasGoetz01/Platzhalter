package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/jgotz/platzhalter/backend/internal/db/queries"
)

type GroupHandler struct {
	q   *queries.Queries
	sse *SSEHandler
}

func NewGroupHandler(q *queries.Queries, sse *SSEHandler) *GroupHandler {
	return &GroupHandler{q: q, sse: sse}
}

type createGroupRequest struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

func (h *GroupHandler) Create(c *fiber.Ctx) error {
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

	var req createGroupRequest
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

	if req.Color == "" {
		req.Color = "#6366f1"
	}

	if !hexColorRegexp.MatchString(req.Color) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "color must be a valid hex color (e.g. #ff00aa)",
			"code":  "VALIDATION_ERROR",
		})
	}

	group, err := h.q.CreateGroup(c.Context(), queries.CreateGroupParams{
		EventID: eventID,
		Name:    req.Name,
		Color:   req.Color,
	})
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to create group",
			"code":  "INTERNAL_ERROR",
		})
	}

	h.sse.Broadcast(uuidToString(eventID), "group_created", group)
	return c.Status(fiber.StatusCreated).JSON(group)
}

func (h *GroupHandler) List(c *fiber.Ctx) error {
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

	groups, err := h.q.ListGroupsByEvent(c.Context(), eventID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to list groups",
			"code":  "INTERNAL_ERROR",
		})
	}
	return c.JSON(groups)
}

func (h *GroupHandler) Update(c *fiber.Ctx) error {
	id, err := parseUUID(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid group ID",
			"code":  "BAD_REQUEST",
		})
	}

	existing, err := h.q.GetGroup(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "group not found",
			"code":  "NOT_FOUND",
		})
	}
	if resp := checkEventOwnership(c, h.q, existing.EventID); resp != nil {
		return resp
	}

	var req createGroupRequest
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

	if req.Color != "" && !hexColorRegexp.MatchString(req.Color) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "color must be a valid hex color (e.g. #ff00aa)",
			"code":  "VALIDATION_ERROR",
		})
	}

	group, err := h.q.UpdateGroup(c.Context(), queries.UpdateGroupParams{
		ID:    id,
		Name:  req.Name,
		Color: req.Color,
	})
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "group not found",
			"code":  "NOT_FOUND",
		})
	}
	return c.JSON(group)
}

func (h *GroupHandler) Delete(c *fiber.Ctx) error {
	id, err := parseUUID(c.Params("id"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid group ID",
			"code":  "BAD_REQUEST",
		})
	}

	existing, err := h.q.GetGroup(c.Context(), id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "group not found",
			"code":  "NOT_FOUND",
		})
	}
	if resp := checkEventOwnership(c, h.q, existing.EventID); resp != nil {
		return resp
	}

	if err := h.q.DeleteGroup(c.Context(), id); err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "group not found",
			"code":  "NOT_FOUND",
		})
	}
	return c.SendStatus(fiber.StatusNoContent)
}

type mergeGroupsRequest struct {
	SourceID string `json:"source_id"`
	TargetID string `json:"target_id"`
}

func (h *GroupHandler) Merge(c *fiber.Ctx) error {
	var req mergeGroupsRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
			"code":  "BAD_REQUEST",
		})
	}

	sourceID, err := parseUUID(req.SourceID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid source_id",
			"code":  "BAD_REQUEST",
		})
	}

	targetID, err := parseUUID(req.TargetID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid target_id",
			"code":  "BAD_REQUEST",
		})
	}

	sourceGroup, err := h.q.GetGroup(c.Context(), sourceID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "source group not found",
			"code":  "NOT_FOUND",
		})
	}
	if resp := checkEventOwnership(c, h.q, sourceGroup.EventID); resp != nil {
		return resp
	}

	targetGroup, err := h.q.GetGroup(c.Context(), targetID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "target group not found",
			"code":  "NOT_FOUND",
		})
	}
	if uuidToString(sourceGroup.EventID) != uuidToString(targetGroup.EventID) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "groups must belong to the same event",
			"code":  "VALIDATION_ERROR",
		})
	}

	// Move all persons from source to target group
	if err := h.q.MergeGroups(c.Context(), queries.MergeGroupsParams{
		GroupID:   sourceID,
		GroupID_2: targetID,
	}); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to merge groups",
			"code":  "INTERNAL_ERROR",
		})
	}

	// Delete the source group
	if err := h.q.DeleteGroup(c.Context(), sourceID); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to delete source group",
			"code":  "INTERNAL_ERROR",
		})
	}

	return c.JSON(fiber.Map{"status": "merged"})
}
