import { useSyncExternalStore } from "react";

let planningRevision = 0;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => {
    listener();
  });
}

export function getPlanningRevision() {
  return planningRevision;
}

export function setPlanningRevision(next: number | string | null | undefined) {
  const normalized = Number(next ?? 0);
  if (
    !Number.isFinite(normalized) ||
    normalized === planningRevision ||
    (normalized !== 0 && normalized < planningRevision)
  ) {
    return;
  }

  planningRevision = normalized;
  notify();
}

export function usePlanningRevision() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    getPlanningRevision,
    getPlanningRevision,
  );
}
