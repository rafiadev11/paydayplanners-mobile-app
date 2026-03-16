import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "paydayplanners.auth_token";
const USER_KEY = "paydayplanners.auth_user";
const BIOMETRIC_PREFS_KEY = "paydayplanners.biometric_prefs";
const NOTIFICATION_PREFS_KEY = "paydayplanners.notification_prefs";
const BILL_REMINDER_SCHEDULES_KEY = "paydayplanners.bill_reminder_schedules";

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

export const notificationPrefsStorage = {
  get: () => SecureStore.getItemAsync(NOTIFICATION_PREFS_KEY),
  set: (value: string) =>
    SecureStore.setItemAsync(NOTIFICATION_PREFS_KEY, value),
  clear: () => SecureStore.deleteItemAsync(NOTIFICATION_PREFS_KEY),
};

export const billReminderSchedulesStorage = {
  get: () => SecureStore.getItemAsync(BILL_REMINDER_SCHEDULES_KEY),
  set: (value: string) =>
    SecureStore.setItemAsync(BILL_REMINDER_SCHEDULES_KEY, value),
  clear: () => SecureStore.deleteItemAsync(BILL_REMINDER_SCHEDULES_KEY),
};
