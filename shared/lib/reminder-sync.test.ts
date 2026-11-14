import assert from "node:assert/strict";
import { test } from "node:test";
import { createReminderSynchronizer } from "../../features/notifications/reminder-sync";

function fixture() {
  const state = {
    groups: [{ date: "2026-04-01", count: 1 }],
    ids: [] as string[],
    cancels: 0,
    schedules: 0,
    stores: 0,
    cleaned: [] as string[],
  };
  const dependencies = {
    fetchGroups: async () => state.groups,
    maxGroups: 60,
    scheduledIds: async () => state.ids,
    cancel: async () => {
      state.cancels++;
      state.ids = [];
    },
    schedule: async () => {
      state.schedules++;
      const ids = [`notification-${state.schedules}`];
      state.ids.push(...ids);
      return ids;
    },
    store: async () => {
      state.stores++;
    },
    cancelIds: async (ids: string[]) => {
      state.cleaned.push(...ids);
      state.ids = state.ids.filter((id) => !ids.includes(id));
    },
    summarize: (groups: unknown[], total: number, count: number) => ({
      total,
      count,
    }),
  };
  return {
    state,
    dependencies,
    sync: createReminderSynchronizer(dependencies),
  };
}

test("unchanged reminder content retains exact OS notification identifiers", async () => {
  const { state, sync } = fixture();
  await sync.sync("user", "revision:day");
  await sync.sync("user", "revision:day", true);
  assert.equal(state.cancels, 1);
  assert.equal(state.schedules, 1);
  assert.deepEqual(state.ids, ["notification-1"]);
});
test("changed content or missing OS notifications rebuild the schedule", async () => {
  const { state, sync } = fixture();
  await sync.sync("user", "1");
  state.groups = [{ date: "2026-04-02", count: 2 }];
  await sync.sync("user", "2");
  assert.equal(state.schedules, 2);
  state.ids = [];
  await sync.sync("user", "2", true);
  assert.equal(state.schedules, 3);
});
test("logout or disabling during fetch prevents new notifications", async () => {
  const { dependencies, state } = fixture();
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  dependencies.fetchGroups = async () => {
    await wait;
    return state.groups;
  };
  const sync = createReminderSynchronizer(dependencies);
  const task = sync.sync("user", "1");
  await Promise.resolve();
  await Promise.resolve();
  sync.clear();
  release();
  await assert.rejects(task, /cancelled/);
  assert.equal(state.schedules, 0);
});
test("logout while native scheduling is underway cleans up the new notifications", async () => {
  const { dependencies, state } = fixture();
  const original = dependencies.schedule;
  const sync = createReminderSynchronizer(dependencies);
  dependencies.schedule = async () => {
    const ids = await original();
    sync.clear();
    return ids;
  };
  await assert.rejects(sync.sync("user", "1"), /cancelled/);
  assert.deepEqual(state.ids, []);
  assert.deepEqual(state.cleaned, ["notification-1"]);
});
test("failed fetch retains old reminders and failed persistence cleans new ones", async () => {
  const { dependencies, state, sync } = fixture();
  await sync.sync("user", "1");
  dependencies.fetchGroups = async () => {
    throw new Error("offline");
  };
  await assert.rejects(sync.sync("user", "2"));
  assert.deepEqual(state.ids, ["notification-1"]);
  dependencies.fetchGroups = async () => [{ date: "2026-04-03", count: 3 }];
  dependencies.store = async () => {
    throw new Error("storage");
  };
  await assert.rejects(sync.sync("user", "2"));
  assert.deepEqual(state.ids, []);
});
