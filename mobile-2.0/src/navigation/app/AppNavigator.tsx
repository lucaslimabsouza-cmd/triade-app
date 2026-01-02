// src/navigation/app/AppNavigator.tsx
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AppStackParamList } from "../types";

import HomeScreen from "../../screens/HomeScreen";
import OperationsScreen from "../../screens/OperationsScreen";
import OperationDetailsScreen from "../../screens/OperationDetailsScreen";
import NotificationsScreen from "../../screens/NotificationsScreen";

import OperationTimelineScreen from "../../screens/OperationTimelineScreen";
import OperationCostsScreen from "../../screens/OperationCostsScreen";
import StatementScreen from "../../screens/StatementScreen";

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppNavigator({ onLogout }: { onLogout: () => Promise<void> }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home">
        {(props) => <HomeScreen {...props} onLogout={onLogout} />}
      </Stack.Screen>

      <Stack.Screen name="Operations" component={OperationsScreen} />
      <Stack.Screen name="OperationDetails" component={OperationDetailsScreen} />
      <Stack.Screen name="OperationTimeline" component={OperationTimelineScreen} />
      <Stack.Screen name="OperationCosts" component={OperationCostsScreen} />

      <Stack.Screen name="Notifications" component={NotificationsScreen} />

      <Stack.Screen name="Statement" component={StatementScreen} />
    </Stack.Navigator>
  );
}

export default AppNavigator;
