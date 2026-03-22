package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"

	root "github.com/jgotz/platzhalter/backend"
	"github.com/jgotz/platzhalter/backend/internal/config"
	"github.com/jgotz/platzhalter/backend/internal/db"
	"github.com/jgotz/platzhalter/backend/internal/handler"
	"github.com/jgotz/platzhalter/backend/internal/middleware"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer pool.Close()

	// Run embedded migrations on startup
	if err := runMigrations(cfg.DatabaseURL); err != nil {
		log.Fatalf("failed to run migrations: %v", err)
	}

	app := fiber.New(fiber.Config{
		AppName:      "Platzhalter API",
		ErrorHandler: errorHandler,
	})

	// Global middleware
	app.Use(recover.New())
	app.Use(middleware.RequestID())
	app.Use(middleware.Logger())
	app.Use(middleware.CORS(cfg.FrontendPort))

	// Public routes
	api := app.Group("/api")
	h := handler.NewHandlers(pool)
	api.Get("/health", h.Health.HealthCheck)

	// Protected routes (JWT required)
	v1 := api.Group("/v1", middleware.JWTAuth(cfg.JWTSecret, cfg.JWKSURL))

	// Events
	v1.Get("/events", h.Event.List)
	v1.Post("/events", h.Event.Create)
	v1.Get("/events/:id", h.Event.Get)
	v1.Put("/events/:id", h.Event.Update)
	v1.Delete("/events/:id", h.Event.Delete)

	// Floor plans
	v1.Get("/events/:id/floorplan", h.FloorPlan.Get)
	v1.Put("/events/:id/floorplan", h.FloorPlan.Update)

	// Persons
	v1.Get("/events/:eventId/persons", h.Person.List)
	v1.Post("/events/:eventId/persons", h.Person.Create)
	v1.Put("/persons/:id", h.Person.Update)
	v1.Put("/persons/:id/seat", h.Person.AssignSeat)
	v1.Put("/persons/:id/park", h.Person.Park)
	v1.Delete("/persons/:id", h.Person.Delete)
	v1.Post("/persons/swap", h.Person.Swap)
	v1.Post("/persons/bulk-assign", h.Person.BulkAssign)

	// Groups
	v1.Get("/events/:eventId/groups", h.Group.List)
	v1.Post("/events/:eventId/groups", h.Group.Create)
	v1.Put("/groups/:id", h.Group.Update)
	v1.Delete("/groups/:id", h.Group.Delete)
	v1.Post("/groups/merge", h.Group.Merge)

	// SSE for real-time updates
	v1.Get("/events/:id/stream", h.SSE.Stream)

	// Admin routes (admin role only)
	admin := v1.Group("/admin", middleware.RequireRole("admin"))
	admin.Get("/users", h.Admin.ListUsers)
	admin.Put("/users/:id/role", h.Admin.UpdateRole)
	admin.Delete("/users/:id", h.Admin.DeleteUser)

	// Graceful shutdown
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		log.Println("Shutting down server...")
		_ = app.Shutdown()
	}()

	addr := fmt.Sprintf("%s:%s", cfg.BackendHost, cfg.BackendPort)
	log.Printf("Starting server on %s", addr)
	if err := app.Listen(addr); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func runMigrations(databaseURL string) error {
	d, err := iofs.New(root.MigrationsFS, "migrations")
	if err != nil {
		return fmt.Errorf("create migration source: %w", err)
	}
	m, err := migrate.NewWithSourceInstance("iofs", d, databaseURL)
	if err != nil {
		return fmt.Errorf("create migrator: %w", err)
	}
	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("apply migrations: %w", err)
	}
	srcErr, dbErr := m.Close()
	if srcErr != nil {
		return fmt.Errorf("close migration source: %w", srcErr)
	}
	if dbErr != nil {
		return fmt.Errorf("close migration db: %w", dbErr)
	}
	log.Println("Database migrations applied successfully")
	return nil
}

func errorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
	}
	return c.Status(code).JSON(fiber.Map{
		"error":      err.Error(),
		"code":       "INTERNAL_ERROR",
		"request_id": c.GetRespHeader("X-Request-ID"),
	})
}
