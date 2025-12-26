import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AuthStackParamList } from "../types";
import { theme } from "../../ui/theme";
import TriadeLoading from "../../ui/TriadeLoading";

import LoginScreen from "../../screens/LoginScreen";
import { ChangePasswordScreen } from "../../screens/ChangePasswordScreen";
import QuickAccessScreen from "../../screens/QuickAccessScreen"; // ✅ default import (SEM chaves)

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
  const [loading, setLoading] = React.useState(true);
  const [initialRoute, setInitialRoute] =
    React.useState<keyof AuthStackParamList>("Login");

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const token = await tokenStorage.get();
        const enabled = await biometryStorage.getEnabled();

        console.log("🔎 [AuthNavigator] token?", !!token);
        console.log("🔎 [AuthNavigator] biometry enabled?", enabled);

        const route: keyof AuthStackParamList =
          token && enabled ? "QuickAccess" : "Login";

        if (alive) setInitialRoute(route);
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

export default AuthNavigator;
