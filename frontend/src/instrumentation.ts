export async function register() {
  // Only run on the server, and only in development
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { seedAdmin } = await import("./lib/seed")
    await seedAdmin()
  }
}
