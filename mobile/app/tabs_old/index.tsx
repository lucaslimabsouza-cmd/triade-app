// mobile/app/(tabs)/index.tsx
import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  Text,
  View,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import LogoutButton from "../../components/LogoutButton";
import Card from "../../components/Card";
import { COLORS } from "../../lib/theme";
import { createApi } from "../../lib/api";

export default function Home() {
  const { token, loading, user } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<any | null>(null);
  const [fetching, setFetching] = useState(false);

  // Redireciona para login caso não autenticado
  useEffect(() => {
    if (!loading && !token) {
      router.replace("/login");
    }
  }, [token, loading]);

  // Carrega resumo do investidor
  useEffect(() => {
    async function load() {
      if (!token || !user) return;
      setFetching(true);
      try {
        const api = createApi(token);
        const res = await api.get(`/investor/${user.id}/summary`);
        console.log("RES SUMMARY ->", res.data);
        setSummary(res.data);
      } catch (err: any) {
        console.warn("Erro ao buscar summary:", err?.message || err);
      } finally {
        setFetching(false);
      }
    }
    load();
  }, [token, user]);

  if (loading || !token) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.navy }}>
        <Text style={{ color: "#fff", padding: 20 }}>Carregando...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.navy }}>
      {/* Cabeçalho */}
      <View
        style={{
          padding: 16,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700" }}>
          Olá, {user?.name || "Investidor"}
        </Text>
        <LogoutButton />
      </View>

      {/* Conteúdo */}
      <View style={{ paddingHorizontal: 16 }}>
        {/* Total Investido */}
        {fetching ? (
          <Card>
            <ActivityIndicator />
          </Card>
        ) : (
          <Card style={{ backgroundColor: COLORS.blueMid }}>
            <Text style={{ color: "#fff" }}>Total Investido</Text>
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>
              {summary
                ? `R$ ${Number(summary.totalInvested).toLocaleString("pt-BR")}`
                : "—"}
            </Text>
          </Card>
        )}

        {/* Resumo financeiro */}
        <Card>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <View>
              <Text style={{ color: COLORS.text }}>Retorno Total</Text>
              <Text style={{ fontSize: 16, fontWeight: "700" }}>
                {summary
                  ? `R$ ${Number(summary.totalReturned).toLocaleString("pt-BR")}`
                  : "—"}
              </Text>
            </View>
            <View>
              <Text style={{ color: COLORS.text }}>Projetos</Text>
              <Text style={{ fontSize: 16, fontWeight: "700" }}>
                {summary ? String(summary.propertiesCount) : "—"}
              </Text>
            </View>
          </View>
        </Card>

        {/* Notificações */}
        <Text style={{ color: "#fff", marginTop: 12, marginBottom: 6 }}>
          Notificações
        </Text>
        <Card>
          <Text style={{ color: COLORS.text }}>
            {summary?.notifications?.[0] || "Nenhuma notificação recente"}
          </Text>
        </Card>

        {/* Botão → Propriedades */}
        <Card>
          <TouchableOpacity
            onPress={() => router.push("/properties")}
            style={{
              padding: 12,
              borderRadius: 10,
              backgroundColor: COLORS.blueLight || "#1B3358",
            }}
          >
            <Text
              style={{ textAlign: "center", color: "#fff", fontWeight: "700" }}
            >
              Ver todas as propriedades
            </Text>
          </TouchableOpacity>
        </Card>
      </View>
    </SafeAreaView>
  );
}
