import { betterAuth } from "better-auth";
import { jwt, admin, twoFactor } from "better-auth/plugins";
import { Pool } from "pg";

const port = process.env.FRONTEND_PORT || "3000";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || `http://localhost:${port}`,
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "moderator",
        input: false,
      },
    },
  },
  plugins: [
    admin({
      defaultRole: "moderator",
    }),
    twoFactor({
      issuer: "Platzhalter",
    }),
    jwt({
      jwt: {
        expirationTime: "15m",
        issuer: "platzhalter",
        audience: "platzhalter-api",
      },
      jwks: {
        keyPairConfig: {
          alg: "RS256",
        },
      },
    }),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  trustedOrigins: [
    `http://localhost:${process.env.FRONTEND_PORT || "3000"}`,
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
  ],
});
