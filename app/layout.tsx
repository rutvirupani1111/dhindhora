import type { Metadata, Viewport } from "next";
import { Baloo_2, Martian_Mono, Rozha_One, Yatra_One } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/Shell";

const yatra = Yatra_One({ weight: "400", subsets: ["latin", "devanagari"], display: "swap", variable: "--f-yatra", adjustFontFallback: true });
const rozha = Rozha_One({ weight: "400", subsets: ["latin", "devanagari"], display: "swap", variable: "--f-rozha", adjustFontFallback: true });
const baloo = Baloo_2({ weight: ["500", "700"], subsets: ["latin", "devanagari"], display: "swap", variable: "--f-baloo", adjustFontFallback: true });
const martian = Martian_Mono({ weight: "400", subsets: ["latin"], display: "swap", variable: "--f-martian", adjustFontFallback: true });

export const metadata: Metadata = {
  title: "Dhindhora (ढिंढोरा): apni dukaan ka dhindhora peeto",
  description: "Hindi, English ya Hinglish mein chhoti parchi bharo. Muft studio usse haath se rangi, bina awaaz wali promo video bana deta hai, WhatsApp Status, Reels aur Shorts ke liye.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://dhindhora.vercel.app"),
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = { themeColor: "#2B1E2F", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hi-Latn" className={`${yatra.variable} ${rozha.variable} ${baloo.variable} ${martian.variable}`} suppressHydrationWarning>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
