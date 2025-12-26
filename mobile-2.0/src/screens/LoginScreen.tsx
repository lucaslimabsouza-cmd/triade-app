import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { AuthStackParamList } from "../navigation/types";
import TriadeLoading from "../ui/TriadeLoading";

import { authService } from "../services/authService";
import { biometryService } from "../services/biometryService";
import { tokenStorage } from "../storage/tokenStorage";
import { lastLoginStorage } from "../storage/lastLoginStorage";
import { biometryStorage } from "../storage/biometryStorage";

const MAIN_BLUE = "#0E2A47";
const logo = require("../../assets/logo-triade.png");

type Props = NativeStackScreenProps<AuthStackParamList, "Login"> & {
  onSignedIn: () => void;
};

export function LoginScreen({ navigation, onSignedIn }: Props) {
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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

  async function handleLoginWithPassword() {
    setErrorMsg(null);

    if (!rawCpf || !password) {
      setErrorMsg("Informe CPF e senha.");
      return;
    }

    if (loading) return;

    try {
      setLoading(true);

      await lastLoginStorage.setCpf(rawCpf);

      const data = await authService.login(rawCpf, password);
      console.log("✅ [LoginScreen] login response:", data);

      if (!data?.ok || !data?.token) {
        setErrorMsg(data?.error || "CPF ou senha inválidos.");
        return;
      }

      await tokenStorage.set(data.token);

      const saved = await tokenStorage.get();
      console.log("🔐 [LoginScreen] token saved?", !!saved);

      if (data.must_change_password) {
        navigation.navigate("ChangePassword", { token: data.token });
        return;
      }

      // ✅ DESBLOQUEIO: entra no app imediatamente
      console.log("🚀 [LoginScreen] calling onSignedIn()");
      onSignedIn();
      return;
    } catch (e) {
      setErrorMsg("Erro ao conectar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLoginWithFaceId() {
    setErrorMsg(null);
    if (loading) return;

    try {
      setLoading(true);

      const token = await tokenStorage.get();
      if (!token) {
        setErrorMsg("Nenhuma sessão encontrada. Faça login com CPF e senha primeiro.");
        return;
      }

      const enabled = await biometryStorage.getEnabled();
      if (!enabled) {
        setErrorMsg("Face ID ainda não está habilitado.");
        return;
      }

      const ok = await biometryService.authenticate("Entrar com Face ID");
      if (!ok) return;

      onSignedIn();
    } catch {
      setErrorMsg("Não foi possível usar Face ID agora.");
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
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
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
                  <MaterialCommunityIcons
                    name={showPassword ? "eye" : "eye-off"}
                    size={24}
                    color="#C0D0E5"
                  />
                </TouchableOpacity>
              </View>

              {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

              <TouchableOpacity
                style={styles.button}
                onPress={handleLoginWithPassword}
                activeOpacity={0.85}
              >
                <Text style={styles.buttonText}>Entrar</Text>
              </TouchableOpacity>

              <View style={styles.faceIdBlock}>
                <Text style={styles.faceIdText}>
                  Para usar Face ID, toque no ícone abaixo
                </Text>

                <TouchableOpacity
                  onPress={handleLoginWithFaceId}
                  activeOpacity={0.8}
                  style={styles.faceIdIconBtn}
                >
                  <MaterialCommunityIcons
                    name="face-recognition"
                    size={26}
                    color="#C0D0E5"
                  />
                </TouchableOpacity>
              </View>
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

  passwordWrapper: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  eyeButton: { position: "absolute", right: 12 },

  button: {
    backgroundColor: "#1E88E5",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 6,
  },

  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  errorText: { color: "#FFB3B3", marginBottom: 8, fontSize: 13 },

  faceIdBlock: { marginTop: 18, alignItems: "center" },
  faceIdText: {
    color: "#C0D0E5",
    fontSize: 13,
    marginBottom: 10,
    textAlign: "center",
  },
  faceIdIconBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#14395E",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1F4C78",
  },

  footer: { alignItems: "center", marginBottom: 10 },
  footerText: { fontSize: 12, color: "#9CAFC5" },
});

export default LoginScreen;
