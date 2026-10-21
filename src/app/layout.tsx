import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "PerkPilot — Earn points. Climb tiers. Redeem joy.", template: "%s · PerkPilot" },
  description: "PerkPilot demo loyalty platform: earn points at fictional partner merchants, daily streaks, missions, an honest Lucky Spin, family pooling and tiered rewards. All demo data, no monetary value.",
  openGraph: { title: "PerkPilot — Violet Gold Loyalty Arcade", description: "Earn on every purchase. Streaks that pay. Redeem anywhere. (Fictional demo merchants.)", type: "website", siteName: "PerkPilot" },
  twitter: { card: "summary_large_image", title: "PerkPilot", description: "Earn points. Climb tiers. Redeem joy. Demo loyalty platform." },
  manifest: "/manifest.json",
  robots: { index: true, follow: true },
};
export const viewport: Viewport = { themeColor: "#0B0614", width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Lexend:wght@600;800&family=Public+Sans:wght@400;500;600;700&family=Martian+Mono:wght@500&display=swap" rel="stylesheet" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "Organization", name: "PerkPilot (Demo)", description: "Fictional demo loyalty platform.", slogan: "Every everyday spend earns its wings." }) }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
