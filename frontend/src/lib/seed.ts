import { Pool } from "pg"
import { auth } from "./auth-server"

export async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  const name = process.env.ADMIN_NAME || "Admin"

  if (!email || !password) {
    console.log("[seed] ADMIN_EMAIL or ADMIN_PASSWORD not set, skipping")
    return
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  try {
    // Check if any users exist
    const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM "user"')
    if (rows[0].count > 0) {
      console.log("[seed] Users already exist, skipping admin seed")
      return
    }

    // Use BetterAuth's sign-up API to create the user (ensures correct password hashing)
    const result = await auth.api.signUpEmail({
      body: { email, password, name },
    })

    if (result?.user?.id) {
      // BetterAuth defaults role to 'moderator', promote to admin
      await pool.query('UPDATE "user" SET role = $1 WHERE id = $2', [
        "admin",
        result.user.id,
      ])
      console.log(`[seed] Admin user created: ${name} (${email})`)
    }
  } catch (err: any) {
    console.error("[seed] Failed to seed admin:", err?.message || err)
  } finally {
    await pool.end()
  }
}
