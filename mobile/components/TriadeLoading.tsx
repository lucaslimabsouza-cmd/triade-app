import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";

const MAIN_BLUE = "#0E2A47";

export default function TriadeLoading() {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.container}>
      <Animated.Image
        source={require("../assets/images/splash-icon.png")}
        style={[styles.logo, { transform: [{ rotate: spin }] }]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: MAIN_BLUE,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 160,
    height: 160,
  },
});
