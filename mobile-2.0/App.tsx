import React, { useEffect } from "react";
import { Platform } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import RootNavigator from "./src/navigation/RootNavigator";

import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";

// ✅ Faz o push aparecer mesmo com o app aberto (foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// ✅ Deep link config (compatível com seu RootNavigator: Auth/App)
const linking = {
  prefixes: [Linking.createURL("/"), "triade://"],
  config: {
    screens: {
      Auth: {
        screens: {
          Login: "login",
          QuickAccess: "quick-access",
          ChangePassword: "change-password",
          ForgotPassword: "forgot-password",
          ResetPassword: "reset-password",
        },
      },
      App: {
        // (não precisamos mapear nada aqui agora)
        screens: {},
      },
    },
  },
};

export default function App() {
  useEffect(() => {
    // ✅ Android: garante canal default (não atrapalha iOS)
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
      }).catch(() => {});
    }
  }, []);

  return (
    <NavigationContainer linking={linking}>
      <RootNavigator />
    </NavigationContainer>
  );
}
