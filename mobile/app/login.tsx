import { setLastLoginCpf } from "../lib/session";

import React, { useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../lib/auth";
import { API_BASE_URL } from "../lib/config";
import { Ionicons } from "@expo/vector-icons";

import TriadeLoading from "../components/TriadeLoading";

const MAIN_BLUE = "#0E2A47";
const logo = require("../assets/logo-triade.png");

export default function LoginScreen() {
  const router = useRouter();
  const { setAuth } = useAuth();

  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  function handleCpfChange(text: string) {
    const digits = text.replace(/\D/g, "").slice(0, 11);

    let masked = digits;
    if (digits.length > 3 && digits.length <= 6) {
      masked = `${digits.slice(0, 3)}.${digits.slice(3)}`;
    } else if (digits.length > 6 && digits.length <= 9) {
      masked = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    } else if (digits.length > 9) {
      masked = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    }

    setCpf(masked);
  }

  async function handleLogin() {
    setErrorMsg(null);

    const rawCpf = cpf.replace(/\D/g, "");
    if (!rawCpf || !password) {
      setErrorMsg("Informe CPF e senha.");
      return;
    }

    // evita duplo clique
    if (loading) return;

    setLastLoginCpf(rawCpf);

    try {
      setLoading(true);

      const url = `${API_BASE_URL}/auth/login`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpf: rawCpf, password }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.success) {
        setErrorMsg(data?.message || "CPF ou senha inválidos.");
        return;
      }

      setAuth({
        user: {
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
        },
        token: data.token,
      });

      router.replace("/home");
    } catch (error) {
      setErrorMsg("Erro ao conectar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <TriadeLoading />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.content}>
          <View style={styles.topBlock}>
            <Image source={logo} style={styles.logo} resizeMode="contain" />

            <Text style={styles.appSubtitle}>
              Acompanhe seus investimentos em leilões imobiliários.
            </Text>

            <View style={styles.form}>
              <Text style={styles.label}>CPF</Text>
              <TextInput
                style={styles.input}
                placeholder="000.000.000-00"
                placeholderTextColor="#8AA0B8"
                keyboardType="numeric"
                value={cpf}
                onChangeText={handleCpfChange}
              />

              <Text style={styles.label}>Senha</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Digite sua senha"
                  placeholderTextColor="#8AA0B8"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />

                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showPassword ? "eye" : "eye-off"}
                    size={24}
                    color="#C0D0E5"
                  />
                </TouchableOpacity>
              </View>

              {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

              <TouchableOpacity
                onPress={() =>
                  alert("Função ainda não disponível, para alterar a senha procure o responsável.")
                }
              >
                <Text style={styles.forgotPassword}>Esqueci minha senha</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, loading ? { opacity: 0.7 } : null]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Entrar</Text>
                )}
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
    marginBottom: 15,
    marginTop: 10,
  },

  topBlock: { marginTop: -20 },
  appSubtitle: {
    fontSize: 15,
    color: "#C0D0E5",
    textAlign: "center",
    marginBottom: 30,
  },

  form: { marginTop: 10 },
  label: { fontSize: 14, color: "#E0E7F0", marginBottom: 4 },

  input: {
    backgroundColor: "#14395E",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#FFFFFF",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#1F4C78",
  },

  passwordWrapper: { flexDirection: "row", alignItems: "center" },
  eyeButton: { position: "absolute", right: 12 },

  forgotPassword: {
    color: "#8AB4FF",
    textAlign: "right",
    marginBottom: 10,
    fontSize: 13,
  },

  button: {
    backgroundColor: "#1E88E5",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },

  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  errorText: { color: "#FFB3B3", marginBottom: 8, fontSize: 13 },

  footer: { alignItems: "center", marginBottom: 10 },
  footerText: { fontSize: 12, color: "#9CAFC5" },
});

export {};
