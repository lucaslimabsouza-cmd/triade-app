import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const MAIN_BLUE = "#0E2A47";

// ✅ Assets (caminho correto a partir de src/components)
const logoTriade = require("../../assets/logo-triade-icon.png");
const iconLogout = require("../../assets/sair.png");
const iconMsg = require("../../assets/mensagem.png");

type Props = {
  title: string;
  onLogout?: () => Promise<void>;
  unreadCount?: number; // ✅ vem do Home (mesmo padrão)
};

export default function AppHeader({ title, onLogout, unreadCount = 0 }: Props) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const n = Number(unreadCount) || 0;
  const showBadge = n > 0;
  const badgeText = n > 99 ? "99+" : String(n);

  return (
    <View style={[styles.safeTop, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        {/* Left: Logo */}
        <View style={styles.left}>
          <Image source={logoTriade} style={styles.logo} />
        </View>

        {/* Center: Title */}
        <View style={styles.center}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>

        {/* Right: Icons */}
        <View style={styles.right}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate("Notifications")}
            style={styles.iconBtn}
            hitSlop={10}
          >
            <Image source={iconMsg} style={styles.icon} />

            {/* ✅ Badge (SEM mexer layout) */}
            {showBadge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badgeText}</Text>
              </View>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onLogout}
            style={styles.iconBtn}
            hitSlop={10}
          >
            <Image source={iconLogout} style={styles.icon} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const BAR_HEIGHT = 44; // ✅ mantém igual

const styles = StyleSheet.create({
  safeTop: { backgroundColor: MAIN_BLUE },

  bar: {
    height: BAR_HEIGHT,
    backgroundColor: MAIN_BLUE,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },

  left: { width: 48, justifyContent: "center", alignItems: "flex-start" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },

  right: {
    width: 88,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 14,
  },

  logo: { width: 40, height: 40, resizeMode: "contain" },

  title: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },

  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  icon: { width: 20, height: 20, resizeMode: "contain" },

  // ✅ badge pequeno, sem mexer no layout
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: "#EB5757",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
});
