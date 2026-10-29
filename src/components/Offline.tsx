"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Registers the service worker that keeps opened guides and their voice working offline. */
export default function Offline() {
  const path = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const go = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
  }, []);

  // every page you see is kept for offline, with the files it loaded, even the first one and in-app moves
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let gone = false;
    navigator.serviceWorker.ready.then((reg) => {
      if (gone) return;
      const files = performance.getEntriesByType("resource").map((r) => r.name);
      reg.active?.postMessage({ type: "keep", page: location.origin + path, files });
    });
    return () => {
      gone = true;
    };
  }, [path]);
  return null;
}
