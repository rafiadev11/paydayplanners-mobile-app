import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY = "paydayplanners.device_id";

export async function getDeviceName(): Promise<string> {
  let id = await SecureStore.getItemAsync(KEY);

  if (!id) {
    id = Crypto.randomUUID();
    await SecureStore.setItemAsync(KEY, id);
  }

  return `${Platform.OS}-${id}`;
}
