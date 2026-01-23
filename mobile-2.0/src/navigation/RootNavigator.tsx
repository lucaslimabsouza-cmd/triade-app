import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { AuthNavigator } from "./auth/AuthNavigator";
import { AppNavigator } from "./app/AppNavigator";
import { AdminNavigator } from "./app/AdminNavigator";
import { tokenStorage } from "../storage/tokenStorage";
import { biometryStorage } from "../storage/biometryStorage";
import { isAdminFromToken } from "../utils/jwt";

export type RootStackParamList = {
  Auth: undefined;
  App: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const [signedIn, setSignedIn] = React.useState(false);
  const [isAdmin, setIsAdmin] = React.useState(false);

  React.useEffect(() => {
    console.log("🧭 [RootNavigator] signedIn =", signedIn, "isAdmin =", isAdmin);
  }, [signedIn, isAdmin]);

  // ✅ Verificar se é admin ao carregar
  React.useEffect(() => {
    if (signedIn) {
      checkAdminStatus();
    }
  }, [signedIn]);

  async function checkAdminStatus() {
    try {
      const token = await tokenStorage.get();
      const admin = isAdminFromToken(token);
      setIsAdmin(admin);
    } catch {
      setIsAdmin(false);
    }
  }

  async function handleLogout() {
    await tokenStorage.clear();
    setSignedIn(false);
    setIsAdmin(false);
  }

  return (
    <Stack.Navigator
      key={signedIn ? (isAdmin ? "admin" : "app") : "auth"} // ✅ Força remount baseado em admin
      screenOptions={{ headerShown: false }}
    >
      {!signedIn ? (
        <Stack.Screen name="Auth">
          {(props) => (
            <AuthNavigator
              {...props}
              onSignedIn={async () => {
                console.log("🧭 [RootNavigator] setSignedIn(true)");
                setSignedIn(true);
                // ✅ Verificar admin após login
                await checkAdminStatus();
              }}
              onLogout={handleLogout}
            />
          )}
        </Stack.Screen>
      ) : isAdmin ? (
        <Stack.Screen name="App">
          {(props) => <AdminNavigator {...props} onLogout={handleLogout} />}
        </Stack.Screen>
      ) : (
        <Stack.Screen name="App">
          {(props) => <AppNavigator {...props} onLogout={handleLogout} />}
        </Stack.Screen>
      )}
    </Stack.Navigator>
  );
}

export default RootNavigator;
