import type { Metadata } from "next";
import RestorationDemo from "@/components/RestorationDemo";

const description =
  "Run pinned MIT-licensed esrever beside a small Intl.Segmenter modernization and compare 12 Unicode reversal checks.";

export const metadata: Metadata = {
  title: "Restoration case 001: esrever",
  description,
  alternates: { canonical: "/restoration" },
  openGraph: { title: "Restoration case 001: esrever", description, url: "/restoration" },
};

export default function RestorationPage() {
  return <RestorationDemo />;
}
