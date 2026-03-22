package middleware

import (
	"fmt"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

func CORS(frontendPort string) fiber.Handler {
	return cors.New(cors.Config{
		AllowOrigins:     fmt.Sprintf("http://localhost:%s", frontendPort),
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowMethods:     "GET, POST, PUT, PATCH, DELETE, OPTIONS",
		AllowCredentials: true,
	})
}
