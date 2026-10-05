import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Fraunces, IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/shell";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  style: ["normal", "italic"],
});

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const plex = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "M & A — AI Real Estate Creative Studio",
  description:
    "Turn property photos, project websites and briefs into professional, ready-to-publish real-estate campaigns.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${fraunces.variable} ${inter.variable} ${plex.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try { const saved = localStorage.getItem("arena-theme"); document.documentElement.dataset.theme = saved === "light" || saved === "dark" ? saved : (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"); } catch { document.documentElement.dataset.theme = "dark"; }`,
          }}
        />
      </head>
      <body className="bg-ink font-sans text-cream antialiased">
        <div className="backdrop" />
        <div className="grain" />
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
