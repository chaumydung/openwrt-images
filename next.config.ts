import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// SA-CONFIG-001: Content-Security-Policy.
// 'unsafe-inline' in script-src is required by the inline JSON-LD <script> blocks
// and the GTM bootstrap snippet (production only); upgrade to a nonce-based policy later.
// Dev-only relaxations: 'unsafe-eval' (react-refresh) and ws: (HMR websocket).
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self' https://www.google-analytics.com${isDev ? " ws:" : ""}`,
  "frame-src https://www.googletagmanager.com",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
