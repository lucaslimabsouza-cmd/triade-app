// mobile-2.0/src/ui/TriadeLoading.tsx
import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing, ImageSourcePropType } from "react-native";

const MAIN_BLUE = "#0E2A47";

// ✅ Logo Triade (assets)
const logoTriade: ImageSourcePropType = require("../../assets/logo-triade-icon.png");

export default function TriadeLoading() {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    loop.start();
    return () => loop.stop();
  }, [rotateAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.container}>
      <Animated.Image
        source={logoTriade}
        style={[styles.logo, { transform: [{ rotate }] }]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MAIN_BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
  // ✅ Ajuste o tamanho aqui
  logo: {
    width: 120,
    height: 120,
  },
});
