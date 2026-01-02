import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";

type Props = {
  title: string;
  onBack?: () => void;     // se não passar, não mostra “Voltar”
  right?: React.ReactNode; // opcional (ex: botão)

  // ✅ NOVO: mensagens + badge
  onPressMessages?: () => void; // se passar, mostra ícone "mensagem" no header
  unreadCount?: number;         // número de notificações não lidas (badge)
};

const mensagemIcon = require("../../assets/mensagem.png"); // ajuste o caminho se necessário

function formatBadge(n: number) {
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n > 99) return "99+";
  if (n > 9) return "9+";
  return String(n);
}

export default function AppHeader({ title, onBack, right, onPressMessages, unreadCount }: Props) {
  const badgeText = formatBadge(Number(unreadCount ?? 0));
  const showMessages = !!onPressMessages && !right; // se você passar "right", ele tem prioridade

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
      <View style={styles.right}>
        {right ? (
          right
        ) : showMessages ? (
          <TouchableOpacity onPress={onPressMessages} activeOpacity={0.8} style={styles.msgBtn}>
            <View style={styles.msgIconWrap}>
              <Image source={mensagemIcon} style={styles.msgIcon} resizeMode="contain" />

              {badgeText ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badgeText}</Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.rightPlaceholder} />
        )}
      </View>
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
  rightPlaceholder: { height: 24, width: 36 },

  // ✅ Mensagens
  msgBtn: { paddingVertical: 6, paddingHorizontal: 6 },
  msgIconWrap: { width: 28, height: 28, position: "relative" },
  msgIcon: { width: 28, height: 28 },

  // ✅ Badge
  badge: {
    position: "absolute",
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: "#EB5757",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: "#0E2A47",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    includeFontPadding: false,
  },
});
