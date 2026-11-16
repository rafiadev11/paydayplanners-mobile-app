import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { URL } from "node:url";
import ts from "typescript";

test("permission events wait for foreground delivery and remain session scoped", () => {
  const appState = { currentState: "inactive" };
  const pending: string[] = [];
  const sent: string[] = [];
  const queue = {
    reset: () => pending.splice(0),
    add: (event: { name: string }) => pending.push(event.name),
    flush: async () => {
      sent.push(...pending.splice(0));
    },
  };
  const mocks: Record<string, unknown> = {
    axios: {},
    "expo-constants": { expoConfig: { version: "1.1.5" } },
    "expo-crypto": { randomUUID: () => "test-event" },
    "react-native": { AppState: appState, Platform: { OS: "ios" } },
    "@shared/lib/env": { API_BASE_URL: "https://example.test" },
    "./event-queue": { createEventQueue: () => queue },
  };
  const source = readFileSync(
    new URL("../../features/retention/tracking.ts", import.meta.url),
    "utf8",
  );
  const exports: Record<string, (...args: unknown[]) => void> = {};
  runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    { exports, require: (name: string) => mocks[name], __DEV__: false },
  );

  exports.setRetentionSession("account-A");
  exports.setRetentionUnlocked(true);
  exports.trackRetention("notification_permission_granted");
  assert.deepEqual(sent, []);
  assert.deepEqual(pending, ["notification_permission_granted"]);
  appState.currentState = "active";
  exports.flushRetention();
  assert.deepEqual(sent, ["notification_permission_granted"]);

  appState.currentState = "inactive";
  exports.trackRetention("payday_reminder_enabled");
  exports.setRetentionSession(null);
  appState.currentState = "active";
  exports.flushRetention();
  assert.deepEqual(pending, []);
  assert.deepEqual(sent, ["notification_permission_granted"]);
});
