import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { LanternHillView } from "@/components/LanternHillView";
import { buildLanternHillDemo } from "@/lib/restore/demo";

const description =
  "A 1999-style fixture page rewritten into semantic HTML5, with signed receipts for the exact before and after bytes.";

export const metadata: Metadata = {
  title: "Lantern Hill restoration",
  description,
  alternates: { canonical: "/lantern-hill" },
  openGraph: { title: "Lantern Hill restoration", description, url: "/lantern-hill" },
};

export default function LanternHillPage() {
  return <Suspense fallback={<main className="mx-auto max-w-6xl px-5 py-8 text-stone-300">Restoring Lantern Hill…</main>}><LanternHillContent /></Suspense>;
}

async function LanternHillContent() {
  // A fresh ephemeral signing key for each request, never a shared operator key.
  await connection();
  const demo = await buildLanternHillDemo();
  return <LanternHillView demo={demo} />;
}
