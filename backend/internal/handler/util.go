package handler

import (
	"fmt"
	"regexp"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jgotz/platzhalter/backend/internal/db/queries"
	"github.com/jgotz/platzhalter/backend/internal/middleware"
)

func parseUUID(s string) (pgtype.UUID, error) {
	u, err := uuid.Parse(s)
	if err != nil {
		return pgtype.UUID{}, fmt.Errorf("invalid UUID: %w", err)
	}
	return pgtype.UUID{Bytes: u, Valid: true}, nil
}

func uuidToString(u pgtype.UUID) string {
	if !u.Valid {
		return ""
	}
	uid := uuid.UUID(u.Bytes)
	return uid.String()
}

// checkEventOwnership verifies the authenticated user owns the event.
// Returns a 403 response if not, or nil if ownership is confirmed.
func checkEventOwnership(c *fiber.Ctx, q *queries.Queries, eventID pgtype.UUID) error {
	userID := middleware.GetUserID(c)
	event, err := q.GetEvent(c.Context(), eventID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "event not found",
			"code":  "NOT_FOUND",
		})
	}
	if event.CreatedBy != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "you do not own this event",
			"code":  "FORBIDDEN",
		})
	}
	return nil
}

var hexColorRegexp = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)
