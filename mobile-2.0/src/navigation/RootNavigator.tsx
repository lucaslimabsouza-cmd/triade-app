import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { AuthNavigator } from "./auth/AuthNavigator";
import { AppNavigator } from "./app/AppNavigator";
import { tokenStorage } from "../storage/tokenStorage";
import { biometryStorage } from "../storage/biometryStorage";

// ✅ NOVO: Provider do pull-to-refresh global
import { RefreshRegistryProvider } from "../refresh/RefreshRegistry";

export type RootStackParamList = {
  Auth: undefined;
  App: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const [signedIn, setSignedIn] = React.useState(false);

  React.useEffect(() => {
    console.log("🧭 [RootNavigator] signedIn =", signedIn);
  }, [signedIn]);

  async function handleLogout() {
    await tokenStorage.clear();
    setSignedIn(false);
  }

  return (
    <RefreshRegistryProvider>
      <Stack.Navigator
        key={signedIn ? "app" : "auth"} // ✅ força remount ao trocar
        screenOptions={{ headerShown: false }}
      >
        {!signedIn ? (
          <Stack.Screen name="Auth">
            {(props) => (
              <AuthNavigator
                {...props}
                onSignedIn={() => {
                  console.log("🧭 [RootNavigator] setSignedIn(true)");
                  setSignedIn(true);
                }}
                onLogout={handleLogout}
              />
            )}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="App">
            {(props) => <AppNavigator {...props} onLogout={handleLogout} />}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </RefreshRegistryProvider>
  );
}

export default RootNavigator;
