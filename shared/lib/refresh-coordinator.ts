/** Coalesce identical refreshes and serialize different scopes. Cache successes only. */
export function createRefreshCoordinator<T>(ttlMs: number, now = Date.now) {
  let recent: { key: string; value: T; at: number } | undefined;
  let generation = 0;
  let tail: Promise<unknown> = Promise.resolve();
  const pending = new Map<string, Promise<T>>();

  return {
    clear() {
      generation += 1;
      recent = undefined;
      pending.clear();
    },
    run(key: string, work: () => Promise<T>, force = false): Promise<T> {
      const existing = pending.get(key);
      if (existing) return existing;
      if (!force && recent?.key === key && now() - recent.at < ttlMs) {
        return Promise.resolve(recent.value);
      }
      const startedGeneration = generation;
      const task = tail
        .catch(() => undefined)
        .then(work)
        .then((value) => {
          if (generation === startedGeneration)
            recent = { key, value, at: now() };
          return value;
        });
      pending.set(key, task);
      tail = task;
      void task
        .finally(() => {
          if (pending.get(key) === task) pending.delete(key);
        })
        .catch(() => undefined);
      return task;
    },
  };
}

export function retryRead(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  const failure = error as {
    code?: string;
    response?: { status?: number };
  } | null;
  if (failure?.code === "ERR_CANCELED") return false;
  const status = failure?.response?.status;
  return status === undefined || status === 408 || status >= 500;
}
