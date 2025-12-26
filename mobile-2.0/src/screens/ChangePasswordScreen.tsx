import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { AuthStackParamList } from "../navigation/types";
import TriadeLoading from "../ui/TriadeLoading";
import { authService } from "../services/authService";

const MAIN_BLUE = "#0E2A47";
const logo = require("../../assets/logo-triade.png");

type Props = NativeStackScreenProps<AuthStackParamList, "ChangePassword"> & {
  onSignedIn: () => void;
};

export function ChangePasswordScreen({ onSignedIn }: Props) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  async function onSubmit() {
    setErrorMsg(null);

    if (!oldPassword || !newPassword) {
      setErrorMsg("Informe a senha atual e a nova senha.");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMsg("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    if (loading) return;

    try {
      setLoading(true);

      // ✅ Backend exige oldPassword + newPassword (você já viu o erro 401)
      const res = await authService.changePassword(oldPassword, newPassword);

      if (!res?.ok) {
        setErrorMsg(res?.error || "Não foi possível trocar a senha.");
        return;
      }

      // ✅ trocou senha: entra no app
      onSignedIn();
    } catch (e: any) {
      const msg =
        e?.response?.data?.error ||
        e?.message ||
        "Falha ao trocar senha.";
      setErrorMsg(msg);
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

            <Text style={styles.title}>Primeiro acesso</Text>
            <Text style={styles.subtitle}>
              Troque sua senha para continuar
            </Text>

            <View style={styles.form}>
              <Text style={styles.label}>Senha atual</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Digite sua senha atual"
                  placeholderTextColor="#8AA0B8"
                  secureTextEntry={!showOld}
                  value={oldPassword}
                  onChangeText={setOldPassword}
                />

                <TouchableOpacity
                  onPress={() => setShowOld(!showOld)}
                  style={styles.eyeButton}
                >
                  <MaterialCommunityIcons
                    name={showOld ? "eye" : "eye-off"}
                    size={24}
                    color="#C0D0E5"
                  />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Nova senha</Text>
              <View style={styles.passwordWrapper}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Mínimo 8 caracteres"
                  placeholderTextColor="#8AA0B8"
                  secureTextEntry={!showNew}
                  value={newPassword}
                  onChangeText={setNewPassword}
                />

                <TouchableOpacity
                  onPress={() => setShowNew(!showNew)}
                  style={styles.eyeButton}
                >
                  <MaterialCommunityIcons
                    name={showNew ? "eye" : "eye-off"}
                    size={24}
                    color="#C0D0E5"
                  />
                </TouchableOpacity>
              </View>

              {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

              <TouchableOpacity
                style={styles.button}
                onPress={onSubmit}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Salvar</Text>
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
    marginBottom: 8,
    marginTop: 10,
  },

  topBlock: { marginTop: -20 },

  title: {
    fontSize: 22,
    color: "#E0E7F0",
    textAlign: "center",
    fontWeight: "800",
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 14,
    color: "#C0D0E5",
    textAlign: "center",
    marginBottom: 26,
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

  footer: { alignItems: "center", marginBottom: 10 },
  footerText: { fontSize: 12, color: "#9CAFC5" },
});

export default ChangePasswordScreen;
