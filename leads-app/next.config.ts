import type { NextConfig } from "next";

const prod = process.env.NODE_ENV === "production";

// SPEC_02 5.8: security headers on every response.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(prod ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // the Python service lives in this folder but is never part of the web bundle
  outputFileTracingExcludes: { "*": ["python-service/**", "e2e/**", "test/**", "scripts/**", ".data/**"] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
