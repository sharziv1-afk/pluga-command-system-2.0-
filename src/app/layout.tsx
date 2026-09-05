import type { Metadata } from "next";
import { Rubik } from "next/font/google";
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
  icons: { icon: '/icon.svg' },
};

export const viewport = {
  themeColor: '#FF6B02',
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
    >
      <head>
        {/*
          Apply the saved theme BEFORE first paint.

          ThemeToggle/ContrastToggle set these attributes in a useEffect, i.e.
          after hydration, so every load painted light and then flipped. That
          caused two real problems: a light flash on each load, and — inside
          the bottom nav's backdrop-filter containing block — Chrome not
          re-resolving custom properties on the flip, leaving those labels on
          the light-mode ink over a dark bar (~3.1:1). Setting the attributes
          here means the very first paint is already correct and there is no
          flip to miss. The toggles still own changes at runtime.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var t=localStorage.getItem('pluga_theme')==='dark'?'dark':'light';d.dataset.theme=t;d.style.colorScheme=t;if(localStorage.getItem('pluga_contrast')==='high'){d.dataset.contrast='high';}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-tactical-bg text-[var(--text-primary)] selection:bg-cyan-200 selection:text-[var(--text-primary)]">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
