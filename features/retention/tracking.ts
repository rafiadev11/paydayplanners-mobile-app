import axios from "axios";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import { AppState, Platform } from "react-native";
import { API_BASE_URL } from "@shared/lib/env";
import { createEventQueue, type RetentionEventName } from "./event-queue";

const queue = createEventQueue(async (token, events) => {
  await axios.post(
    `${API_BASE_URL}/api/v1/retention-events`,
    { events },
    {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      timeout: 10000,
    },
  );
});
let currentToken: string | null = null;
let unlocked = false;
const lastEvents = new Map<string, number>();

export function setRetentionSession(token: string | null) {
  if (currentToken !== token) {
    lastEvents.clear();
    unlocked = false;
  }
  currentToken = token;
  queue.reset(token);
}
export function setRetentionUnlocked(value: boolean) {
  unlocked = value;
}
export function trackRetention(name: RetentionEventName) {
  if (
    __DEV__ ||
    !currentToken ||
    !unlocked ||
    (Platform.OS !== "ios" && Platform.OS !== "android")
  )
    return;
  const now = Date.now();
  if (now - (lastEvents.get(name) ?? 0) < 30000) return;
  lastEvents.set(name, now);
  queue.add({
    event_id: Crypto.randomUUID(),
    name,
    occurred_at: new Date(now).toISOString(),
    platform: Platform.OS,
    app_version: Constants.expoConfig?.version ?? "unknown",
  });
  flushRetention();
}
export function flushRetention() {
  if (!currentToken || !unlocked || AppState.currentState !== "active") return;
  void queue.flush();
}
