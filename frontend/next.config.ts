import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const backendUrl = `http://${process.env.BACKEND_HOST || "127.0.0.1"}:${process.env.BACKEND_PORT || "8080"}`;

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return {
      // Auth routes handled by Next.js (BetterAuth) - no rewrite needed
      // All other /api routes proxy to Go Fiber backend
      beforeFiles: [],
      afterFiles: [
        {
          source: "/api/v1/:path*",
          destination: `${backendUrl}/api/v1/:path*`,
        },
        {
          source: "/api/health",
          destination: `${backendUrl}/api/health`,
        },
      ],
      fallback: [],
    };
  },
  serverExternalPackages: ["pg"],
};

export default withNextIntl(nextConfig);
