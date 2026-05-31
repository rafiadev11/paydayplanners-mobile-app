import NetInfo from "@react-native-community/netinfo";
import {
  focusManager,
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24,
      networkMode: "offlineFirst",
      refetchOnReconnect: true,
      retry: 1,
      staleTime: 1000 * 60,
    },
    mutations: {
      networkMode: "online",
      retry: 0,
    },
  },
});

function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== "web") {
    focusManager.setFocused(status === "active");
  }
}

export function ApiQueryProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const appStateSubscription = AppState.addEventListener(
      "change",
      onAppStateChange,
    );
    const netInfoSubscription = NetInfo.addEventListener((state) => {
      onlineManager.setOnline(
        state.isConnected !== false && state.isInternetReachable !== false,
      );
    });

    return () => {
      appStateSubscription.remove();
      netInfoSubscription();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
