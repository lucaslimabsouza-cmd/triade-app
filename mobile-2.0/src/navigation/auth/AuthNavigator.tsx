import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Linking from "expo-linking";

import { AuthStackParamList } from "../types";
import { theme } from "../../ui/theme";
import TriadeLoading from "../../ui/TriadeLoading";

import LoginScreen from "../../screens/LoginScreen";
import { ChangePasswordScreen } from "../../screens/ChangePasswordScreen";
import QuickAccessScreen from "../../screens/QuickAccessScreen";

import ForgotPasswordScreen from "../../screens/ForgotPasswordScreen";
import ResetPasswordScreen from "../../screens/ResetPasswordScreen";

import { tokenStorage } from "../../storage/tokenStorage";
import { biometryStorage } from "../../storage/biometryStorage";

const Stack = createNativeStackNavigator<AuthStackParamList>();

function parseResetTokenFromUrl(url?: string | null) {
  if (!url) return null;
  const parsed = Linking.parse(url);
  const path = (parsed.path || "").toLowerCase();
  const token = (parsed.queryParams?.token as string) || null;
  const isReset = path.includes("reset-password");
  return { isReset, token };
}

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

  const [initialResetToken, setInitialResetToken] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        // ✅ 1) PRIORIDADE: se abriu por deep link de reset, força ResetPassword
        const initialUrl = await Linking.getInitialURL();
        const parsed = parseResetTokenFromUrl(initialUrl);

        if (parsed?.isReset) {
          console.log("🟦 [AuthNavigator] Deep link RESET detectado:", initialUrl);
          if (alive) {
            setInitialResetToken(parsed.token);
            setInitialRoute("ResetPassword");
          }
          return; // ✅ não deixa o FaceID/QuickAccess sobrescrever
        }

        // ✅ 2) Fluxo normal: QuickAccess ou Login
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

      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />

      {/* ✅ token inicial vindo do deep link */}
      <Stack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        initialParams={initialResetToken ? { token: initialResetToken } : undefined}
      />
    </Stack.Navigator>
  );
}

export default AuthNavigator;
