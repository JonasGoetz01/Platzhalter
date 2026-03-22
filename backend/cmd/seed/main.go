package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/caarlos0/env/v11"
)

type seedConfig struct {
	DatabaseURL string `env:"DATABASE_URL,required"`
}

// ── Floorplan layout types ──────────────────────────────────

type edgeConfig struct {
	SeatCount int `json:"seatCount"`
}

type floorPlanTable struct {
	ID       string                `json:"id"`
	Label    string                `json:"label"`
	X        float64               `json:"x"`
	Y        float64               `json:"y"`
	Width    float64               `json:"width"`
	Height   float64               `json:"height"`
	Rotation float64               `json:"rotation"`
	Edges    map[string]edgeConfig `json:"edges"`
}

type floorPlanLayout struct {
	Tables []floorPlanTable `json:"tables"`
	Width  int              `json:"width"`
	Height int              `json:"height"`
}

// ── Seed data ───────────────────────────────────────────────

var groupColors = []string{
	"#ef4444", "#f97316", "#eab308", "#22c55e",
	"#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
}

type groupDef struct {
	name    string
	color   string
	members []string
}

var groups = []groupDef{
	{
		name:  "Familie Müller",
		color: groupColors[0],
		members: []string{
			"Hans Müller", "Petra Müller", "Lukas Müller", "Anna Müller",
		},
	},
	{
		name:  "Familie Schmidt",
		color: groupColors[1],
		members: []string{
			"Thomas Schmidt", "Sabine Schmidt", "Felix Schmidt", "Marie Schmidt",
		},
	},
	{
		name:  "Arbeitskollegen",
		color: groupColors[2],
		members: []string{
			"Michael Weber", "Julia Fischer", "Stefan Wagner", "Claudia Becker",
			"Markus Hoffmann", "Andrea Schulz",
		},
	},
	{
		name:  "Studienfreunde",
		color: groupColors[3],
		members: []string{
			"Daniel Braun", "Lisa Zimmermann", "Patrick Krüger", "Nina Wolf",
		},
	},
	{
		name:  "Nachbarn",
		color: groupColors[4],
		members: []string{
			"Rainer Hartmann", "Monika Hartmann", "Klaus Lehmann",
		},
	},
}

var ungroupedGuests = []string{
	"Eva Richter", "Christian Baumann", "Susanne Frank",
	"Jörg Albrecht", "Katrin Schreiber", "Tobias Keller",
	"Birgit Lange", "Oliver Huber", "Melanie Koch",
	"Ralf Werner", "Anja Meier", "Dirk Vogel",
	"Heike Neumann", "Uwe Berger", "Petra Schwarz",
}

func main() {
	_ = godotenv.Load("../../.env")
	_ = godotenv.Load("../.env")
	_ = godotenv.Load(".env")

	cfg := &seedConfig{}
	if err := env.Parse(cfg); err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer pool.Close()

	if err := seed(ctx, pool); err != nil {
		log.Fatalf("seed failed: %v", err)
	}

	log.Println("Seed completed successfully!")
}

func seed(ctx context.Context, pool *pgxpool.Pool) error {
	// 1. Get the admin user (must exist from AutoSeedAdmin)
	var userID string
	err := pool.QueryRow(ctx, `SELECT id FROM "user" LIMIT 1`).Scan(&userID)
	if err != nil {
		return fmt.Errorf("no user found — start the server first so AutoSeedAdmin runs: %w", err)
	}
	log.Printf("Using user: %s", userID)

	// 2. Create event
	var eventID string
	err = pool.QueryRow(ctx, `
		INSERT INTO events (name, event_date, description, created_by)
		VALUES ($1, $2, $3, $4)
		RETURNING id::TEXT
	`, "Hochzeit Anna & Thomas", "2026-07-18", "Sommerhochzeit im Schlosshotel Kronberg", userID).Scan(&eventID)
	if err != nil {
		return fmt.Errorf("create event: %w", err)
	}
	log.Printf("Created event: %s", eventID)

	// 3. Create floor plan with tables
	tables := buildTables()
	layout := floorPlanLayout{
		Tables: tables,
		Width:  2000,
		Height: 1500,
	}
	layoutJSON, _ := json.Marshal(layout)

	_, err = pool.Exec(ctx, `
		INSERT INTO floor_plans (event_id, layout)
		VALUES ($1::UUID, $2::JSONB)
	`, eventID, layoutJSON)
	if err != nil {
		return fmt.Errorf("create floorplan: %w", err)
	}
	log.Printf("Created floorplan with %d tables", len(tables))

	// 4. Create groups and their members
	type seatAssignment struct {
		personID string
		tableID  string
		seatRef  string
	}
	var assignments []seatAssignment

	seatCursor := 0 // global seat counter across tables

	for i, g := range groups {
		var groupID string
		err = pool.QueryRow(ctx, `
			INSERT INTO groups (event_id, name, color, sort_order)
			VALUES ($1::UUID, $2, $3, $4)
			RETURNING id::TEXT
		`, eventID, g.name, g.color, i).Scan(&groupID)
		if err != nil {
			return fmt.Errorf("create group %s: %w", g.name, err)
		}
		log.Printf("Created group: %s (%d members)", g.name, len(g.members))

		for _, name := range g.members {
			var personID string
			err = pool.QueryRow(ctx, `
				INSERT INTO persons (event_id, name, group_id, parked)
				VALUES ($1::UUID, $2, $3::UUID, TRUE)
				RETURNING id::TEXT
			`, eventID, name, groupID).Scan(&personID)
			if err != nil {
				return fmt.Errorf("create person %s: %w", name, err)
			}

			// Assign seats to group members (keep them together on the same table)
			tableIdx, seatRef := assignSeatFromCursor(tables, seatCursor)
			if tableIdx >= 0 {
				assignments = append(assignments, seatAssignment{
					personID: personID,
					tableID:  tables[tableIdx].ID,
					seatRef:  seatRef,
				})
				seatCursor++
			}
		}
	}

	// 5. Create ungrouped guests
	for _, name := range ungroupedGuests {
		bookedTable := randomBookedTable(tables)

		var personID string
		err = pool.QueryRow(ctx, `
			INSERT INTO persons (event_id, name, parked, booked_table)
			VALUES ($1::UUID, $2, TRUE, $3)
			RETURNING id::TEXT
		`, eventID, name, bookedTable).Scan(&personID)
		if err != nil {
			return fmt.Errorf("create person %s: %w", name, err)
		}

		// Assign ~60% of ungrouped guests to seats
		if rand.Float64() < 0.6 {
			tableIdx, seatRef := assignSeatFromCursor(tables, seatCursor)
			if tableIdx >= 0 {
				assignments = append(assignments, seatAssignment{
					personID: personID,
					tableID:  tables[tableIdx].ID,
					seatRef:  seatRef,
				})
				seatCursor++
			}
		}
	}

	// 6. Execute seat assignments
	for _, a := range assignments {
		_, err = pool.Exec(ctx, `
			UPDATE persons
			SET table_ref = $2, seat_ref = $3, parked = FALSE, updated_at = NOW()
			WHERE id = $1::UUID
		`, a.personID, a.tableID, a.seatRef)
		if err != nil {
			return fmt.Errorf("assign seat: %w", err)
		}
	}
	log.Printf("Assigned %d seats", len(assignments))

	// Summary
	var totalPersons int
	pool.QueryRow(ctx, `SELECT COUNT(*) FROM persons WHERE event_id = $1::UUID`, eventID).Scan(&totalPersons)
	var seatedPersons int
	pool.QueryRow(ctx, `SELECT COUNT(*) FROM persons WHERE event_id = $1::UUID AND NOT parked`, eventID).Scan(&seatedPersons)
	log.Printf("Total guests: %d, seated: %d, unassigned: %d", totalPersons, seatedPersons, totalPersons-seatedPersons)

	return nil
}

