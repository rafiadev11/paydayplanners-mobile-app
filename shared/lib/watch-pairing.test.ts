import assert from "node:assert/strict";
import test from "node:test";
import { parseWatchRequests, canApproveWatchRequest } from "./watch-pairing";

const now = Date.parse("2026-10-30T19:00:00Z");
const request = {
  request_id: "bbbf1111-1111-4111-8111-111111111111",
  approval_handle: "a".repeat(64),
  expires_at: "2026-10-30T19:10:00Z",
  platform: "wearos" as const,
  api_base: "https://paydayplanners.com/api/v1",
};
const state = {
  active: true,
  authReady: true,
  lockReady: true,
  locked: false,
  enabled: true,
  userId: 1,
};
test("accepts and deduplicates valid requests from the configured backend", () => {
  assert.deepEqual(
    parseWatchRequests(
      JSON.stringify([request, request]),
      "https://paydayplanners.com",
      now,
    ),
    [request],
  );
});
test("rejects malformed, expired and foreign-environment requests", () => {
  for (const changed of [
    { api_base: "https://evil.example/api/v1" },
    { expires_at: "2026-10-30T18:59:00Z" },
    { expires_at: "2026-11-30T19:00:00Z" },
    { approval_handle: "short" },
    { platform: "other" },
  ]) {
    assert.deepEqual(
      parseWatchRequests(
        JSON.stringify([{ ...request, ...changed }]),
        "https://paydayplanners.com",
        now,
      ),
      [],
    );
  }
  assert.deepEqual(
    parseWatchRequests("not json", "https://paydayplanners.com", now),
    [],
  );
});
test("approval requires an active unlocked authenticated account and live request", () => {
  assert.equal(canApproveWatchRequest(request, state, now), true);
  for (const changed of [
    { active: false },
    { authReady: false },
    { lockReady: false },
    { locked: true },
    { enabled: false },
    { userId: undefined },
  ]) {
    assert.equal(
      canApproveWatchRequest(request, { ...state, ...changed }, now),
      false,
    );
  }
  assert.equal(canApproveWatchRequest(request, state, now + 600_001), false);
});
