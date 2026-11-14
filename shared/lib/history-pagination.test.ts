import assert from "node:assert/strict";
import { test } from "node:test";
import { createHistoryPagination } from "../../features/goals/history-pagination";

test("a first-page reload blocks pagination until its cursor is committed", () => {
  const pagination = createHistoryPagination();
  const initial = pagination.restart();
  pagination.commit(initial, "old-page-2");
  const reload = pagination.restart();

  // A tap using the previous render must not reuse the old cursor.
  assert.equal(pagination.nextPage(), null);
  assert.equal(pagination.commit(reload, "new-page-2"), true);
  assert.deepEqual(pagination.nextPage(), {
    generation: reload,
    cursor: "new-page-2",
  });
});

test("an old page arriving after a replacement first page cannot advance its cursor", () => {
  const pagination = createHistoryPagination();
  const initial = pagination.restart();
  pagination.commit(initial, "old-page-2");
  const oldPage = pagination.nextPage()!;
  const reload = pagination.restart();
  pagination.commit(reload, "new-page-2");

  assert.equal(pagination.commit(oldPage.generation, "old-page-3"), false);
  assert.deepEqual(pagination.nextPage(), {
    generation: reload,
    cursor: "new-page-2",
  });
});

test("failed reloads and blurred screens cannot expose an earlier cursor", () => {
  const pagination = createHistoryPagination();
  const initial = pagination.restart();
  pagination.commit(initial, "old-page-2");
  const reload = pagination.restart();
  assert.equal(pagination.nextPage(), null);
  pagination.restart();
  assert.equal(pagination.isCurrent(reload), false);
  assert.equal(pagination.commit(reload, "late-page-2"), false);
  assert.equal(pagination.nextPage(), null);
});

test("current pages advance normally and a final page disables further pagination", () => {
  const pagination = createHistoryPagination();
  const generation = pagination.restart();
  pagination.commit(generation, "page-2");
  assert.equal(pagination.commit(generation, "page-3"), true);
  assert.equal(pagination.nextPage()?.cursor, "page-3");
  assert.equal(pagination.commit(generation, null), true);
  assert.equal(pagination.nextPage(), null);
});
