import { Suspense } from "react";
import { Studio, type At } from "@/components/studio/Studio";

export default async function StudioPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ at?: string }> }) {
  const { id } = await params;
  const { at } = await searchParams;
  const a: At = at === "board" || at === "booth" || at === "press" ? at : "parchi";
  return (
    <Suspense fallback={<div className="min-h-svh tent" />}>
      <Studio id={id} initialAt={a} />
    </Suspense>
  );
}
