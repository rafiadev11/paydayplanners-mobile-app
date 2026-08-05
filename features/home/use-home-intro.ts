import { useCallback, useEffect, useRef, useState } from "react";

import { homeIntroSeenStorage } from "@shared/storage/secure";

function parseSeenIds(raw: string | null) {
  if (!raw) return [] as string[];

  try {
    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [] as string[];
  }
}

/**
 * Tracks whether this account has ever landed on Home on this device, so the
 * hero card can greet a genuinely new user differently from someone who simply
 * has not set a paycheck up yet. `isFirstOpen` is null until storage resolves.
 */
export function useHomeIntro(userId: number | string | null | undefined) {
  const [isFirstOpen, setIsFirstOpen] = useState<boolean | null>(null);
  const markedRef = useRef<string | null>(null);
  const key = userId == null ? null : String(userId);

  useEffect(() => {
    let cancelled = false;

    if (!key) {
      setIsFirstOpen(null);
      return;
    }

    void homeIntroSeenStorage.get().then((raw) => {
      if (cancelled) return;

      setIsFirstOpen(!parseSeenIds(raw).includes(key));
    });

    return () => {
      cancelled = true;
    };
  }, [key]);

  const markSeen = useCallback(() => {
    if (!key || markedRef.current === key) return;

    markedRef.current = key;

    void homeIntroSeenStorage.get().then((raw) => {
      const seen = parseSeenIds(raw);

      if (seen.includes(key)) return;

      return homeIntroSeenStorage.set(JSON.stringify([...seen, key]));
    });
  }, [key]);

  return { isFirstOpen, markSeen };
}
