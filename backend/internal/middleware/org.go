package middleware

import (
	"context"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

const OrgIDKey contextKey = "org_id"

// OptionalOrg reads the X-Organization-Id header, verifies the authenticated user
// is a member of that organization, and stores the org ID in Fiber locals.
// If the header is absent the request proceeds without org context.
func OptionalOrg(pool *pgxpool.Pool) fiber.Handler {
	return func(c *fiber.Ctx) error {
		orgID := c.Get("X-Organization-Id")
		if orgID == "" {
			return c.Next()
		}

		userID := GetUserID(c)
		if userID == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "authentication required",
				"code":  "UNAUTHORIZED",
			})
		}

		// Verify user is a member of this organization
		var memberRole string
		err := pool.QueryRow(
			context.Background(),
			`SELECT role FROM member WHERE "organizationId" = $1 AND "userId" = $2`,
			orgID, userID,
		).Scan(&memberRole)
		if err != nil {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "not a member of this organization",
				"code":  "FORBIDDEN",
			})
		}

		c.Locals(string(OrgIDKey), orgID)
		return c.Next()
	}
}

// GetOrgID retrieves the active organization ID from Fiber locals.
// Returns empty string if no org context is set.
func GetOrgID(c *fiber.Ctx) string {
	if v, ok := c.Locals(string(OrgIDKey)).(string); ok {
		return v
	}
	return ""
}
