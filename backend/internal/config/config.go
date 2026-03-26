package config

import (
	"fmt"

	"github.com/caarlos0/env/v11"
	"github.com/joho/godotenv"
)

type Config struct {
	AppEnv       string `env:"APP_ENV" envDefault:"development"`
	BackendPort  string `env:"BACKEND_PORT" envDefault:"8080"`
	BackendHost  string `env:"BACKEND_HOST" envDefault:"127.0.0.1"`
	FrontendPort string `env:"FRONTEND_PORT" envDefault:"3000"`
	DatabaseURL  string `env:"DATABASE_URL,required"`
	JWTSecret    string `env:"JWT_SECRET,required"`
	JWKSURL      string `env:"JWKS_URL"`

	// Auto-seed first admin
	AdminEmail    string `env:"ADMIN_EMAIL"`
	AdminPassword string `env:"ADMIN_PASSWORD"`
	AdminName     string `env:"ADMIN_NAME" envDefault:"Admin"`
}

func Load() (*Config, error) {
	_ = godotenv.Load("../.env")

	cfg := &Config{}
	if err := env.Parse(cfg); err != nil {
		return nil, err
	}

	// Default JWKS URL: BetterAuth on frontend
	if cfg.JWKSURL == "" {
		cfg.JWKSURL = fmt.Sprintf("http://127.0.0.1:%s/api/auth/jwks", cfg.FrontendPort)
	}

	return cfg, nil
}
