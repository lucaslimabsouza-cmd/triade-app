// mobile/components/LogoutButton.tsx
import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../lib/auth";
import { COLORS } from "../lib/theme";

export default function LogoutButton() {
  const { signOut } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await signOut();
    router.replace("/login");
  }

  return (
    <TouchableOpacity style={styles.btn} onPress={handleLogout}>
      <Text style={styles.txt}>Sair</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.blueLight,
  },
  txt: { color: "#fff", fontWeight: "700" }
});
