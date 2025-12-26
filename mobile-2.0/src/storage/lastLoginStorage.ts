import * as SecureStore from "expo-secure-store";

const KEY = "triade_v2_last_login_cpf";

export const lastLoginStorage = {
  async setCpf(cpf: string) {
    await SecureStore.setItemAsync(KEY, cpf);
  },
  async getCpf() {
    return SecureStore.getItemAsync(KEY);
  },
  async clear() {
    await SecureStore.deleteItemAsync(KEY);
  },
};
