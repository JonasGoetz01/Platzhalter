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

// checkEventAccess verifies the authenticated user can access the event.
// If an org context is present, checks the event belongs to that org.
// Otherwise falls back to created_by ownership check.
// Returns a fiber response if access is denied, or nil if access is confirmed.
func checkEventAccess(c *fiber.Ctx, q *queries.Queries, eventID pgtype.UUID) error {
	event, err := q.GetEvent(c.Context(), eventID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": "event not found",
			"code":  "NOT_FOUND",
		})
	}

	orgID := middleware.GetOrgID(c)
	if orgID != "" {
		// Org context: verify event belongs to this org
		if event.OrganizationID == nil || *event.OrganizationID != orgID {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "event does not belong to this organization",
				"code":  "FORBIDDEN",
			})
		}
		return nil
	}

	// Fallback: created_by ownership check
	userID := middleware.GetUserID(c)
	if event.CreatedBy != userID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "you do not own this event",
			"code":  "FORBIDDEN",
		})
	}
	return nil
}

var hexColorRegexp = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)
