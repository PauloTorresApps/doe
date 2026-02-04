import React, { useCallback, useEffect } from "react";
import { View, FlatList, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { usePublicationStore } from "../store/publicationStore";
import { useAuthStore } from "../store/authStore";
import { DiaryCard } from "../components/DiaryCard";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { ErrorMessage } from "../components/ErrorMessage";
import { EmptyState } from "../components/EmptyState";
import type { Publication } from "../types/models";
import type { RootStackParamList } from "../navigation/types";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function DiaryListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const token = useAuthStore((s) => s.token);
  const {
    publications,
    isLoading,
    isRefreshing,
    hasMore,
    error,
    load,
    loadMore,
    refresh,
    loadCached,
  } = usePublicationStore();

  useEffect(() => {
    loadCached();
    if (token) {
      load(token);
    }
  }, [token, load, loadCached]);

  const handleRefresh = useCallback(() => {
    if (token) {
      refresh(token);
    }
  }, [token, refresh]);

  const handleLoadMore = useCallback(() => {
    if (token && hasMore && !isLoading) {
      loadMore(token);
    }
  }, [token, hasMore, isLoading, loadMore]);

  const handlePress = useCallback(
    (publication: Publication) => {
      navigation.navigate("DiaryViewer", {
        publicationId: publication.id,
        pdfUrl: publication.pdfUrl,
        title: publication.title ?? `Edição ${publication.edition}`,
      });
    },
    [navigation],
  );

  if (isLoading && publications.length === 0 && !error) {
    return <LoadingIndicator message="Carregando diários..." />;
  }

  if (error && publications.length === 0) {
    return (
      <ErrorMessage
        message={error}
        onRetry={() => token && load(token)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={publications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <DiaryCard publication={item} onPress={handlePress} />
        )}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={
          publications.length === 0 ? styles.emptyContainer : styles.listContent
        }
        ListEmptyComponent={
          <EmptyState
            title="Nenhum diário disponível"
            message="Puxe para baixo para atualizar"
          />
        }
        ListFooterComponent={
          isLoading && publications.length > 0 ? (
            <LoadingIndicator size="small" />
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyContainer: {
    flexGrow: 1,
  },
});
