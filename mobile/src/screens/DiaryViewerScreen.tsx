import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Pdf from "react-native-pdf";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { ErrorMessage } from "../components/ErrorMessage";
import type { RootStackParamList } from "../navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "DiaryViewer">;

export function DiaryViewerScreen({ route }: Props) {
  const { pdfUrl, title } = route.params;

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleLoadComplete = useCallback((numberOfPages: number) => {
    setTotalPages(numberOfPages);
    setIsLoading(false);
  }, []);

  const handlePageChanged = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handleError = useCallback(() => {
    setError("Não foi possível carregar o PDF");
    setIsLoading(false);
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    setIsLoading(true);
  }, []);

  if (error) {
    return <ErrorMessage message={error} onRetry={handleRetry} />;
  }

  return (
    <View style={styles.container}>
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <LoadingIndicator message={`Carregando ${title}...`} />
        </View>
      )}

      <Pdf
        source={{ uri: pdfUrl }}
        onLoadComplete={handleLoadComplete}
        onPageChanged={handlePageChanged}
        onError={handleError}
        enablePaging
        horizontal
        style={styles.pdf}
        trustAllCerts={false}
      />

      {totalPages > 0 && (
        <View style={styles.pageIndicator} accessibilityRole="text">
          <Text style={styles.pageText}>
            {currentPage} / {totalPages}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  pdf: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    backgroundColor: "#1a1a1a",
  },
  pageIndicator: {
    position: "absolute",
    bottom: 32,
    alignSelf: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pageText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
});
