import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type Props = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode; // opcional: botão/ícone do lado direito
  children: React.ReactNode;
};

export default function TriadeScreen({ title, subtitle, onBack, right, children }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            {onBack ? (
              <TouchableOpacity onPress={onBack} activeOpacity={0.8} style={styles.backBtn}>
                <Text style={styles.backText}>← Voltar</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.backPlaceholder} />
            )}

            <View style={styles.headerCenter}>
              <Text style={styles.title}>{title}</Text>
              {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>

            <View style={styles.right}>{right ?? null}</View>
          </View>
        </View>

        <View style={styles.body}>{children}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0E2A47" },
  container: { flex: 1, backgroundColor: "#0E2A47" },

  header: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  backBtn: { paddingVertical: 8, paddingRight: 10 },
  backText: { color: "#8AB4FF", fontSize: 14, fontWeight: "700" },
  backPlaceholder: { width: 72 }, // mantém título centralizado quando não tem back

  headerCenter: { flex: 1 },
  title: { color: "#FFFFFF", fontSize: 20, fontWeight: "800" },
  subtitle: { color: "#D0D7E3", fontSize: 13, marginTop: 2 },

  right: { width: 72, alignItems: "flex-end" },

  body: { flex: 1, paddingHorizontal: 16, paddingBottom: 16 },
});
