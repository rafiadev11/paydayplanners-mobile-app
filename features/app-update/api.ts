import Constants from "expo-constants";
import { Platform } from "react-native";

import { api } from "@shared/api/client";
import { API_BASE_URL } from "@shared/lib/env";

export type MobilePlatform = "ios" | "android";

export type MobileUpdateStatus = "current" | "available" | "required";

export type MobileUpdatePolicy = {
  status: MobileUpdateStatus;
  latest_version: string;
  minimum_supported_version: string | null;
  title: string | null;
  message: string | null;
  store_url: string | null;
};

export const CURRENT_APP_VERSION =
  Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? "0.0.0";

export const CURRENT_MOBILE_PLATFORM: MobilePlatform | null =
  Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : null;

export const DOWNLOAD_URL = new URL("/download", API_BASE_URL).toString();

export function dismissalKey(policy: MobileUpdatePolicy) {
  return `${CURRENT_MOBILE_PLATFORM ?? "unknown"}:${policy.latest_version}`;
}

function normalizePolicy(payload: unknown): MobileUpdatePolicy | null {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Partial<MobileUpdatePolicy>;
  if (
    record.status !== "current" &&
    record.status !== "available" &&
    record.status !== "required"
  ) {
    return null;
  }

  if (typeof record.latest_version !== "string") return null;

  return {
    status: record.status,
    latest_version: record.latest_version,
    minimum_supported_version:
      typeof record.minimum_supported_version === "string"
        ? record.minimum_supported_version
        : null,
    title: typeof record.title === "string" ? record.title : null,
    message: typeof record.message === "string" ? record.message : null,
    store_url: typeof record.store_url === "string" ? record.store_url : null,
  };
}

export async function fetchMobileUpdatePolicy() {
  if (!CURRENT_MOBILE_PLATFORM) return null;

  const { data } = await api.get<unknown>("/api/v1/mobile-update-policy", {
    params: {
      platform: CURRENT_MOBILE_PLATFORM,
      current_version: CURRENT_APP_VERSION,
    },
  });

  return normalizePolicy(data);
}
