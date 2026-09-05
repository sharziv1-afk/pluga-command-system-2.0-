import type { NextConfig } from "next";

// Supabase's origin has to be allowed explicitly in connect-src, otherwise the
// CSP blocks every API call. Read from the same env var the client uses so the
// header follows whichever project is configured, with a fallback so a missing
// env var degrades to "no Supabase connections allowed" rather than to a
// malformed header.
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin;
  } catch {
    return '';
  }
})();

/*
 * script-src and style-src carry 'unsafe-inline' deliberately. The pre-paint
 * theme script in layout.tsx is inline by necessity — it has to run before
 * first paint — and Next injects its own inline hydration scripts, as does
 * Tailwind for styles. A nonce would be stricter but has to be threaded
 * through middleware on every request; that is a change worth making on its
 * own, not smuggled into a config commit.
 *
 * The value here is in the other directives, which cost nothing and are not
 * weakened by the above: connect-src pins network calls to this origin and
 * Supabase, frame-ancestors blocks clickjacking, object-src kills plugin
 * embeds, base-uri stops <base> tag injection redirecting relative URLs.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin} ${supabaseOrigin.replace('https://', 'wss://')}` : ''}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  distDir: ".next-build",
  // Don't advertise the framework and version to anyone scanning.
  poweredByHeader: false,
  experimental: {
    // lucide-react re-exports every icon from one barrel file; without this
    // the whole set can be pulled into a chunk because one icon was imported.
    optimizePackageImports: ['lucide-react'],
  },
  // Dev-only: allow the dev server to serve client JS/HMR to a phone on the
  // local network so the page hydrates and onClick/onSubmit work. The LAN IP
  // changes across sessions (DHCP) — when phone testing breaks again with
  // buttons doing nothing, check `ipconfig` and add the current IP here.
  // No effect on production builds.
  allowedDevOrigins: ["192.168.1.231", "192.168.1.233", "192.168.1.224"],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          // HSTS is honoured only over HTTPS, so it is inert on localhost and
          // takes effect once this is behind a TLS domain.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // This app asks for none of these; deny them so a compromised
          // dependency cannot either.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
