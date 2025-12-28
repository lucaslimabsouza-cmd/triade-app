// src/navigation/app/AppNavigator.tsx

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AppStackParamList } from "../types";

import { HomeScreen } from "../../screens/HomeScreen";
import { OperationsScreen } from "../../screens/OperationsScreen";
import { OperationDetailsScreen } from "../../screens/OperationDetailsScreen";
import { NotificationsScreen } from "../../screens/NotificationsScreen";

// ✅ placeholders (ou suas telas reais quando você me mandar o antigo)
import { OperationTimelineScreen } from "../../screens/OperationTimelineScreen";
import { OperationCostsScreen } from "../../screens/OperationCostsScreen";

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppNavigator({ onLogout }: { onLogout: () => Promise<void> }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home">
        {(props) => <HomeScreen {...props} onLogout={onLogout} />}
      </Stack.Screen>

      <Stack.Screen name="Operations" component={OperationsScreen} />
      <Stack.Screen name="OperationDetails" component={OperationDetailsScreen} />

      {/* ✅ NOVAS */}
      <Stack.Screen name="OperationTimeline" component={OperationTimelineScreen} />
      <Stack.Screen name="OperationCosts" component={OperationCostsScreen} />

      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}

export default AppNavigator;
