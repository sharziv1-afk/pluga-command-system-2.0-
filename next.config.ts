import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

/**
 * Every LAN address this machine currently answers on.
 *
 * This used to be a hand-maintained list of four 192.168.x addresses, which
 * meant two things: it broke every time DHCP handed out a different one (the
 * failure mode is the worst kind — the page loads, hydration is refused, and
 * every button silently does nothing), and it was the one piece of this repo
 * that only worked on the machine it was written on. Moving the project to a
 * new computer would have inherited a list of a previous machine's addresses.
 *
 * Reading the interfaces instead means it is correct on any machine, on any
 * network, with no list to maintain — including after a router hands out a
 * new lease mid-session. Dev-only; `next start` ignores it entirely.
 */
function localNetworkOrigins(): string[] {
  const addresses = new Set<string>();
  try {
    for (const iface of Object.values(networkInterfaces())) {
      for (const net of iface ?? []) {
        // IPv4 only, and skip loopback — Next already allows localhost, and a
        // phone cannot reach 127.0.0.1 on someone else's machine anyway.
        if (net.family === "IPv4" && !net.internal) addresses.add(net.address);
      }
    }
  } catch {
    // If the interface list is unavailable for any reason, degrade to "no LAN
    // origins allowed" rather than taking the dev server down with it.
  }
  return [...addresses];
}

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
  // Declared explicitly rather than left to fall back through child-src to
  // script-src. The offline service worker is the whole reason this app works
  // without signal, and a CSP that blocks its registration breaks that
  // silently — the page still loads, it just never caches anything, and the
  // failure only shows up on a phone with no reception. Not worth depending
  // on fallback behaviour for something with that failure mode.
  "worker-src 'self'",
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
  // Don't advertise the framework and version to anyone scanning.
  poweredByHeader: false,
  experimental: {
    // lucide-react re-exports every icon from one barrel file; without this
    // the whole set can be pulled into a chunk because one icon was imported.
    optimizePackageImports: ['lucide-react'],
  },
  // Dev-only: lets the dev server serve client JS/HMR to a phone on the same
  // network, so the page hydrates and onClick/onSubmit actually fire.
  // Detected at startup rather than hardcoded — see localNetworkOrigins above.
  // No effect on production builds.
  allowedDevOrigins: localNetworkOrigins(),
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
