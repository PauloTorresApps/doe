import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { useAuthStore } from "../store/authStore";

export function LoginScreen() {
  const { loginWithGoogle, loginWithApple, isLoading, error, clearError } =
    useAuthStore();

  React.useEffect(() => {
    if (error) {
      Alert.alert("Erro de autenticação", error, [
        { text: "OK", onPress: clearError },
      ]);
    }
  }, [error, clearError]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>DOE Tocantins</Text>
        <Text style={styles.subtitle}>
          Diário Oficial do Estado do Tocantins
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#1a73e8" />
        ) : (
          <>
            <TouchableOpacity
              style={[styles.button, styles.googleButton]}
              onPress={loginWithGoogle}
              disabled={isLoading}
            >
              <Text style={styles.googleButtonText}>Entrar com Google</Text>
            </TouchableOpacity>

            {Platform.OS === "ios" && (
              <TouchableOpacity
                style={[styles.button, styles.appleButton]}
                onPress={loginWithApple}
                disabled={isLoading}
              >
                <Text style={styles.appleButtonText}>Entrar com Apple</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 64,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  buttonContainer: {
    width: "100%",
    maxWidth: 320,
    gap: 16,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
  },
  googleButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  googleButtonText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "600",
  },
  appleButton: {
    backgroundColor: "#000",
  },
  appleButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
