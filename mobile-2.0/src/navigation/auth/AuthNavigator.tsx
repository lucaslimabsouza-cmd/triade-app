import React, { useEffect, useState } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../types";

import { LoginScreen } from "../../screens/LoginScreen";
import { ChangePasswordScreen } from "../../screens/ChangePasswordScreen";
import QuickAccessScreen from "../../screens/QuickAccessScreen";

import { theme } from "../../ui/theme";
import TriadeLoading from "../../ui/TriadeLoading";
import { tokenStorage } from "../../storage/tokenStorage";
import { biometryStorage } from "../../storage/biometryStorage";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator({
  onSignedIn,
  onLogout,
}: {
  onSignedIn: () => void;
  onLogout: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(true);
  const [initialRoute, setInitialRoute] =
    useState<keyof AuthStackParamList>("Login");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const token = await tokenStorage.get();
        const enabled = await biometryStorage.getEnabled();
        if (!alive) return;
        setInitialRoute(token && enabled ? "QuickAccess" : "Login");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  if (loading) return <TriadeLoading />;

  return (
    <Stack.Navigator
      key={initialRoute} // ✅ força remount com rota inicial correta
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.navy },
      }}
    >
      <Stack.Screen name="QuickAccess">
        {(props) => (
          <QuickAccessScreen
            {...props}
            onSignedIn={onSignedIn}
            onUseAnotherAccount={onLogout}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="Login">
        {(props) => <LoginScreen {...props} onSignedIn={onSignedIn} />}
      </Stack.Screen>

      <Stack.Screen name="ChangePassword">
        {(props) => <ChangePasswordScreen {...props} onSignedIn={onSignedIn} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
