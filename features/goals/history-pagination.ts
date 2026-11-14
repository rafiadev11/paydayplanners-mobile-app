export function createHistoryPagination() {
  let generation = 0;
  let cursor: string | null = null;

  return {
    restart() {
      cursor = null;
      return ++generation;
    },
    isCurrent(requestGeneration: number) {
      return requestGeneration === generation;
    },
    commit(requestGeneration: number, nextCursor: string | null) {
      if (requestGeneration !== generation) return false;
      cursor = nextCursor;
      return true;
    },
    nextPage() {
      return cursor === null ? null : { generation, cursor };
    },
  };
}
