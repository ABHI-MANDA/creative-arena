import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { Fraunces, IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/shell";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const plex = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex",
  weight: ["400", "500"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0b0a08",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "M & A — AI Real Estate Creative Studio",
  description:
    "Turn property photos, project websites and briefs into professional, ready-to-publish real-estate campaigns.",
  icons: {
    icon: "/images/brand-logo.png",
    shortcut: "/images/brand-logo.png",
    apple: "/images/brand-logo.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${fraunces.variable} ${inter.variable} ${plex.variable}`}>
      <head>
        <link rel="preconnect" href="https://platform-outputs.agnes-ai.space" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://platform-outputs.agnes-ai.space" />
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
      </head>
      <body className="bg-ink font-sans text-cream antialiased">
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `try{const s=localStorage.getItem("arena-theme");document.documentElement.dataset.theme=s==="light"||s==="dark"?s:(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");}catch{document.documentElement.dataset.theme="dark";}`,
          }}
        />
        <div className="backdrop" />
        <div className="grain" />
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
