import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Providers from "./providers";

// Four weights, matching the four roles in DESIGN.md §2.2 — 300/800/900 were
// dropped once the weight-role rollout left zero `font-black` in src/ (§2.3
// made that the precondition, because dropping 900 while call sites still ask
// for it makes the browser synthesise a worse-looking bold). This halves the
// font payload: 4 weights x 2 subsets instead of 7 x 2.
const rubik = Rubik({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-rubik",
  display: "swap",
});

export const metadata: Metadata = {
  title: 'המפקד - מערכת פיקוד פלוגתית טקטית',
  description: 'מערכת פיקוד ובקרה פלוגתית מתקדמת (Pluga Command System) המרכזת משימות, פערים, לוגיסטיקה, לו״ז וסד״כ בזמן אמת.',
  manifest: '/manifest.json',
  // iOS ignores SVG icons entirely: without a PNG apple-touch-icon,
  // "Add to Home Screen" uses a screenshot of the page as the icon.
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'המפקד',
    // Paired with viewportFit: 'cover', this is what makes the status bar
    // area take the app's own background instead of rendering a white band.
    statusBarStyle: 'black-translucent',
  },
};

export const viewport = {
  themeColor: '#FF6B02',
  // Without viewportFit the safe-area insets resolve to 0 on iPhone, which
  // made globals.css's .safe-bottom-nav a no-op and left the bottom nav
  // sitting under the home indicator. Setting it lets the page paint into
  // the notch/indicator areas, and the env() padding then does its job.
  viewportFit: 'cover' as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`h-full antialiased ${rubik.variable}`}
      // The pre-paint script below stamps data-theme/data-contrast/color-scheme
      // onto this element before React hydrates, so the server HTML and the
      // client DOM deliberately differ here. Without this, every page logs a
      // hydration-mismatch error. Scoped to <html>'s own attributes only.
      suppressHydrationWarning>
      {/*
        Apply the saved theme BEFORE first paint.

        ThemeToggle/ContrastToggle set these attributes in a useEffect, i.e.
        after hydration, so every load painted light and then flipped. That
        caused two real problems: a light flash on each load, and — inside the
        bottom nav's backdrop-filter containing block — Chrome not re-resolving
        custom properties on the flip, leaving those labels on the light-mode
        ink over a dark bar (~3.1:1). Setting the attributes here means the
        first paint is already correct and there is no flip to miss. The
        toggles still own runtime changes.

        next/script with beforeInteractive rather than a raw <script>: React
        warns that script tags inside components are not executed on client
        render, and this is the API Next provides for exactly this case.
      */}
      <head>
        <Script id="theme-preload" strategy="beforeInteractive">
          {`(function(){try{var d=document.documentElement;var t=localStorage.getItem('pluga_theme')==='dark'?'dark':'light';d.dataset.theme=t;d.style.colorScheme=t;if(localStorage.getItem('pluga_contrast')==='high'){d.dataset.contrast='high';}}catch(e){}})();`}
        </Script>
      </head>
      <body className="min-h-full flex flex-col bg-tactical-bg text-[var(--text-primary)] selection:bg-cyan-200 selection:text-[var(--text-primary)]">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
