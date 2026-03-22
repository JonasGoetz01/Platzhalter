package middleware

import (
	"context"
	"log"
	"strings"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID string `json:"sub"`
	Role   string `json:"role"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

type contextKey string

const (
	UserIDKey contextKey = "user_id"
	RoleKey   contextKey = "role"
	EmailKey  contextKey = "email"
)

// JWTAuth validates JWTs issued by BetterAuth using JWKS endpoint.
// Falls back to HMAC shared secret if JWKS is unavailable.
func JWTAuth(jwtSecret string, jwksURL string) fiber.Handler {
	var jwksFunc jwt.Keyfunc

	// Try to initialize JWKS-based validation
	if jwksURL != "" {
		k, err := keyfunc.NewDefault([]string{jwksURL})
		if err != nil {
			log.Printf("warning: failed to initialize JWKS from %s: %v (falling back to shared secret)", jwksURL, err)
		} else {
			jwksFunc = k.KeyfuncCtx(context.Background())
		}
	}

	return func(c *fiber.Ctx) error {
		auth := c.Get("Authorization")
		var tokenStr string

		if auth != "" {
			tokenStr = strings.TrimPrefix(auth, "Bearer ")
			if tokenStr == auth {
				return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
					"error": "invalid authorization format",
					"code":  "UNAUTHORIZED",
				})
			}
		} else if t := c.Query("token"); t != "" {
			// Fallback: query param token for SSE (EventSource can't send headers)
			tokenStr = t
		} else {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "missing authorization header",
				"code":  "UNAUTHORIZED",
			})
		}

		claims := &Claims{}
		var token *jwt.Token
		var err error

		if jwksFunc != nil {
			// Validate with JWKS (RS256)
			token, err = jwt.ParseWithClaims(tokenStr, claims, jwksFunc)
		} else {
			// Fallback: validate with shared secret (HS256)
			token, err = jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
				return []byte(jwtSecret), nil
			})
		}

		if err != nil || !token.Valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "invalid or expired token",
				"code":  "UNAUTHORIZED",
			})
		}

		c.Locals(string(UserIDKey), claims.UserID)
		c.Locals(string(RoleKey), claims.Role)
		c.Locals(string(EmailKey), claims.Email)

		return c.Next()
	}
}

func RequireRole(roles ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		role, ok := c.Locals(string(RoleKey)).(string)
		if !ok || role == "" {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "no role found in token",
				"code":  "FORBIDDEN",
			})
		}

		for _, r := range roles {
			if role == r {
				return c.Next()
			}
		}

		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "insufficient permissions",
			"code":  "FORBIDDEN",
		})
	}
}

func GetUserID(c *fiber.Ctx) string {
	if v, ok := c.Locals(string(UserIDKey)).(string); ok {
		return v
	}
	return ""
}

func GetRole(c *fiber.Ctx) string {
	if v, ok := c.Locals(string(RoleKey)).(string); ok {
		return v
	}
	return ""
}
