import * as LocalAuthentication from "expo-local-authentication";

export const biometryService = {
  async canUseFaceId() {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

    const hasFace =
      Array.isArray(types) &&
      types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);

    return hasHardware && isEnrolled && hasFace;
  },

  async authenticate(promptMessage = "Acessar com Face ID") {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: "Cancelar",
      disableDeviceFallback: false, // ✅ rosto OU NADA (não cai pra senha do iPhone)
    });

    return !!result.success;
  },
};
