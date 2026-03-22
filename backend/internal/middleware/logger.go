package middleware

import (
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog"
)

func Logger() fiber.Handler {
	logger := zerolog.New(zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: time.RFC3339}).
		With().Timestamp().Logger()

	return func(c *fiber.Ctx) error {
		start := time.Now()
		err := c.Next()
		logger.Info().
			Str("method", c.Method()).
			Str("path", c.Path()).
			Int("status", c.Response().StatusCode()).
			Dur("latency", time.Since(start)).
			Msg("request")
		return err
	}
}
