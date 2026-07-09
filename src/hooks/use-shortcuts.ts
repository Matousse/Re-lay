"use client";

import { useEffect, useRef } from "react";

type ShortcutMap = Record<string, (event: KeyboardEvent) => void>;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

/**
 * Single-key shortcuts (no modifiers). Keys are matched lowercase ("a", "j",
 * "enter", "escape"). While the user types in a field, everything except
 * Escape is ignored.
 */
export function useShortcuts(shortcuts: ShortcutMap): void {
  const shortcutsRef = useRef(shortcuts);
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (isTypingTarget(event.target) && key !== "escape") return;
      // Leave keys alone while a modal dialog owns the focus.
      if (event.target instanceof Element && event.target.closest('[role="dialog"]')) return;
      const handler = shortcutsRef.current[key];
      if (!handler) return;
      event.preventDefault();
      handler(event);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
