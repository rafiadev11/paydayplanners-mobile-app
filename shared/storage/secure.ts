import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "paydayplanners.auth_token";
const USER_KEY = "paydayplanners.auth_user";

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
