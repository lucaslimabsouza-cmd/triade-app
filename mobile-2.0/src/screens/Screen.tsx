import React from "react";
import {
  ScrollView,
  StyleSheet,
  ViewStyle,
  View,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AppHeader from "../components/AppHeader";
import { useRefreshRegistry } from "../refresh/RefreshRegistry";

const MAIN_BLUE = "#0E2A47";

type Props = {
  title: string;
  onLogout?: () => Promise<void>;
  children: React.ReactNode;

  padding?: number;
  contentTopOffset?: number;
  contentStyle?: ViewStyle;
  scroll?: boolean;

  // ✅ badge do AppHeader vem do Home (ou de qualquer tela)
  headerUnreadCount?: number;

  // ✅ (opcional) override manual — se quiser usar sem registry em algum caso
  refreshing?: boolean;
  onRefresh?: () => Promise<void> | void;
};

export function Screen({
  title,
  onLogout,
  children,
  padding = 16,
  contentTopOffset = 0,
  contentStyle,
  scroll = true,
  headerUnreadCount = 0,

  // override opcional
  refreshing: refreshingProp,
  onRefresh: onRefreshProp,
}: Props) {
  const { refreshing: registryRefreshing, refreshNow, hasRefresh } =
    useRefreshRegistry();

  // Se a tela passar onRefreshProp, usamos ela.
  // Se não passar, mas existir refresh registrado, usamos o registry.
  const canUseRefresh =
    scroll && (typeof onRefreshProp === "function" || hasRefresh);

  const refreshing = refreshingProp ?? registryRefreshing;
  const onRefresh = onRefreshProp ?? refreshNow;

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <AppHeader
        title={title}
        onLogout={onLogout}
        unreadCount={headerUnreadCount}
      />

      {scroll ? (
        <ScrollView
          // ✅ garante gesto de puxar mesmo com pouco conteúdo (principalmente iOS)
          alwaysBounceVertical
          bounces

          contentContainerStyle={[
            styles.content,
            {
              padding,
              paddingTop: contentTopOffset,
              flexGrow: 1, // ✅ importantíssimo para telas “curtas”
            },
            contentStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          scrollIndicatorInsets={{ top: 0, bottom: 24 }}
          refreshControl={
            canUseRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={MAIN_BLUE}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.content,
            { padding, paddingTop: contentTopOffset, flexGrow: 1 },
            contentStyle,
          ]}
        >
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
