import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { Publication } from "../types/models";
import { formatDate } from "../utils/validation";

interface SearchResultCardProps {
  publication: Publication;
  snippet?: string;
  onPress: (publication: Publication) => void;
}

export function SearchResultCard({
  publication,
  snippet,
  onPress,
}: SearchResultCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(publication)}
      accessibilityRole="button"
      accessibilityLabel={`Resultado: Edição ${publication.edition}`}
    >
      <View style={styles.header}>
        <Text style={styles.edition} numberOfLines={1}>
          {publication.title ?? `Edição ${publication.edition}`}
        </Text>
        <Text style={styles.date}>{formatDate(publication.publishedDate)}</Text>
      </View>

      {snippet ? (
        <Text style={styles.snippet} numberOfLines={3}>
          {snippet}
        </Text>
      ) : null}

      <View style={styles.footer}>
        {publication.pageCount != null && (
          <Text style={styles.metaText}>
            {publication.pageCount} página{publication.pageCount !== 1 ? "s" : ""}
          </Text>
        )}
        {publication.supplement && (
          <Text style={styles.supplementText}>Suplemento</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 14,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  edition: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a1a",
    flex: 1,
    marginRight: 8,
  },
  date: {
    fontSize: 13,
    color: "#666",
  },
  snippet: {
    fontSize: 13,
    color: "#444",
    lineHeight: 19,
    marginBottom: 8,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  metaText: {
    fontSize: 12,
    color: "#999",
  },
  supplementText: {
    fontSize: 12,
    color: "#E65100",
    fontWeight: "500",
  },
});
