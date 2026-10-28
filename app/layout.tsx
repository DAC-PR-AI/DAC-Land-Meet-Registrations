import type { Metadata, Viewport } from "next";
import { Playfair_Display, Poppins } from "next/font/google";
import { EVENT } from "@/lib/event";
import "./globals.css";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-poppins", display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-playfair", display: "swap" });

const site = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
const description = `${EVENT.subtitle}. ${EVENT.dateLabel}, ${EVENT.timeLabel} at ${EVENT.venueName}, Guindy, Chennai. Register to get your Entry Pass.`;

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: "Exclusive Invitation – DAC Developers",
  description,
  openGraph: {
    title: "Exclusive Invitation – DAC Developers",
    description,
    url: site,
    siteName: "DAC Developers",
    type: "website",
    locale: "en_IN",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "DAC Developers – Exclusive Invitation" }],
  },
  twitter: { card: "summary_large_image", title: "Exclusive Invitation – DAC Developers", description, images: ["/og.jpg"] },
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0E1B3D",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${playfair.variable}`}>
      <body>{children}</body>
    </html>
  );
}
