import * as SecureStore from "expo-secure-store";
import { SecureKeys } from "./secureKeys";

export const tokenStorage = {
  async set(token: string) {
    await SecureStore.setItemAsync(SecureKeys.token, token);
  },
  async get() {
    return SecureStore.getItemAsync(SecureKeys.token);
  },
  async clear() {
    await SecureStore.deleteItemAsync(SecureKeys.token);
  },
};
