import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createEventQueue,
  type RetentionEvent,
} from "../../features/retention/event-queue";
const event = (id: string): RetentionEvent => ({
  event_id: id,
  name: "app_opened",
  occurred_at: new Date().toISOString(),
  platform: "ios",
  app_version: "1.1.5",
});
test("retry preserves event ids without attributing old events to a new account", async () => {
  const sends: { token: string; ids: string[] }[] = [];
  let fail = true;
  const queue = createEventQueue(async (token, events) => {
    sends.push({ token, ids: events.map((e) => e.event_id) });
    if (fail) throw new Error("offline");
  });
  queue.reset("A");
  queue.add(event("one"));
  await queue.flush();
  fail = false;
  await queue.flush();
  queue.reset("B");
  queue.add(event("two"));
  await queue.flush();
  assert.deepEqual(sends, [
    { token: "A", ids: ["one"] },
    { token: "A", ids: ["one"] },
    { token: "B", ids: ["two"] },
  ]);
});
test("an in-flight old session cannot drain the next account queue", async () => {
  let release!: () => void;
  const sends: string[] = [];
  const queue = createEventQueue(async (token) => {
    sends.push(token);
    if (token === "A")
      await new Promise<void>((r) => {
        release = r;
      });
  });
  queue.reset("A");
  queue.add(event("one"));
  const first = queue.flush();
  queue.reset("B");
  queue.add(event("two"));
  await queue.flush();
  release();
  await first;
  await queue.flush();
  assert.deepEqual(sends, ["A", "B"]);
});

test("expired events cannot block current events and the offline queue is bounded", async () => {
  const batches: RetentionEvent[][] = [];
  const queue = createEventQueue(async (_, events) => {
    batches.push(events);
  });
  queue.reset("A");
  queue.add({ ...event("old"), occurred_at: "2020-01-01T00:00:00Z" });
  for (let i = 0; i < 60; i++) queue.add(event(String(i)));
  await queue.flush();
  assert.equal(batches.flat().length, 39);
  assert.ok(batches.every((batch) => batch.length <= 20));
  assert.ok(batches.flat().every((event) => event.event_id !== "old"));
});
