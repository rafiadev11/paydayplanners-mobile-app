import axios from "axios";
import { Platform } from "react-native";

import { API_BASE_URL } from "@shared/lib/env";
import { getAppTimezone } from "@shared/lib/timezone";
import { tokenStorage } from "@shared/storage/secure";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

let token: string | null = null;

export async function setAuthToken(next: string | null) {
  token = next;

  if (next) {
    await tokenStorage.set(next);
    return;
  }

  await tokenStorage.clear();
}

api.interceptors.request.use(async (config) => {
  if (token === null) token = await tokenStorage.get();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  config.headers.Accept = "application/json";
  config.headers["X-Client-Platform"] =
    Platform.OS === "ios" ? "ios" : "android";

  const timezone = getAppTimezone();

  if (timezone) {
    config.headers["X-Timezone"] = timezone;
  }

  return config;
});
