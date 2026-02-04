import React from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import type { Publication } from "../types/models";
import { formatDate } from "../utils/validation";

interface DiaryCardProps {
  publication: Publication;
  onPress: (publication: Publication) => void;
}

export function DiaryCard({ publication, onPress }: DiaryCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(publication)}
      accessibilityRole="button"
      accessibilityLabel={`Edição ${publication.edition}, publicada em ${formatDate(publication.publishedDate)}`}
    >
      {publication.thumbnailUrl ? (
        <Image
          source={{ uri: publication.thumbnailUrl }}
          style={styles.thumbnail}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={styles.thumbnailPlaceholder}>
          <Text style={styles.thumbnailPlaceholderText}>DOE</Text>
        </View>
      )}

      <View style={styles.info}>
        <Text style={styles.edition} numberOfLines={1}>
          {publication.title ?? `Edição ${publication.edition}`}
        </Text>
        <Text style={styles.date}>{formatDate(publication.publishedDate)}</Text>

        <View style={styles.meta}>
          {publication.pageCount != null && (
            <Text style={styles.metaText}>
              {publication.pageCount} página{publication.pageCount !== 1 ? "s" : ""}
            </Text>
          )}
          {publication.supplement && (
            <View style={styles.supplementBadge}>
              <Text style={styles.supplementText}>Suplemento</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    padding: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  thumbnail: {
    width: 64,
    height: 88,
    borderRadius: 6,
    backgroundColor: "#e0e0e0",
  },
  thumbnailPlaceholder: {
    width: 64,
    height: 88,
    borderRadius: 6,
    backgroundColor: "#1a73e8",
    justifyContent: "center",
    alignItems: "center",
  },
  thumbnailPlaceholderText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  info: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  edition: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    fontSize: 12,
    color: "#999",
  },
  supplementBadge: {
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  supplementText: {
    fontSize: 11,
    color: "#E65100",
    fontWeight: "500",
  },
});