func buildTables() []floorPlanTable {
	tables := []floorPlanTable{
		{
			ID: "table-braut", Label: "Brauttisch",
			X: 1000, Y: 300, Width: 350, Height: 100, Rotation: 0,
			Edges: map[string]edgeConfig{
				"top": {SeatCount: 5}, "bottom": {SeatCount: 5},
				"left": {SeatCount: 0}, "right": {SeatCount: 0},
			},
		},
		{
			ID: "table-1", Label: "Tisch 1",
			X: 500, Y: 650, Width: 250, Height: 100, Rotation: 0,
			Edges: map[string]edgeConfig{
				"top": {SeatCount: 4}, "bottom": {SeatCount: 4},
				"left": {SeatCount: 0}, "right": {SeatCount: 0},
			},
		},
		{
			ID: "table-2", Label: "Tisch 2",
			X: 1000, Y: 650, Width: 250, Height: 100, Rotation: 0,
			Edges: map[string]edgeConfig{
				"top": {SeatCount: 4}, "bottom": {SeatCount: 4},
				"left": {SeatCount: 0}, "right": {SeatCount: 0},
			},
		},
		{
			ID: "table-3", Label: "Tisch 3",
			X: 1500, Y: 650, Width: 250, Height: 100, Rotation: 0,
			Edges: map[string]edgeConfig{
				"top": {SeatCount: 4}, "bottom": {SeatCount: 4},
				"left": {SeatCount: 0}, "right": {SeatCount: 0},
			},
		},
		{
			ID: "table-4", Label: "Tisch 4",
			X: 500, Y: 1000, Width: 200, Height: 100, Rotation: 0,
			Edges: map[string]edgeConfig{
				"top": {SeatCount: 3}, "bottom": {SeatCount: 3},
				"left": {SeatCount: 1}, "right": {SeatCount: 1},
			},
		},
		{
			ID: "table-5", Label: "Tisch 5",
			X: 1000, Y: 1000, Width: 200, Height: 100, Rotation: 45,
			Edges: map[string]edgeConfig{
				"top": {SeatCount: 3}, "bottom": {SeatCount: 3},
				"left": {SeatCount: 0}, "right": {SeatCount: 0},
			},
		},
		{
			ID: "table-6", Label: "Tisch 6",
			X: 1500, Y: 1000, Width: 200, Height: 100, Rotation: 0,
			Edges: map[string]edgeConfig{
				"top": {SeatCount: 3}, "bottom": {SeatCount: 3},
				"left": {SeatCount: 1}, "right": {SeatCount: 1},
			},
		},
	}
	return tables
}

// assignSeatFromCursor maps a global seat index to (tableIndex, seatRef).
// It walks edges in order: top, right, bottom, left for each table.
func assignSeatFromCursor(tables []floorPlanTable, cursor int) (int, string) {
	edgeOrder := []string{"top", "right", "bottom", "left"}
	offset := 0

	for tableIdx, t := range tables {
		for _, edge := range edgeOrder {
			count := t.Edges[edge].SeatCount
			if cursor < offset+count {
				seatIndex := cursor - offset
				return tableIdx, fmt.Sprintf("%s-%d", edge, seatIndex)
			}
			offset += count
		}
	}

	return -1, "" // no more seats
}

// randomBookedTable returns a table label for ~30% of guests, nil otherwise.
func randomBookedTable(tables []floorPlanTable) *string {
	if rand.Float64() > 0.3 {
		return nil
	}
	label := tables[rand.Intn(len(tables))].Label
	return &label
}
