// src/navigation/app/AdminNavigator.tsx
// ✅ Navegação separada para administradores

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AdminStackParamList } from "../types";

import AdminHomeScreen from "../../screens/admin/AdminHomeScreen";
import AdminOperationsScreen from "../../screens/admin/AdminOperationsScreen";
import AdminPartiesScreen from "../../screens/admin/AdminPartiesScreen";
import AdminMovementsScreen from "../../screens/admin/AdminMovementsScreen";
import OperationDetailsScreen from "../../screens/OperationDetailsScreen";
import OperationCostsScreen from "../../screens/OperationCostsScreen";

const Stack = createNativeStackNavigator<AdminStackParamList>();

export function AdminNavigator({ onLogout }: { onLogout: () => Promise<void> }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminHome">
        {(props) => <AdminHomeScreen {...props} onLogout={onLogout} />}
      </Stack.Screen>

      <Stack.Screen name="AdminOperations" component={AdminOperationsScreen} />
      <Stack.Screen name="AdminParties" component={AdminPartiesScreen} />
      <Stack.Screen name="AdminMovements" component={AdminMovementsScreen} />

      {/* ✅ Adicionar telas de Details e Costs para admin também */}
      <Stack.Screen name="OperationDetails" component={OperationDetailsScreen} />
      <Stack.Screen name="OperationCosts" component={OperationCostsScreen} />
    </Stack.Navigator>
  );
}

export default AdminNavigator;
