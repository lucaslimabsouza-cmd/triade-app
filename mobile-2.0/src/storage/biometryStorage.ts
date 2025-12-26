import * as SecureStore from "expo-secure-store";

const KEY = "triade_biometry_enabled_v1";

export const biometryStorage = {
  async getEnabled(): Promise<boolean> {
    try {
      const v = await SecureStore.getItemAsync(KEY);
      return v === "1";
    } catch {
      return false;
    }
  },

  async setEnabled(enabled: boolean): Promise<void> {
    try {
      await SecureStore.setItemAsync(KEY, enabled ? "1" : "0");
    } catch {
      // silêncio: não quebra o app
    }
  },
};
