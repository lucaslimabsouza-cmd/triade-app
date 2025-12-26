import * as SecureStore from "expo-secure-store";

// ✅ SecureStore aceita somente: letras/números e . - _
const KEY_CPF = "triade_lastCpf";
const KEY_BIO = "triade_biometryEnabled";

export async function getLastCpf() {
  return SecureStore.getItemAsync(KEY_CPF);
}

export async function setLastCpf(cpf: string) {
  await SecureStore.setItemAsync(KEY_CPF, cpf);
}

export async function clearLastCpf() {
  await SecureStore.deleteItemAsync(KEY_CPF);
}

export async function isBiometryEnabled() {
  return (await SecureStore.getItemAsync(KEY_BIO)) === "true";
}

export async function setBiometryEnabled(enabled: boolean) {
  await SecureStore.setItemAsync(KEY_BIO, enabled ? "true" : "false");
}
