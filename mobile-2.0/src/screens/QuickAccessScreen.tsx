import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import TriadeLoading from "../ui/TriadeLoading";
import { biometryService } from "../services/biometryService";
import { tokenStorage } from "../storage/tokenStorage";
import { biometryStorage } from "../storage/biometryStorage";
import { lastLoginStorage } from "../storage/lastLoginStorage";

const MAIN_BLUE = "#0E2A47";
const logo = require("../../assets/logo-triade.png");

type Props = {
  onSignedIn: () => void;
  onUseAnotherAccount: () => void;
};

export default function QuickAccessScreen({ onSignedIn, onUseAnotherAccount }: Props) {
  const [loading, setLoading] = useState(true);
  const [cpf, setCpf] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const savedCpf = await lastLoginStorage.getCpf();
      setCpf(savedCpf ?? null);
      setLoading(false);
    })();
  }, []);

  async function handleAccess() {
    try {
      setLoading(true);

      const token = await tokenStorage.get();
      if (!token) {
        Alert.alert("Sessão", "Nenhuma sessão encontrada. Entre com CPF e senha.");
        onUseAnotherAccount();
        return;
      }

      const enabled = await biometryStorage.getEnabled();
      if (!enabled) {
        Alert.alert("Face ID", "Face ID não está habilitado.");
        onUseAnotherAccount();
        return;
      }

      const ok = await biometryService.authenticate("Acessar com Face ID");
      if (!ok) return;

      onSignedIn();
    } finally {
      setLoading(false);
    }
  }

  async function handleAnotherAccount() {
    await tokenStorage.clear();
    await biometryStorage.setEnabled(false);
    onUseAnotherAccount();
  }

  if (loading) return <TriadeLoading />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.topBlock}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Bem-vindo de volta</Text>
          {cpf ? <Text style={styles.subtitle}>CPF: {cpf}</Text> : null}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.button} onPress={handleAccess} activeOpacity={0.85}>
            <Text style={styles.buttonText}>Acessar</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleAnotherAccount} activeOpacity={0.8}>
            <Text style={styles.link}>Entrar com outra conta</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Triade • Plataforma exclusiva para investidores.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MAIN_BLUE },
  content: { flex: 1, padding: 24, justifyContent: "space-between" },

  logo: { width: 300, height: 150, alignSelf: "center", marginBottom: 8, marginTop: 10 },
  topBlock: { marginTop: -20 },
  title: { fontSize: 22, color: "#E0E7F0", textAlign: "center", fontWeight: "800" },
  subtitle: { fontSize: 14, color: "#C0D0E5", textAlign: "center", marginTop: 8 },

  actions: { gap: 14 },
  button: {
    backgroundColor: "#1E88E5",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  link: { color: "#8AB4FF", textAlign: "center", fontSize: 13 },

  footer: { alignItems: "center", marginBottom: 10 },
  footerText: { fontSize: 12, color: "#9CAFC5" },
});
