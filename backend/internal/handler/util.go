package handler

import (
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
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
