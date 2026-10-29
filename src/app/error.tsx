"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Figure } from "@/components/art/Figure";

/** Something broke while drawing a page: say so plainly and offer a way out. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="lost">
      <Figure pose="think" bubble="!" size={120} />
      <h1>A part didn&apos;t fit</h1>
      <p className="lead">Something went wrong on our side. Your progress is saved on this device.</p>
      <div className="lost-actions">
        <button className="btn primary" onClick={reset}>
          Try again
        </button>
        <Link href="/" className="btn ghost">
          Back to search
        </Link>
      </div>
    </main>
  );
}
