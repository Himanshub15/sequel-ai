import { useEffect, useCallback } from "react";

type ShortcutHandlers = {
  runQuery: () => void;
  newTab: () => void;
  closeTab: () => void;
  openConnection: () => void;
  toggleAi: () => void;
  showShortcuts: () => void;
};

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === "Enter") {
        e.preventDefault();
        handlers.runQuery();
      }

      if (mod && e.key === "t") {
        e.preventDefault();
        handlers.newTab();
      }

      if (mod && e.key === "w") {
        e.preventDefault();
        handlers.closeTab();
      }

      if (mod && e.key === "i") {
        e.preventDefault();
        handlers.toggleAi();
      }

      if (mod && (e.key === "?" || (e.shiftKey && e.key === "/"))) {
        e.preventDefault();
        handlers.showShortcuts();
      }
    },
    [handlers]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
