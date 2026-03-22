package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/jgotz/platzhalter/backend/internal/db/queries"
	"github.com/jgotz/platzhalter/backend/internal/middleware"
)

type AdminHandler struct {
	q *queries.Queries
}

func NewAdminHandler(q *queries.Queries) *AdminHandler {
	return &AdminHandler{q: q}
}

func (h *AdminHandler) ListUsers(c *fiber.Ctx) error {
	users, err := h.q.ListUsers(c.Context())
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "failed to list users",
			"code":  "INTERNAL_ERROR",
		})
	}
	return c.JSON(users)
}

type updateRoleRequest struct {
	Role string `json:"role"`
}

func (h *AdminHandler) UpdateRole(c *fiber.Ctx) error {
	userID := c.Params("id")
	callerID := middleware.GetUserID(c)

	if userID == callerID {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "cannot change your own role",
			"code":  "BAD_REQUEST",
		})
	}

	var req updateRoleRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid request body",
			"code":  "BAD_REQUEST",
		})
	}

	if req.Role != "admin" && req.Role != "moderator" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "role must be 'admin' or 'moderator'",
			"code":  "VALIDATION_ERROR",
		})
	}

	if err := h.q.UpdateUserRole(c.Context(), queries.UpdateUserRoleParams{
		ID:   userID,
		Role: req.Role,
	}); err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "user not found",
			"code":  "NOT_FOUND",
		})
	}

	return c.JSON(fiber.Map{"status": "updated"})
}

func (h *AdminHandler) DeleteUser(c *fiber.Ctx) error {
	userID := c.Params("id")
	callerID := middleware.GetUserID(c)

	if userID == callerID {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "cannot delete yourself",
			"code":  "BAD_REQUEST",
		})
	}

	if err := h.q.DeleteUser(c.Context(), userID); err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "user not found",
			"code":  "NOT_FOUND",
		})
	}

	return c.SendStatus(fiber.StatusNoContent)
}
