import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef } from "react";

type StaleRefetchQuery = {
  isEnabled: boolean;
  isFetching: boolean;
  isStale: boolean;
  refetch: () => Promise<unknown>;
};

export function useRefetchStaleOnFocus(
  ...queries: readonly StaleRefetchQuery[]
) {
  const queriesRef = useRef(queries);
  queriesRef.current = queries;

  useFocusEffect(
    useCallback(() => {
      for (const query of queriesRef.current) {
        if (query.isEnabled && query.isStale && !query.isFetching) {
          void query.refetch();
        }
      }
    }, []),
  );
}
