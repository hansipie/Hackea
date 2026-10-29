"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { listProgress } from "@/lib/store";
import { useMounted } from "@/lib/useMounted";

const LINKS = [
  { href: "/hacks", label: "Hacks" },
  // hidden on narrow phones, where /hacks leads to it
  { href: "/hacks/new", label: "Make one", wide: true },
  { href: "/browse", label: "Browse" },
  // hidden on narrow phones, like "Make one"
  { href: "/library", label: "Library", wide: true },
  { href: "/builds", label: "Workshop" },
];

export default function NavLinks() {
  const path = usePathname();
  const mounted = useMounted();
  const builds = useMemo(() => (mounted ? listProgress().filter((p) => p.phase !== "cover").length : 0), [mounted]);
  return (
    <nav className="site-nav" aria-label="Main">
      {LINKS.map((l) => {
        const on = path === l.href;
        return (
          <Link key={l.href} href={l.href} className={"nav-link" + (on ? " on" : "") + (l.wide ? " nav-wide" : "")} aria-current={on ? "page" : undefined}>
            {l.label}
            {l.href === "/builds" && builds > 0 && <span className="nav-count">{builds}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
