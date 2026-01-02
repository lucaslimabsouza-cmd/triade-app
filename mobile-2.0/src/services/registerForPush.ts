import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "./api"; // ajuste o caminho para seu axios

export async function registerForPush() {
  if (!Device.isDevice) {
    console.log("⚠️ Push: precisa ser aparelho físico (não funciona bem em emulador).");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("❌ Push permission not granted");
    return null;
  }

  const projectId =
    (Constants as any)?.expoConfig?.extra?.eas?.projectId ??
    (Constants as any)?.easConfig?.projectId;

  if (!projectId) {
    console.log("❌ projectId não encontrado (EAS projectId).");
    return null;
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  console.log("✅ EXPO PUSH TOKEN =>", token);

  // Envia para o backend (salva em push_tokens)
  await api.post("/push/token", { expo_push_token: token });

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  return token;
}
