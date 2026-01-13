import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { api } from "../services/api";
import TriadeLoading from "../ui/TriadeLoading";

const MAIN_BLUE = "#0E2A47";
const logo = require("../../assets/logo-triade.png");

export default function ForgotPasswordScreen({ navigation }: any) {
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const rawCpf = useMemo(() => cpf.replace(/\D/g, ""), [cpf]);

  function handleCpfChange(text: string) {
    const digits = text.replace(/\D/g, "").slice(0, 11);

    let masked = digits;
    if (digits.length > 3 && digits.length <= 6) {
      masked = `${digits.slice(0, 3)}.${digits.slice(3)}`;
    } else if (digits.length > 6 && digits.length <= 9) {
      masked = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    } else if (digits.length > 9) {
      masked = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(
        6,
        9
      )}-${digits.slice(9)}`;
    }

    setCpf(masked);
  }

  async function handleSend() {
    setErrorMsg(null);

    if (!rawCpf || rawCpf.length !== 11) {
      setErrorMsg("Informe um CPF válido.");
      return;
    }

    if (loading) return;

    try {
      setLoading(true);
      await api.post("/auth/forgot-password", { cpf: rawCpf });

      Alert.alert(
        "Pronto",
        "Se existir uma conta com esse CPF, enviamos um link no e-mail cadastrado.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (e: any) {
      setErrorMsg("Erro ao solicitar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <TriadeLoading />;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.content}>
          <View style={styles.topBlock}>
            <Image source={logo} style={styles.logo} resizeMode="contain" />

            <Text style={styles.title}>Esqueci minha senha</Text>
            <Text style={styles.subtitle}>
              Informe seu CPF para enviarmos um link de redefinição no seu e-mail.
            </Text>

            <View style={styles.form}>
              <Text style={styles.label}>CPF</Text>

              <View style={styles.inputWithIcon}>
                <TextInput
                  style={[
                    styles.input,
                    { flex: 1, marginBottom: 0, paddingRight: 44 },
                  ]}
                  placeholder="000.000.000-00"
                  placeholderTextColor="#8AA0B8"
                  keyboardType="numeric"
                  value={cpf}
                  onChangeText={handleCpfChange}
                />
                <View style={styles.iconRight}>
                  <MaterialCommunityIcons
                    name="account-card-outline"
                    size={22}
                    color="#C0D0E5"
                  />
                </View>
              </View>

              {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

              <TouchableOpacity
                style={styles.button}
                onPress={handleSend}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Enviar link</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
              >
                <Text style={styles.backLink}>Voltar</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Triade • Plataforma exclusiva para investidores.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MAIN_BLUE },
  content: { flex: 1, padding: 24, justifyContent: "space-between" },

  logo: {
    width: 300,
    height: 150,
    alignSelf: "center",
    marginBottom: 10,
    marginTop: 10,
  },

  topBlock: { marginTop: -20 },

  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#EAF2FF",
    textAlign: "center",
    marginTop: 6,
  },

  subtitle: {
    fontSize: 14,
    color: "#C0D0E5",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 26,
    paddingHorizontal: 8,
  },

  form: { marginTop: 4 },
  label: { fontSize: 14, color: "#E0E7F0", marginBottom: 6 },

  inputWithIcon: {
    position: "relative",
    marginBottom: 14,
  },

  // ⬇️ AQUI está o ajuste principal
  input: {
    backgroundColor: "#14395E",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 14,   // ↑ mais alto
    minHeight: 44,         // ↑ garante altura confortável
    fontSize: 16,          // ↑ texto maior
    color: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#1F4C78",
  },

  iconRight: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },

  button: {
    backgroundColor: "#1E88E5",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 6,
  },

  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },

  backLink: {
    color: "#8AB4FF",
    textAlign: "center",
    marginTop: 14,
    fontSize: 13,
  },

  errorText: {
    color: "#FFB3B3",
    marginBottom: 8,
    fontSize: 13,
    textAlign: "center",
  },

  footer: { alignItems: "center", marginBottom: 10 },
  footerText: { fontSize: 12, color: "#9CAFC5" },
});
