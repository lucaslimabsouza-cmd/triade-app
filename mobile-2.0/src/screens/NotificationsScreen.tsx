import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Screen } from "./Screen";

export function NotificationsScreen() {
  return (
    <Screen title="Notificações" padding={16} contentTopOffset={6}>
      <View style={styles.wrap}>
        <Text style={styles.text}>Notificações (vamos construir agora)</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", marginTop: 20 },
  text: { color: "#FFFFFF", fontSize: 16 },
});
