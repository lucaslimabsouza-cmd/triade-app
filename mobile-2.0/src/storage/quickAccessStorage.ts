import * as SecureStore from "expo-secure-store";

const KEY_NAME = "triade_quick_name_v1";
const KEY_CPF = "triade_quick_cpf_v1";

export const quickAccessStorage = {
  async setUser(name: string, cpf: string) {
    try {
      await SecureStore.setItemAsync(KEY_NAME, name ?? "");
      await SecureStore.setItemAsync(KEY_CPF, cpf ?? "");
    } catch {}
  },

  async getName(): Promise<string | null> {
    try {
      const v = await SecureStore.getItemAsync(KEY_NAME);
      return v && v.trim() ? v : null;
    } catch {
      return null;
    }
  },

  async getCpf(): Promise<string | null> {
    try {
      const v = await SecureStore.getItemAsync(KEY_CPF);
      return v && v.trim() ? v : null;
    } catch {
      return null;
    }
  },

  async clear() {
    try {
      await SecureStore.deleteItemAsync(KEY_NAME);
      await SecureStore.deleteItemAsync(KEY_CPF);
    } catch {}
  },
};
