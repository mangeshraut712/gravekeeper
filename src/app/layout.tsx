import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gravekeeper — Good code deserves a second life",
  description:
    "Unearth forgotten websites and repositories. Find archive snapshots, create a revival plan, and export verifiable receipt chains.",
  openGraph: {
    title: "Gravekeeper — Good code deserves a second life",
    description:
      "Digital archaeology for the living web. Built for Kiroween 2026.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="min-h-full antialiased">
      <body>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
