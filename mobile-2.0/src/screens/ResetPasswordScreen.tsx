import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from "react-native";
import * as Linking from "expo-linking";
import { theme } from "../ui/theme";
import { api } from "../services/api";

function getTokenFromUrl(url?: string | null) {
  if (!url) return null;
  const parsed = Linking.parse(url);
  const token = (parsed.queryParams?.token as string) || null;
  return token;
}

export default function ResetPasswordScreen({ navigation, route }: any) {
  const [token, setToken] = useState<string | null>(route?.params?.token || null);
  const [pass1, setPass1] = useState("");
  const [pass2, setPass2] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // ✅ pega token do deep link quando o app abre via link
    (async () => {
      const url = await Linking.getInitialURL();
      const t = getTokenFromUrl(url);
      if (t) setToken(t);
    })();

    // ✅ pega token se o app já estava aberto
    const sub = Linking.addEventListener("url", (event) => {
      const t = getTokenFromUrl(event.url);
      if (t) setToken(t);
    });

    return () => sub.remove();
  }, []);

  async function onSave() {
    if (!token) return Alert.alert("Erro", "Token não encontrado. Solicite um novo link.");
    if (!pass1 || pass1.length < 8) return Alert.alert("Erro", "Senha deve ter pelo menos 8 caracteres.");
    if (pass1 !== pass2) return Alert.alert("Erro", "As senhas não conferem.");

    try {
      setLoading(true);
      await api.post("/auth/reset-password", { token, newPassword: pass1 });
      Alert.alert("Sucesso", "Senha alterada. Faça login novamente.");
      navigation.navigate("Login");
    } catch (e) {
      Alert.alert("Erro", "Token inválido/expirado. Solicite um novo link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Redefinir senha</Text>

      <Text style={styles.label}>Nova senha</Text>
      <TextInput
        value={pass1}
        onChangeText={setPass1}
        secureTextEntry
        placeholder="Mínimo 8 caracteres"
        placeholderTextColor="#A7B2C1"
        style={styles.input}
      />

      <Text style={styles.label}>Confirmar senha</Text>
      <TextInput
        value={pass2}
        onChangeText={setPass2}
        secureTextEntry
        placeholder="Repita a senha"
        placeholderTextColor="#A7B2C1"
        style={styles.input}
      />

      <TouchableOpacity style={styles.button} onPress={onSave} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Salvando..." : "Salvar senha"}</Text>
      </TouchableOpacity>

      {!token ? (
        <Text style={styles.warning}>
          Token não encontrado. Volte e solicite um novo link.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", backgroundColor: theme.colors.navy },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 24, color: "#fff" },
  label: { fontSize: 14, marginBottom: 8, color: "#fff" },
  input: {
    borderWidth: 1,
    borderColor: "#223E5C",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    color: "#fff",
  },
  button: { backgroundColor: "#0E2A47", padding: 14, borderRadius: 12, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "700" },
  warning: { marginTop: 12, color: "#ffb3b3", textAlign: "center" },
});
