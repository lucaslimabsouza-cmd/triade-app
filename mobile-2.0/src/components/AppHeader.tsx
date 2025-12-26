import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import { tokenStorage } from "../storage/tokenStorage";

const MAIN_BLUE = "#0E2A47";

type Props = {
  title?: string;
  onLogout?: () => Promise<void>;
};

export function AppHeader({ title, onLogout }: Props) {
  const navigation = useNavigation<any>();
  const route = useRoute();

  const isHome = route.name === "Home";

  async function handleLeftPress() {
    if (isHome) {
      Alert.alert("Sair", "Deseja sair da sua conta?", [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sair",
          style: "destructive",
          onPress: async () => {
            await tokenStorage.clear();
            if (onLogout) await onLogout();
          },
        },
      ]);
    } else {
      navigation.goBack();
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.container}>
        <TouchableOpacity
          onPress={handleLeftPress}
          style={styles.leftBtn}
          activeOpacity={0.8}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={isHome ? "log-out-outline" : "chevron-back"}
            size={22}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <Text style={styles.title} numberOfLines={1}>
          {title ?? ""}
        </Text>

        {/* Espaço do lado direito para centralizar o título */}
        <View style={styles.rightSpace} />
      </View>

      <View style={styles.divider} />
    </SafeAreaView>
  );
}

export default AppHeader;

const styles = StyleSheet.create({
  safe: {
    backgroundColor: MAIN_BLUE,
  },
  container: {
    height: 56, // ✅ maior (antes era 44)
    backgroundColor: MAIN_BLUE,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  divider: {
    height: 1,
    backgroundColor: "#163B60",
  },
  leftBtn: {
    width: 44, // ✅ área clicável maior
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    paddingHorizontal: 8,
  },
  rightSpace: {
    width: 44,
    height: 44,
  },
});
