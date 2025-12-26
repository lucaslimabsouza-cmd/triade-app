import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";

const MAIN_BLUE = "#0E2A47";

export function TriadeLoading() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FFFFFF" />
    </View>
  );
}

// ✅ também exporta default
export default TriadeLoading;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MAIN_BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
});
