import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

type Props = {
  title: string;
  onBack?: () => void;     // se não passar, não mostra “Voltar”
  right?: React.ReactNode; // opcional (ex: botão)
};

export default function AppHeader({ title, onBack, right }: Props) {
  return (
    <View style={styles.wrap}>
      {/* Left */}
      <View style={styles.left}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} activeOpacity={0.8} style={styles.backBtn}>
            <Text style={styles.backText}>← Voltar</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backPlaceholder} />
        )}
      </View>

      {/* Center */}
      <View style={styles.center}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>

      {/* Right */}
      <View style={styles.right}>{right ? right : <View style={styles.rightPlaceholder} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  left: { width: 90, justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  right: { width: 90, alignItems: "flex-end", justifyContent: "center" },

  backBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  backText: { color: "#8AB4FF", fontSize: 13, fontWeight: "700" },

  title: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },

  backPlaceholder: { height: 24 },
  rightPlaceholder: { height: 24 },
});
