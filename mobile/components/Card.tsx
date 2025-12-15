// mobile/components/Card.tsx
import React from "react";
import { View, StyleSheet } from "react-native";

type Props = {
  children: React.ReactNode;
  style?: any;
};

export default function Card({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    marginVertical: 8
  }
});
