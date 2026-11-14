import assert from "node:assert/strict";
import { test } from "node:test";
import { createRefreshCoordinator, retryRead } from "./refresh-coordinator";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

test("coalesces concurrent refreshes and expires only successful results", async () => {
  let now = 0;
  let calls = 0;
  const gate = createRefreshCoordinator<number>(30, () => now);
  const work = deferred<number>();
  const first = gate.run("account:revision:day", () => {
    calls++;
    return work.promise;
  });
  const second = gate.run("account:revision:day", () => {
    throw new Error("duplicate");
  });
  assert.equal(first, second);
  work.resolve(7);
  assert.equal(await first, 7);
  assert.equal(await gate.run("account:revision:day", async () => 8), 7);
  now = 30;
  assert.equal(await gate.run("account:revision:day", async () => 8), 8);
  assert.equal(calls, 1);
});

test("serializes different account or revision refreshes and permits manual refresh", async () => {
  const gate = createRefreshCoordinator<number>(30);
  const first = deferred<number>();
  const order: number[] = [];
  const a = gate.run("a", () => {
    order.push(1);
    return first.promise;
  });
  const b = gate.run("b", async () => {
    order.push(2);
    return 2;
  });
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(order, [1]);
  first.resolve(1);
  await a;
  await b;
  assert.deepEqual(order, [1, 2]);
  assert.equal(await gate.run("b", async () => 3, true), 3);
});

test("a failed refresh neither poisons the queue nor starts a cooldown", async () => {
  const gate = createRefreshCoordinator<number>(30);
  await assert.rejects(
    gate.run("a", async () => {
      throw new Error("offline");
    }),
  );
  assert.equal(await gate.run("a", async () => 2), 2);
});

test("invalidation prevents an in-flight result from being reused after logout or disabling", async () => {
  const gate = createRefreshCoordinator<number>(30);
  const old = deferred<number>();
  const task = gate.run("a", () => old.promise);
  gate.clear();
  old.resolve(1);
  await task;
  assert.equal(await gate.run("a", async () => 2), 2);
});

test("read retries preserve transient recovery without retrying rejection or cancellation", () => {
  for (const status of [400, 401, 403, 404, 409, 422, 429]) {
    assert.equal(retryRead(0, { response: { status } }), false);
  }
  assert.equal(retryRead(0, { code: "ERR_CANCELED" }), false);
  for (const status of [408, 500, 502, 503, 504]) {
    assert.equal(retryRead(0, { response: { status } }), true);
    assert.equal(retryRead(1, { response: { status } }), false);
  }
  assert.equal(retryRead(0, new Error("offline")), true);
});
