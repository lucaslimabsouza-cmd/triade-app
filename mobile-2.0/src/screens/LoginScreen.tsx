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
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { AuthStackParamList } from "../navigation/types";
import TriadeLoading from "../ui/TriadeLoading";

import { authService } from "../services/authService";
import { biometryService } from "../services/biometryService";
import { tokenStorage } from "../storage/tokenStorage";
import { lastLoginStorage } from "../storage/lastLoginStorage";
import { biometryStorage } from "../storage/biometryStorage";
import { quickAccessStorage } from "../storage/quickAccessStorage";

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

      // 🔐 token
      await tokenStorage.set(data.token);
      const savedToken = await tokenStorage.get();
      console.log("🔐 [LoginScreen] token saved?", !!savedToken);

      // ✅ salva nome + cpf p/ QuickAccess
      await quickAccessStorage.setUser(
        data.party?.name ?? "",
        data.party?.cpf_cnpj ?? rawCpf
      );

      if (data.must_change_password) {
        navigation.navigate("ChangePassword", { token: data.token });
        return;
      }

      // Se já habilitado, entra direto
      const enabledBefore = await biometryStorage.getEnabled();
      console.log("🔎 [LoginScreen] biometry enabled BEFORE prompt?", enabledBefore);

      if (enabledBefore) {
        console.log("🚀 [LoginScreen] calling onSignedIn()");
        onSignedIn();
        return;
      }

      // Só pergunta se o device suporta
      const canFaceId = await biometryService.canUseFaceId();
      console.log("🔎 [LoginScreen] canUseFaceId?", canFaceId);

      if (!canFaceId) {
        console.log("🚀 [LoginScreen] no faceid available -> onSignedIn()");
        onSignedIn();
        return;
      }

      Alert.alert(
        "Face ID",
        "Deseja ativar o Face ID para acessar mais rápido nas próximas vezes?",
        [
          {
            text: "Agora não",
            style: "cancel",
            onPress: () => {
              console.log("ℹ️ [LoginScreen] user skipped FaceID enable");
              onSignedIn();
            },
          },
          {
            text: "Ativar",
            onPress: async () => {
              try {
                console.log("🟦 [LoginScreen] enabling FaceID...");

                const ok = await biometryService.authenticate("Ativar Face ID");
                console.log("🟩 [LoginScreen] FaceID auth result:", ok);

                if (!ok) {
                  Alert.alert(
                    "Face ID",
                    "Não foi possível confirmar o Face ID agora (cancelado ou falhou). O Face ID não foi ativado."
                  );
                  return; // ❗não entra
                }

                await biometryStorage.setEnabled(true);
                const enabledNow = await biometryStorage.getEnabled();
                console.log("✅ [LoginScreen] biometry enabled AFTER save?", enabledNow);

                Alert.alert("Face ID", "Face ID ativado com sucesso.");
                onSignedIn();
              } catch (e: any) {
                console.log("❌ [LoginScreen] error enabling FaceID:", e?.message);
                Alert.alert("Face ID", "Falha ao ativar o Face ID.");
              }
            },
          },
        ]
      );
    } catch (e: any) {
      setErrorMsg("Erro ao conectar. Tente novamente.");
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
                onPress={() =>
                  Alert.alert(
                    "Esqueci minha senha",
                    "Para alterar a senha, procure o responsável."
                  )
                }
              >
                <Text style={styles.forgotPassword}>Esqueci minha senha</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.button}
                onPress={handleLoginWithPassword}
                disabled={loading}
                activeOpacity={0.85}
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

  passwordWrapper: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
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
    marginTop: 6,
  },

  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "600" },
  errorText: { color: "#FFB3B3", marginBottom: 8, fontSize: 13 },

  footer: { alignItems: "center", marginBottom: 10 },
  footerText: { fontSize: 12, color: "#9CAFC5" },
});

export default LoginScreen;
