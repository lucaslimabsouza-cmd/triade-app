// src/screens/NotificationsScreen.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppStackParamList } from "../navigation/types";

const MAIN_BLUE = "#0E2A47";

type Props = NativeStackScreenProps<AppStackParamList, "Notifications">;

export function NotificationsScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
            style={styles.backBtn}
          >
            <Text style={styles.backText}>← Voltar</Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Notificações</Text>
          <View style={{ width: 70 }} />
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Em breve</Text>
          <Text style={styles.sub}>
            Vamos montar essa tela depois (sem quebrar o app).
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default NotificationsScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MAIN_BLUE },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  backBtn: { width: 70, paddingVertical: 6 },
  backText: { color: "#8AB4FF", fontSize: 13, fontWeight: "700" },
  headerTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },

  card: { marginTop: 12, backgroundColor: "#14395E", borderRadius: 12, padding: 14 },
  title: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  sub: { color: "#D0D7E3", marginTop: 8 },
});
