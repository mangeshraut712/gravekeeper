import type { Metadata } from "next";
import { openGraphImages, twitterImages } from "@/shared/site";
import RestorationDemo from "@/components/RestorationDemo";

const description =
  "Run pinned MIT-licensed esrever beside a small Intl.Segmenter modernization and compare 12 Unicode reversal checks.";

export const metadata: Metadata = {
  title: "Restoration case 001: esrever",
  description,
  alternates: { canonical: "/restoration" },
  openGraph: { title: "Restoration case 001: esrever", description, url: "/restoration", images: openGraphImages },
  twitter: { card: "summary_large_image", title: "Restoration case 001: esrever", description, images: twitterImages },
};

export default function RestorationPage() {
  return <RestorationDemo />;
}
