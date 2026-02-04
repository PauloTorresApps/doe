import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSearchStore } from "../store/searchStore";
import { useAuthStore } from "../store/authStore";
import { SearchResultCard } from "../components/SearchResultCard";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { EmptyState } from "../components/EmptyState";
import { formatDate } from "../utils/validation";
import type { Publication } from "../types/models";
import type { RootStackParamList } from "../navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type TabFilter = "all" | "diary" | "supplement";

const MIN_SEARCH_LENGTH = 3;

export function SearchScreen() {
  const navigation = useNavigation<NavigationProp>();
  const token = useAuthStore((s) => s.token);
  const {
    results,
    query,
    startDate,
    endDate,
    isSearching,
    isLoadingMore,
    error,
    history,
    hasMore,
    total,
    setQuery,
    setStartDate,
    setEndDate,
    search,
    loadMore,
    loadHistory,
    clearHistory,
  } = useSearchStore();

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [activeTab, setActiveTab] = useState<TabFilter>("all");

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const filteredResults = useMemo(() => {
    if (activeTab === "all") return results;
    if (activeTab === "diary")
      return results.filter((r) => !r.publication.supplement);
    return results.filter((r) => r.publication.supplement);
  }, [results, activeTab]);

  const handleSearch = useCallback(() => {
    if (token && query.trim().length >= MIN_SEARCH_LENGTH) {
      setActiveTab("all");
      search(token);
    }
  }, [token, query, search]);

  const handleHistoryTap = useCallback(
    (term: string) => {
      setQuery(term);
      if (token) {
        useSearchStore.setState({ query: term });
        setActiveTab("all");
        search(token);
      }
    },
    [token, setQuery, search],
  );

  const handleResultPress = useCallback(
    (publication: Publication) => {
      navigation.navigate("DiaryViewer", {
        publicationId: publication.id,
        pdfUrl: publication.pdfUrl,
        title: publication.title ?? `Edição ${publication.edition}`,
      });
    },
    [navigation],
  );

  const handleLoadMore = useCallback(() => {
    if (hasMore && token) {
      loadMore(token);
    }
  }, [hasMore, token, loadMore]);

  const handleStartDateChange = useCallback(
    (_event: unknown, date?: Date) => {
      setShowStartPicker(false);
      if (date) {
        setStartDate(date.toISOString().split("T")[0]!);
      }
    },
    [setStartDate],
  );

  const handleEndDateChange = useCallback(
    (_event: unknown, date?: Date) => {
      setShowEndPicker(false);
      if (date) {
        setEndDate(date.toISOString().split("T")[0]!);
      }
    },
    [setEndDate],
  );

  const showHistorySection = results.length === 0 && !isSearching && !error;
  const isSearchDisabled =
    query.trim().length < MIN_SEARCH_LENGTH || isSearching;
  const showMinCharHint =
    query.trim().length > 0 && query.trim().length < MIN_SEARCH_LENGTH;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.searchSection}>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar no diário oficial..."
          placeholderTextColor="#999"
          returnKeyType="search"
          onSubmitEditing={handleSearch}
          accessibilityLabel="Campo de busca"
        />

        {showMinCharHint && (
          <Text style={styles.hintText}>
            Digite pelo menos {MIN_SEARCH_LENGTH} caracteres
          </Text>
        )}

        <View style={styles.dateFilters}>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowStartPicker(true)}
            accessibilityRole="button"
            accessibilityLabel="Selecionar data inicial"
          >
            <Text style={styles.dateButtonText}>
              {startDate ? formatDate(startDate) : "Data inicial"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowEndPicker(true)}
            accessibilityRole="button"
            accessibilityLabel="Selecionar data final"
          >
            <Text style={styles.dateButtonText}>
              {endDate ? formatDate(endDate) : "Data final"}
            </Text>
          </TouchableOpacity>

          {(startDate || endDate) && (
            <TouchableOpacity
              onPress={() => {
                setStartDate(null);
                setEndDate(null);
              }}
              accessibilityRole="button"
              accessibilityLabel="Limpar filtros de data"
            >
              <Text style={styles.clearDates}>Limpar</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.searchButton,
            isSearchDisabled && styles.searchButtonDisabled,
          ]}
          onPress={handleSearch}
          disabled={isSearchDisabled}
          accessibilityRole="button"
          accessibilityLabel="Buscar"
        >
          <Text style={styles.searchButtonText}>
            {isSearching ? "Buscando..." : "Buscar"}
          </Text>
        </TouchableOpacity>
      </View>

      {showStartPicker && (
        <DateTimePicker
          value={startDate ? new Date(startDate) : new Date()}
          mode="date"
          onChange={handleStartDateChange}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={endDate ? new Date(endDate) : new Date()}
          mode="date"
          onChange={handleEndDateChange}
        />
      )}

      {isSearching && <LoadingIndicator message="Buscando..." />}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!isSearching && results.length > 0 && (
        <>
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "all" && styles.tabActive]}
              onPress={() => setActiveTab("all")}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === "all" }}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "all" && styles.tabTextActive,
                ]}
              >
                Todos ({total})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "diary" && styles.tabActive]}
              onPress={() => setActiveTab("diary")}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === "diary" }}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "diary" && styles.tabTextActive,
                ]}
              >
                Diário
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === "supplement" && styles.tabActive,
              ]}
              onPress={() => setActiveTab("supplement")}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === "supplement" }}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "supplement" && styles.tabTextActive,
                ]}
              >
                Suplemento
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={filteredResults}
            keyExtractor={(item) => item.publication.id}
            renderItem={({ item }) => (
              <SearchResultCard
                publication={item.publication}
                snippet={item.snippet}
                onPress={handleResultPress}
              />
            )}
            contentContainerStyle={styles.resultsList}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              isLoadingMore ? (
                <ActivityIndicator
                  style={styles.loadingMore}
                  color="#1a73e8"
                />
              ) : null
            }
          />
        </>
      )}

      {!isSearching &&
        results.length === 0 &&
        query.trim().length >= MIN_SEARCH_LENGTH &&
        !error &&
        !showHistorySection && (
          <EmptyState
            title="Nenhum resultado encontrado"
            message="Tente outra busca ou altere os filtros de data"
          />
        )}

      {showHistorySection && history.length > 0 && (
        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>Buscas recentes</Text>
            <TouchableOpacity
              onPress={clearHistory}
              accessibilityRole="button"
              accessibilityLabel="Limpar histórico"
            >
              <Text style={styles.clearHistoryText}>Limpar</Text>
            </TouchableOpacity>
          </View>
          {history.map((term, index) => (
            <TouchableOpacity
              key={`${term}-${index}`}
              style={styles.historyItem}
              onPress={() => handleHistoryTap(term)}
              accessibilityRole="button"
              accessibilityLabel={`Buscar por ${term}`}
            >
              <Text style={styles.historyItemText}>{term}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {showHistorySection && history.length === 0 && !query.trim() && (
        <EmptyState
          title="Buscar publicações"
          message="Digite um termo para buscar nos diários oficiais"
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  searchSection: {
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  searchInput: {
    height: 44,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: "#1a1a1a",
    marginBottom: 10,
  },
  hintText: {
    fontSize: 12,
    color: "#999",
    marginBottom: 8,
    marginLeft: 4,
  },
  dateFilters: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
    alignItems: "center",
  },
  dateButton: {
    flex: 1,
    height: 38,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  dateButtonText: {
    fontSize: 13,
    color: "#666",
  },
  clearDates: {
    color: "#1a73e8",
    fontSize: 13,
    fontWeight: "500",
    paddingHorizontal: 4,
  },
  searchButton: {
    backgroundColor: "#1a73e8",
    height: 44,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  errorContainer: {
    padding: 16,
  },
  errorText: {
    color: "#d32f2f",
    fontSize: 14,
    textAlign: "center",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: "#1a73e8",
  },
  tabText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  tabTextActive: {
    color: "#1a73e8",
  },
  resultsList: {
    paddingVertical: 8,
  },
  loadingMore: {
    paddingVertical: 16,
  },
  historySection: {
    padding: 16,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  clearHistoryText: {
    fontSize: 13,
    color: "#1a73e8",
    fontWeight: "500",
  },
  historyItem: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  historyItemText: {
    fontSize: 14,
    color: "#444",
  },
});
