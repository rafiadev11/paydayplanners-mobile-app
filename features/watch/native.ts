import { NativeModule, requireOptionalNativeModule } from "expo";

class WatchPairingNative extends NativeModule<{ requestsChanged: () => void }> {
  getPending!: () => Promise<string>;
  dismiss!: (requestId: string) => Promise<void>;
  probe!: () => Promise<void>;
}

export const watchPairing =
  requireOptionalNativeModule<WatchPairingNative>("WatchPairing");
