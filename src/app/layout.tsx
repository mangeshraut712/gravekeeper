import type { Metadata, Viewport } from "next";
import {
  siteDescription,
  siteName,
  siteTitle,
  siteUrl,
  themeColor,
} from "@/shared/site";
import "./globals.css";

// Share images come from the opengraph-image / twitter-image file conventions in this folder.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: siteTitle, template: `%s · ${siteName}` },
  description: siteDescription,
  applicationName: siteName,
  alternates: { canonical: "/" },
  openGraph: {
    title: siteTitle,
    description:
      "Digital archaeology for the living web. Built for Kiroween 2026.",
    type: "website",
    siteName,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
};

export const viewport: Viewport = {
  themeColor,
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="min-h-full antialiased">
      <body>{children}</body>
    </html>
  );
}
