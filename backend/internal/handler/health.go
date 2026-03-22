package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

type HealthHandler struct {
	db *pgxpool.Pool
}

func NewHealthHandler(db *pgxpool.Pool) *HealthHandler {
	return &HealthHandler{db: db}
}

func (h *HealthHandler) HealthCheck(c *fiber.Ctx) error {
	if err := h.db.Ping(c.Context()); err != nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"status":   "unhealthy",
			"database": "disconnected",
		})
	}
	return c.JSON(fiber.Map{
		"status":   "healthy",
		"database": "connected",
	})
}
