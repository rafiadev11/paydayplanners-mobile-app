import { createRefreshCoordinator } from "../../shared/lib/refresh-coordinator";

export function createReminderSynchronizer<Group, Result>(dependencies: {
  fetchGroups: () => Promise<Group[]>;
  maxGroups: number;
  scheduledIds: (id: string) => Promise<string[]>;
  cancel: (id: string) => Promise<void>;
  schedule: (id: string, groups: Group[]) => Promise<string[]>;
  store: (id: string, identifiers: string[]) => Promise<void>;
  cancelIds: (identifiers: string[]) => Promise<void>;
  summarize: (groups: Group[], total: number, count: number) => Result;
}) {
  const refresh = createRefreshCoordinator<Result>(30_000);
  let generation = 0;
  const fingerprints = new Map<
    string,
    { fingerprint: string; identifiers: string[] }
  >();

  return {
    clear() {
      generation += 1;
      refresh.clear();
      fingerprints.clear();
    },
    sync(id: string, scope: string, force = false) {
      const startedGeneration = generation;
      const assertCurrent = () => {
        if (generation !== startedGeneration)
          throw new Error("Reminder refresh cancelled");
      };
      return refresh.run(
        `${id}:${scope}`,
        async () => {
          assertCurrent();
          const groups = await dependencies.fetchGroups();
          const scheduledGroups = groups.slice(0, dependencies.maxGroups);
          assertCurrent();
          const fingerprint = JSON.stringify(scheduledGroups);
          const previous = fingerprints.get(id);
          const existing = new Set(await dependencies.scheduledIds(id));
          assertCurrent();
          if (
            previous?.fingerprint === fingerprint &&
            existing.size === previous.identifiers.length &&
            previous.identifiers.every((identifier) => existing.has(identifier))
          ) {
            return dependencies.summarize(
              scheduledGroups,
              groups.length,
              existing.size,
            );
          }
          await dependencies.cancel(id);
          assertCurrent();
          const identifiers = await dependencies.schedule(id, scheduledGroups);
          try {
            assertCurrent();
            await dependencies.store(id, identifiers);
            assertCurrent();
          } catch (error) {
            await dependencies.cancelIds(identifiers);
            throw error;
          }
          fingerprints.set(id, { fingerprint, identifiers });
          return dependencies.summarize(
            scheduledGroups,
            groups.length,
            identifiers.length,
          );
        },
        force,
      );
    },
  };
}
