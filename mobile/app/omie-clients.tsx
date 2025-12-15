// mobile/app/omie-clients.tsx
import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, FlatList, StyleSheet } from "react-native";
import { getOmieClients } from "../lib/omie";

export default function OmieClientsScreen() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const data = await getOmieClients();

        // ajuste conforme o formato que a OMIE devolver
        const lista = data.clientes_cadastro || data || [];
        setClients(lista);
      } catch (err) {
        console.log("Erro ao buscar clientes OMIE:", err);
        setError("Erro ao buscar clientes da OMIE");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text>Carregando clientes da OMIE...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Clientes OMIE</Text>
      <FlatList
        data={clients}
        keyExtractor={(item, index) =>
          String(item.codigo_cliente_omie || item.cnpj_cpf || index)
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.razao_social || "Sem nome"}</Text>
            <Text style={styles.cnpj}>{item.cnpj_cpf}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  container: {
    flex: 1,
    padding: 16,
    paddingTop: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
  },
  card: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
  },
  cnpj: {
    fontSize: 14,
    color: "#666",
  },
});
