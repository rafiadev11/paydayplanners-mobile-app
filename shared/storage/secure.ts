import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "paydayplanners.auth_token";
const USER_KEY = "paydayplanners.auth_user";
const BIOMETRIC_PREFS_KEY = "paydayplanners.biometric_prefs";

export const tokenStorage = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  set: (value: string) => SecureStore.setItemAsync(TOKEN_KEY, value),
  clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};

export const userStorage = {
  get: () => SecureStore.getItemAsync(USER_KEY),
  set: (value: string) => SecureStore.setItemAsync(USER_KEY, value),
  clear: () => SecureStore.deleteItemAsync(USER_KEY),
};

export const biometricPrefsStorage = {
  get: () => SecureStore.getItemAsync(BIOMETRIC_PREFS_KEY),
  set: (value: string) => SecureStore.setItemAsync(BIOMETRIC_PREFS_KEY, value),
  clear: () => SecureStore.deleteItemAsync(BIOMETRIC_PREFS_KEY),
};
