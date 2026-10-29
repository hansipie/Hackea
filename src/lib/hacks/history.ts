import { useCallback, useReducer } from "react";

/** What the workspace can undo: the states before and after the one on screen. */
export interface History<T> {
  past: T[];
  now: T;
  future: T[];
  /** what made the last change and when, so a drag (many small moves) is one step back */
  last?: { key: string; at: number };
}

/** Moves of one kind this close together are one change. */
export const MERGE_MS = 700;
export const DEPTH = 100;

export const begin = <T,>(now: T): History<T> => ({ past: [], now, future: [] });

/** `next` becomes the state. With a `key` equal to the last change's and within MERGE_MS, it replaces that change instead of adding one. */
export function commit<T>(h: History<T>, next: T, key?: string, at = Date.now()): History<T> {
  if (Object.is(next, h.now)) return h;
  const merge = key !== undefined && h.last?.key === key && at - h.last.at < MERGE_MS && h.past.length > 0;
  return {
    past: merge ? h.past : [...h.past, h.now].slice(-DEPTH),
    now: next,
    future: [],
    last: key === undefined ? undefined : { key, at },
  };
}

export function undo<T>(h: History<T>): History<T> {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), now: h.past[h.past.length - 1], future: [h.now, ...h.future], last: undefined };
}

export function redo<T>(h: History<T>): History<T> {
  if (!h.future.length) return h;
  return { past: [...h.past, h.now], now: h.future[0], future: h.future.slice(1), last: undefined };
}

type Action<T> = { type: "commit"; next: T; key?: string } | { type: "undo" } | { type: "redo" } | { type: "reset"; to: T };

function reduce<T>(h: History<T>, a: Action<T>): History<T> {
  switch (a.type) {
    case "commit":
      return commit(h, a.next, a.key);
    case "undo":
      return undo(h);
    case "redo":
      return redo(h);
    case "reset":
      return begin(a.to);
  }
}

/** A value with undo and redo (Ctrl+Z, Ctrl+Shift+Z in the workspace). */
export function useHistory<T>(initial: T) {
  const [h, dispatch] = useReducer(reduce as (h: History<T>, a: Action<T>) => History<T>, initial, begin);
  return {
    value: h.now,
    set: useCallback((next: T, key?: string) => dispatch({ type: "commit", next, key }), []),
    undo: useCallback(() => dispatch({ type: "undo" }), []),
    redo: useCallback(() => dispatch({ type: "redo" }), []),
    reset: useCallback((to: T) => dispatch({ type: "reset", to }), []),
    canUndo: h.past.length > 0,
    canRedo: h.future.length > 0,
  };
}
