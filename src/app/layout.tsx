import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const sans = Geist({
  variable: "--font-grave-sans",
  subsets: ["latin"],
});

const mono = Geist_Mono({
  variable: "--font-grave-mono",
  subsets: ["latin"],
});

const serif = Newsreader({
  variable: "--font-grave-serif",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "Gravekeeper — Resurrect a dead page",
  description:
    "Gravekeeper brings a dead late-1990s homepage back as modern HTML and signs a receipt chain you can verify.",
  openGraph: {
    title: "Gravekeeper",
    description:
      "A Resurrection project: restore an obsolete page, then export and verify the receipt chain.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable} ${serif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
