package model

import "time"

type User struct {
	ID            string    `json:"id"`
	Email         string    `json:"email"`
	Name          string    `json:"name"`
	PasswordHash  string    `json:"-"`
	EmailVerified bool      `json:"email_verified"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}
