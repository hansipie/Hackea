"use client";

import Search from "./Search";
import { useAiStatus } from "./Sections";

export function HeroSearch() {
  const ai = useAiStatus();
  return <Search ai={ai} />;
}
