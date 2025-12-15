// mobile/app/(tabs)/property/[id].tsx
import React, { useEffect, useState } from "react";
import { SafeAreaView, Text, ActivityIndicator, ScrollView } from "react-native";
import Card from "../../../components/Card";        // components está em mobile/components
import { COLORS } from "../../../lib/theme";          // subir 2 níveis para mobile/app/lib
import { createApi } from "../../../lib/api";         // subir 2 níveis para mobile/app/lib
import { useAuth } from "../../../lib/auth";          // subir 2 níveis para mobile/app/lib
import { useLocalSearchParams } from "expo-router";

export default function PropertyDetail() {
  const { id } = useLocalSearchParams();
  const { token } = useAuth();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      if (!token || !id) return;
      setLoading(true);
      try {
        const api = createApi(token);
        const res = await api.get(`/properties/${id}`);
        setData(res.data);
      } catch (err: any) {
        console.warn("Erro detail:", err?.message || err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token, id]);

  if (loading || !data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.navy }}>
        <ActivityIndicator style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.navy }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ color: "#fff", fontSize: 22, fontWeight: "700" }}>{data.name}</Text>

        <Card>
          <Text style={{ fontWeight: "700" }}>Valor aportado</Text>
          <Text>{`R$ ${Number(data.invested).toLocaleString("pt-BR")}`}</Text>
        </Card>

        <Card>
          <Text style={{ fontWeight: "700" }}>Custos</Text>
          {data.costs?.map((c: any, i: number) => (
            <Text key={i}>{`- ${c.name}: R$ ${Number(c.value).toLocaleString("pt-BR")}`}</Text>
          ))}
        </Card>

        <Card>
          <Text style={{ fontWeight: "700" }}>Resumo</Text>
          <Text>Status: {data.status}</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
