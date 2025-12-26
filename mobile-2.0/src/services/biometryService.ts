import * as LocalAuthentication from "expo-local-authentication";

export async function canUseBiometry() {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && isEnrolled;
}

export async function authenticateBiometry() {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Entrar com Face ID",
    fallbackLabel: "Usar senha",
    cancelLabel: "Cancelar",
    disableDeviceFallback: false,
  });

  return result.success;
}
