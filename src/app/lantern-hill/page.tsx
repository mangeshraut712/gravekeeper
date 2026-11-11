import { Suspense } from "react";
import { connection } from "next/server";
import { LanternHillView } from "@/components/LanternHillView";
import { buildLanternHillDemo } from "@/lib/restore/demo";

export default function LanternHillPage() {
  return <Suspense fallback={<main className="mx-auto min-h-screen max-w-6xl px-5 py-8 text-stone-300">Restoring Lantern Hill…</main>}><LanternHillContent /></Suspense>;
}

async function LanternHillContent() {
  // A fresh ephemeral signing key for each request, never a shared operator key.
  await connection();
  const demo = await buildLanternHillDemo();
  return <LanternHillView demo={demo} />;
}
