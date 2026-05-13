"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "oip.openai_key";

export function useApiKey() {
  const [apiKey, setApiKeyState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setApiKeyState(stored);
    setHydrated(true);
  }, []);

  const setApiKey = useCallback((key: string | null) => {
    if (typeof window === "undefined") return;
    if (key && key.length > 0) {
      window.localStorage.setItem(STORAGE_KEY, key);
      setApiKeyState(key);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
      setApiKeyState(null);
    }
  }, []);

  return { apiKey, setApiKey, hydrated };
}

export function isValidOpenAIKey(value: string): boolean {
  return /^sk-[a-zA-Z0-9_-]{20,}$/.test(value.trim());
}
