import React, { useEffect, useState } from "react";
import { SafeAreaView, FlatList, Text, View, TouchableOpacity, ActivityIndicator } from "react-native";
import Card from "../../components/Card";
import { COLORS } from "../../lib/theme";
import { createApi } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useRouter } from "expo-router";

export default function Properties() {
  const { token } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      if (!token) return;
      setLoading(true);
      try {
        const api = createApi(token);
        const res = await api.get("/properties");
        setItems(res.data || []);
      } catch (err: any) {
        console.warn("Erro ao buscar properties:", err?.message || err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.navy }}>
      {loading ? (
        <View style={{ padding: 16 }}><ActivityIndicator /></View>
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 16 }}
          data={items}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => router.push(`/property/${item.id}`)}>
              <Card>
                <Text style={{ fontWeight: "700" }}>{item.name}</Text>
                <Text style={{ marginTop: 6 }}>{`R$ ${Number(item.invested).toLocaleString("pt-BR")}`}</Text>
                <Text style={{ marginTop: 6, color: item.status === "Vendido" ? "green" : "#123" }}>{item.status}</Text>
              </Card>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}
