// mobile/app/_layout.tsx
import React from "react";
import { Stack, useRouter } from "expo-router";
import { TouchableOpacity, Text } from "react-native";
import { AuthProvider, useAuth } from "../lib/auth";

const HEADER_BLUE = "#0E2A47";

function LogoutButton() {
  const router = useRouter();
  const { logout } = useAuth();

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  return (
    <TouchableOpacity
      onPress={handleLogout}
      style={{ marginRight: 12, paddingHorizontal: 8, paddingVertical: 4 }}
    >
      <Text
        style={{
          color: "#FFD1D1",
          fontSize: 14,
          fontWeight: "600",
        }}
      >
        Sair
      </Text>
    </TouchableOpacity>
  );
}

function StackNavigator() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: HEADER_BLUE,
        },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: {
          fontWeight: "600",
        },
        headerTitleAlign: "left",
      }}
    >
      {/* tira o index do topo */}
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="login"
        options={{
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="home"
        options={{
          title: "Home",
          headerRight: () => <LogoutButton />,
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />

      <Stack.Screen
        name="operations"
        options={{
          title: "Minhas operações",
        }}
      />

      <Stack.Screen
        name="operation-details"
        options={{
          title: "Detalhes da operação",
        }}
      />

      {/* 🔹 A rota que estava faltando */}
      <Stack.Screen
        name="operation-costs"
        options={{
          title: "Custos da operação",
        }}
      />

      <Stack.Screen
        name="notifications"
        options={{
          title: "Notificações",
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StackNavigator />
    </AuthProvider>
  );
}
