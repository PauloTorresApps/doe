import React from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";

interface LoadingIndicatorProps {
  message?: string;
  size?: "small" | "large";
}

export function LoadingIndicator({
  message,
  size = "large",
}: LoadingIndicatorProps) {
  return (
    <View style={styles.container} accessibilityRole="progressbar">
      <ActivityIndicator size={size} color="#1a73e8" />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  message: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
});
