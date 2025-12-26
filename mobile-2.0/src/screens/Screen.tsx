import React from "react";
import { ScrollView, StyleSheet, ViewStyle, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppHeader from "../components/AppHeader";

const MAIN_BLUE = "#0E2A47";

type Props = {
  title: string;
  onLogout?: () => Promise<void>;
  children: React.ReactNode;

  padding?: number;
  contentTopOffset?: number;
  contentStyle?: ViewStyle;
  scroll?: boolean;
};

export function Screen({
  title,
  onLogout,
  children,
  padding = 16,
  contentTopOffset = 0, // ✅ aqui: antes estava alto demais
  contentStyle,
  scroll = true,
}: Props) {
  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <AppHeader title={title} onLogout={onLogout} />

      {scroll ? (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { padding, paddingTop: contentTopOffset },
            contentStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          scrollIndicatorInsets={{ top: 0, bottom: 24 }}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { padding, paddingTop: contentTopOffset }, contentStyle]}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

export default Screen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: MAIN_BLUE },
  content: { paddingBottom: 48 },
});
