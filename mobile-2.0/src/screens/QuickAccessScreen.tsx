import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import TriadeLoading from "../ui/TriadeLoading";
import { biometryService } from "../services/biometryService";
import { tokenStorage } from "../storage/tokenStorage";
import { biometryStorage } from "../storage/biometryStorage";
import { quickAccessStorage } from "../storage/quickAccessStorage";
import { AuthStackParamList } from "../navigation/types";

const MAIN_BLUE = "#0E2A47";
const logo = require("../../assets/logo-triade.png");

type Props = NativeStackScreenProps<AuthStackParamList, "QuickAccess"> & {
  onSignedIn: () => void;
  onUseAnotherAccount: () => void;
};

function formatCpf(cpf?: string | null) {
  const d = String(cpf ?? "").replace(/\D/g, "").slice(0, 11);
  if (d.length !== 11) return cpf ?? "";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export default function QuickAccessScreen({ navigation, onSignedIn, onUseAnotherAccount }: Props) {
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState<string | null>(null);
  const [cpf, setCpf] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const savedName = await quickAccessStorage.getName();
        const savedCpf = await quickAccessStorage.getCpf();

        if (!alive) return;
        setName(savedName ?? null);
        setCpf(savedCpf ?? null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  function goToLogin() {
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  }

  async function handleAccess() {
    try {
      setLoading(true);

      const token = await tokenStorage.get();
      console.log("🔎 [QuickAccess] token?", !!token);

      if (!token) {
        Alert.alert("Sessão", "Nenhuma sessão encontrada. Entre com CPF e senha.");
        goToLogin();
        return;
      }

      const enabled = await biometryStorage.getEnabled();
      console.log("🔎 [QuickAccess] biometry enabled?", enabled);

      if (!enabled) {
        Alert.alert("Face ID", "O Face ID não está ativado. Entre com CPF e senha para ativar.");
        goToLogin();
        return;
      }

      const canUse = await biometryService.canUseFaceId();
      console.log("🔎 [QuickAccess] canUseFaceId?", canUse);

      if (!canUse) {
        Alert.alert("Face ID", "Face ID indisponível neste aparelho. Verifique as configurações.");
        goToLogin();
        return;
      }

      const ok = await biometryService.authenticate("Acessar com Face ID");
      console.log("🟩 [QuickAccess] FaceID result:", ok);

      if (!ok) return;

      onSignedIn();
    } finally {
      setLoading(false);
    }
  }

  async function handleAnotherAccount() {
    await tokenStorage.clear();
    await biometryStorage.setEnabled(false);
    await quickAccessStorage.clear();

    onUseAnotherAccount();
    goToLogin();
  }

  if (loading) return <TriadeLoading />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.topBlock}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Bem-vindo de volta</Text>

          {name ? <Text style={styles.name}>{name}</Text> : null}
          {cpf ? <Text style={styles.subtitle}>CPF: {formatCpf(cpf)}</Text> : null}
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

  name: { fontSize: 16, color: "#FFFFFF", textAlign: "center", marginTop: 10, fontWeight: "700" },
  subtitle: { fontSize: 13, color: "#C0D0E5", textAlign: "center", marginTop: 6 },

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
