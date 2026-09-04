import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const rubik = Rubik({
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
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
      <body className="min-h-full flex flex-col bg-tactical-bg text-slate-950 selection:bg-cyan-200 selection:text-slate-950">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
