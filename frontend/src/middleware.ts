import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const backendHost = process.env.BACKEND_HOST || "127.0.0.1"
  const backendPort = process.env.BACKEND_PORT || "8080"
  const backendUrl = `http://${backendHost}:${backendPort}`

  const { pathname, search } = request.nextUrl
  const target = new URL(`${pathname}${search}`, backendUrl)

  return NextResponse.rewrite(target)
}

export const config = {
  matcher: ["/api/v1/:path*", "/api/health"],
}
