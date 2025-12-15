import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.log("⚠️ Push Notifications: precisa ser em dispositivo físico.");
      return null;
    }

    // Android precisa de canal
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("⚠️ Permissão de push negada.");
      return null;
    }

    // EAS / Expo precisa do projectId
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      (Constants as any)?.easConfig?.projectId;

    if (!projectId) {
      console.log(
        "⚠️ Não achei o projectId do EAS. Verifique app.json/app.config."
      );
      return null;
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId }))
      .data;

    console.log("✅ Expo Push Token:", token);
    return token;
  } catch (e) {
    console.log("💥 Erro ao registrar push:", e);
    return null;
  }
}
