import type { Metadata } from "next";
import ProofWorkbench from "@/components/ProofWorkbench";

export const metadata: Metadata = {
  title: "Check a proof — Gravekeeper",
  alternates: { canonical: "/proof" },
  description: "Verify a downloaded Gravekeeper proof file in your browser. Nothing is uploaded.",
};

export default function ProofPage() {
  return <ProofWorkbench />;
}
