import { Platform } from "react-native";

const PROD_API_FALLBACK_URL = "https://api.example.com";
const PROD_LEGAL_FALLBACK_URL = "https://paydayplanners.com";

const enforceProtocol = (value: string | undefined, label: string) => {
  if (!value) return undefined;

  const normalized = value.trim();

  try {
    const parsed = new URL(normalized);
    const isHttps = parsed.protocol === "https:";
    const isHttpDev = __DEV__ && parsed.protocol === "http:";

    if (isHttps || isHttpDev) return normalized;
    if (__DEV__)
      throw new Error(`${label} must use https:// outside local development.`);
    return undefined;
  } catch {
    if (__DEV__) throw new Error(`${label} is not a valid URL.`);
    return undefined;
  }
};

const resolvePlatformUrl = (
  androidValue: string | undefined,
  iosValue: string | undefined,
  defaultValue: string | undefined,
) =>
  Platform.OS === "android"
    ? (androidValue ?? defaultValue)
    : (iosValue ?? defaultValue);

const buildUrl = (baseUrl: string, pathname: string) =>
  new URL(pathname, baseUrl).toString();

export const API_BASE_URL =
  enforceProtocol(
    resolvePlatformUrl(
      process.env.EXPO_PUBLIC_API_URL_ANDROID,
      process.env.EXPO_PUBLIC_API_URL_IOS,
      process.env.EXPO_PUBLIC_API_URL,
    ),
    "EXPO_PUBLIC_API_URL",
  ) ?? (__DEV__ ? "http://localhost" : PROD_API_FALLBACK_URL);

export const LEGAL_BASE_URL =
  enforceProtocol(process.env.EXPO_PUBLIC_LEGAL_URL, "EXPO_PUBLIC_LEGAL_URL") ??
  (__DEV__ ? API_BASE_URL : PROD_LEGAL_FALLBACK_URL);

export const TERMS_URL =
  enforceProtocol(process.env.EXPO_PUBLIC_TERMS_URL, "EXPO_PUBLIC_TERMS_URL") ??
  buildUrl(LEGAL_BASE_URL, "/terms");

export const PRIVACY_URL =
  enforceProtocol(
    process.env.EXPO_PUBLIC_PRIVACY_URL,
    "EXPO_PUBLIC_PRIVACY_URL",
  ) ?? buildUrl(LEGAL_BASE_URL, "/privacy");
