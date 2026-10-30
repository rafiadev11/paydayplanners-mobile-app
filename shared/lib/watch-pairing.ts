export type WatchPairingRequest = {
  request_id: string;
  approval_handle: string;
  expires_at: string;
  platform: "watchos" | "wearos";
  api_base: string;
};

export function parseWatchRequests(
  raw: string,
  apiBase: string,
  now = Date.now(),
): WatchPairingRequest[] {
  try {
    const values: unknown = JSON.parse(raw);
    if (!Array.isArray(values)) return [];
    const expected = new URL("/api/v1", apiBase).href.replace(/\/$/, "");
    const seen = new Set<string>();
    return values
      .filter((value): value is WatchPairingRequest => {
        if (!value || typeof value !== "object") return false;
        const v = value as Record<string, unknown>;
        if (
          typeof v.request_id !== "string" ||
          !/^[a-f0-9-]{36}$/i.test(v.request_id) ||
          seen.has(v.request_id) ||
          typeof v.approval_handle !== "string" ||
          !/^[a-z0-9]{64}$/i.test(v.approval_handle) ||
          typeof v.expires_at !== "string" ||
          !["watchos", "wearos"].includes(String(v.platform)) ||
          typeof v.api_base !== "string" ||
          v.api_base.replace(/\/$/, "") !== expected
        )
          return false;
        const expiry = Date.parse(v.expires_at);
        if (!Number.isFinite(expiry) || expiry <= now || expiry > now + 660_000)
          return false;
        seen.add(v.request_id);
        return true;
      })
      .slice(0, 4);
  } catch {
    return [];
  }
}

export function canApproveWatchRequest(
  request: WatchPairingRequest | undefined,
  state: {
    active: boolean;
    authReady: boolean;
    lockReady: boolean;
    locked: boolean;
    enabled: boolean;
    userId: string | number | undefined;
  },
  now = Date.now(),
): boolean {
  return (
    !!request &&
    state.active &&
    state.authReady &&
    state.lockReady &&
    !state.locked &&
    state.enabled &&
    state.userId != null &&
    Date.parse(request.expires_at) > now
  );
}
