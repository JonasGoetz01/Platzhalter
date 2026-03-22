package handler

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jgotz/platzhalter/backend/internal/db/queries"
)

type Handlers struct {
	Health    *HealthHandler
	Event     *EventHandler
	FloorPlan *FloorPlanHandler
	Person    *PersonHandler
	Admin     *AdminHandler
	SSE       *SSEHandler
}

func NewHandlers(pool *pgxpool.Pool) *Handlers {
	q := queries.New(pool)
	sse := NewSSEHandler()

	return &Handlers{
		Health:    NewHealthHandler(pool),
		Event:     NewEventHandler(q, pool),
		FloorPlan: NewFloorPlanHandler(q),
		Person:    NewPersonHandler(q, pool, sse),
		Admin:     NewAdminHandler(q),
		SSE:       sse,
	}
}
