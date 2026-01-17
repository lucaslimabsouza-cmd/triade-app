import React, { useEffect } from "react";
import { Platform } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import RootNavigator from "./src/navigation/RootNavigator";
import * as Notifications from "expo-notifications";

// 🔔 Configuração padrão de notificações
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// 🔗 CONFIGURAÇÃO DE DEEP LINK (CORRETA)
const linking = {
  prefixes: ["triade://"],
  config: {
    screens: {
      Auth: {
        screens: {
          // ✅ AQUI É O PONTO-CHAVE:
          // triade://reset-password?token=XYZ
          // abre a tela ResetPassword
          ResetPassword: "reset-password",
        },
      },
    },
  },
};

export default function App() {
  useEffect(() => {
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
