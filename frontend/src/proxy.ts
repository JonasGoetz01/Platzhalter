import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  // Proxy /api/v1/* and /api/health to the Go backend (runtime env vars)
  if (pathname.startsWith("/api/v1/") || pathname === "/api/health") {
    const backendHost = process.env.BACKEND_HOST || "127.0.0.1"
    const backendPort = process.env.BACKEND_PORT || "8080"
    const target = new URL(`${pathname}${search}`, `http://${backendHost}:${backendPort}`)
    return NextResponse.rewrite(target)
  }

  const response = NextResponse.next()

  // Security headers
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  )

  return response
}

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico|icon-.*\\.png|manifest\\.json).*)",
  ],
}
