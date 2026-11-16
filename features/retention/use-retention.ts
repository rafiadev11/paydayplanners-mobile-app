import { useEffect } from "react";
import { AppState } from "react-native";
import {
  flushRetention,
  setRetentionUnlocked,
  trackRetention,
} from "./tracking";

export function useRetention(enabled: boolean) {
  useEffect(() => {
    setRetentionUnlocked(enabled);
    if (!enabled) return;
    const foreground = () => {
      if (AppState.currentState !== "active") return;
      trackRetention("app_opened");
      flushRetention();
    };
    foreground();
    const subscription = AppState.addEventListener("change", foreground);
    return () => {
      subscription.remove();
      setRetentionUnlocked(false);
    };
  }, [enabled]);
}
