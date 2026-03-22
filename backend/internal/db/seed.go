package db

import (
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

func AutoSeedAdmin(ctx context.Context, pool *pgxpool.Pool, email, password, name string) error {
	if email == "" || password == "" {
		return nil
	}

	var count int
	err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM "user"`).Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to count users: %w", err)
	}

	if count > 0 {
		return nil
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	_, err = pool.Exec(ctx, `
		INSERT INTO "user" (id, name, email, "emailVerified", role)
		VALUES (gen_random_uuid()::TEXT, $1, $2, TRUE, 'admin')
	`, name, email)
	if err != nil {
		return fmt.Errorf("failed to create admin user: %w", err)
	}

	// Create the credential account for BetterAuth
	_, err = pool.Exec(ctx, `
		INSERT INTO account (id, "userId", "accountId", "providerId", password)
		SELECT gen_random_uuid()::TEXT, u.id, u.id, 'credential', $1
		FROM "user" u WHERE u.email = $2
	`, string(hash), email)
	if err != nil {
		return fmt.Errorf("failed to create admin account: %w", err)
	}

	log.Printf("Auto-seeded admin user: %s (%s)", name, email)
	return nil
}
