import * as SecureStore from "expo-secure-store";
import { SecureKeys } from "./secureKeys";

export const biometryStorage = {
  async setEnabled(enabled: boolean) {
    await SecureStore.setItemAsync(SecureKeys.biometryEnabled, enabled ? "1" : "0");
  },
  async isEnabled() {
    const v = await SecureStore.getItemAsync(SecureKeys.biometryEnabled);
    return v === "1";
  },
  async clear() {
    await SecureStore.deleteItemAsync(SecureKeys.biometryEnabled);
  },
};
