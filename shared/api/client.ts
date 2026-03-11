import axios from "axios";
import { Platform } from "react-native";

import { API_BASE_URL } from "@shared/lib/env";
import { tokenStorage } from "@shared/storage/secure";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

let token: string | null = null;
const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

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

  if (deviceTimezone) {
    config.headers["X-Timezone"] = deviceTimezone;
  }

  return config;
});
