import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useKeywordStore } from "../store/keywordStore";
import { useAuthStore } from "../store/authStore";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { ErrorMessage } from "../components/ErrorMessage";
import { EmptyState } from "../components/EmptyState";
import {
  validateKeyword,
  canAddKeyword,
  KEYWORD_MAX_COUNT,
} from "../utils/validation";
import type { Keyword } from "../types/models";

export function KeywordManagementScreen() {
  const token = useAuthStore((s) => s.token);
  const {
    keywords,
    isLoading,
    error,
    load,
    add,
    update,
    remove,
    clearError,
  } = useKeywordStore();

  const [inputValue, setInputValue] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      load(token);
    }
  }, [token, load]);

  const handleSubmit = useCallback(async () => {
    const trimmed = inputValue.trim();
    const validationMsg = validateKeyword(trimmed);
    if (validationMsg) {
      setValidationError(validationMsg);
      return;
    }

    if (!token) return;
    setValidationError(null);

    try {
      if (editingId) {
        await update(token, editingId, trimmed);
        setEditingId(null);
      } else {
        if (!canAddKeyword(keywords.length)) {
          setValidationError(`Limite de ${KEYWORD_MAX_COUNT} expressões atingido`);
          return;
        }
        await add(token, trimmed);
      }
      setInputValue("");
    } catch {
      // Error is handled by the store
    }
  }, [inputValue, token, editingId, keywords.length, add, update]);

  const handleEdit = useCallback((keyword: Keyword) => {
    setEditingId(keyword.id);
    setInputValue(keyword.expression);
    setValidationError(null);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setInputValue("");
    setValidationError(null);
  }, []);

  const handleDelete = useCallback(
    (keyword: Keyword) => {
      Alert.alert(
        "Remover expressão",
        `Deseja remover "${keyword.expression}"?`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Remover",
            style: "destructive",
            onPress: () => {
              if (token) {
                remove(token, keyword.id);
              }
            },
          },
        ],
      );
    },
    [token, remove],
  );

  const renderKeyword = useCallback(
    ({ item }: { item: Keyword }) => (
      <View style={styles.keywordItem}>
        <Text style={styles.keywordText}>{item.expression}</Text>
        <View style={styles.keywordActions}>
          <TouchableOpacity
            onPress={() => handleEdit(item)}
            accessibilityRole="button"
            accessibilityLabel={`Editar ${item.expression}`}
            style={styles.actionButton}
          >
            <Text style={styles.editText}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            accessibilityRole="button"
            accessibilityLabel={`Remover ${item.expression}`}
            style={styles.actionButton}
          >
            <Text style={styles.deleteText}>Remover</Text>
          </TouchableOpacity>
        </View>
      </View>
    ),
    [handleEdit, handleDelete],
  );

  if (isLoading && keywords.length === 0 && !error) {
    return <LoadingIndicator message="Carregando expressões..." />;
  }

  if (error && keywords.length === 0) {
    return (
      <ErrorMessage
        message={error}
        onRetry={() => {
          clearError();
          if (token) load(token);
        }}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.countText}>
          {keywords.length}/{KEYWORD_MAX_COUNT} expressões
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputValue}
          onChangeText={(text) => {
            setInputValue(text);
            setValidationError(null);
          }}
          placeholder="Nova expressão..."
          placeholderTextColor="#999"
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          accessibilityLabel="Campo de expressão"
        />
        <TouchableOpacity
          style={[
            styles.submitButton,
            isLoading && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={isLoading}
          accessibilityRole="button"
          accessibilityLabel={editingId ? "Salvar edição" : "Adicionar expressão"}
        >
          <Text style={styles.submitText}>
            {editingId ? "Salvar" : "Adicionar"}
          </Text>
        </TouchableOpacity>
        {editingId && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelEdit}
            accessibilityRole="button"
            accessibilityLabel="Cancelar edição"
          >
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        )}
      </View>

      {validationError && (
        <Text style={styles.validationError}>{validationError}</Text>
      )}
      {error && keywords.length > 0 && (
        <Text style={styles.validationError}>{error}</Text>
      )}

      <FlatList
        data={keywords}
        keyExtractor={(item) => item.id}
        renderItem={renderKeyword}
        contentContainerStyle={
          keywords.length === 0 ? styles.emptyContainer : styles.listContent
        }
        ListEmptyComponent={
          <EmptyState
            title="Nenhuma expressão cadastrada"
            message="Adicione expressões para receber notificações quando elas aparecerem no Diário Oficial"
          />
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  countText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  inputContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
    alignItems: "center",
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#ddd",
  },
  submitButton: {
    backgroundColor: "#1a73e8",
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 8,
    justifyContent: "center",
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  cancelButton: {
    paddingHorizontal: 12,
    height: 44,
    justifyContent: "center",
  },
  cancelText: {
    color: "#666",
    fontSize: 14,
  },
  validationError: {
    color: "#d32f2f",
    fontSize: 13,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  keywordItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 14,
    borderRadius: 10,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
  },
  keywordText: {
    fontSize: 15,
    color: "#1a1a1a",
    flex: 1,
  },
  keywordActions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    padding: 4,
  },
  editText: {
    color: "#1a73e8",
    fontSize: 14,
    fontWeight: "500",
  },
  deleteText: {
    color: "#d32f2f",
    fontSize: 14,
    fontWeight: "500",
  },
});
