"use client";

import { useSyncExternalStore } from "react";

/** The person's own OpenAI key. It lives only in this browser and rides along with AI requests: every AI feature runs on it. */
const K = "hackea:openai-key";

export function getUserKey(): string {
  try {
    return localStorage.getItem(K) ?? "";
  } catch {
    return "";
  }
}

export function setUserKey(v: string) {
  try {
    if (v) localStorage.setItem(K, v.trim());
    else localStorage.removeItem(K);
    window.dispatchEvent(new Event("hackea:key"));
  } catch {
    /* storage blocked */
  }
}

export function keyHeaders(): Record<string, string> {
  const k = getUserKey();
  return k ? { "x-openai-key": k } : {};
}

export function subscribeKey(cb: () => void) {
  window.addEventListener("hackea:key", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("hackea:key", cb);
    window.removeEventListener("storage", cb);
  };
}

/** The saved key, kept in step across tabs; "" until the page is in the browser. */
export function useUserKey() {
  return useSyncExternalStore(subscribeKey, getUserKey, () => "");
}

/** Where to make a key. */
export const KEY_URL = "https://platform.openai.com/api-keys";
