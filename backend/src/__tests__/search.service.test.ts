import { describe, it, expect, vi, beforeEach } from "vitest";
import { SearchService, SearchServiceError } from "../services/search.service.js";

function createMockPrisma() {
  return {
    $queryRawUnsafe: vi.fn(),
  };
}

describe("SearchService", () => {
  let service: SearchService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    service = new SearchService(mockPrisma as never);
  });

  describe("search validation", () => {
    it("should reject query shorter than 3 characters", async () => {
      await expect(service.search({ query: "ab" })).rejects.toThrow(
        SearchServiceError,
      );
      await expect(service.search({ query: "ab" })).rejects.toMatchObject({
        code: "QUERY_TOO_SHORT",
      });
      expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
    });

    it("should reject query that is only whitespace", async () => {
      await expect(service.search({ query: "   " })).rejects.toMatchObject({
        code: "QUERY_TOO_SHORT",
      });
    });

    it("should reject query with 2 chars after trimming", async () => {
      await expect(service.search({ query: "  ab  " })).rejects.toMatchObject({
        code: "QUERY_TOO_SHORT",
      });
    });

    it("should accept query with exactly 3 characters", async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([]);

      const result = await service.search({ query: "abc" });
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("should reject invalid date range where start > end", async () => {
      await expect(
        service.search({
          query: "test query",
          startDate: "2025-02-01",
          endDate: "2025-01-01",
        }),
      ).rejects.toThrow(SearchServiceError);
      await expect(
        service.search({
          query: "test query",
          startDate: "2025-02-01",
          endDate: "2025-01-01",
        }),
      ).rejects.toMatchObject({
        code: "INVALID_DATE_RANGE",
      });
    });

    it("should accept valid date range", async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([]);

      const result = await service.search({
        query: "test query",
        startDate: "2025-01-01",
        endDate: "2025-02-01",
      });
      expect(result.data).toEqual([]);
    });

    it("should accept search with only startDate", async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([]);

      await service.search({ query: "test query", startDate: "2025-01-01" });
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(2);
    });

    it("should accept search with only endDate", async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([]);

      await service.search({ query: "test query", endDate: "2025-02-01" });
      expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(2);
    });
  });

  describe("search results", () => {
    it("should return properly structured SearchResponse", async () => {
      const mockRow = {
        id: "pub-1",
        doeId: 1234,
        edition: "6991",
        publishedDate: new Date("2025-01-20"),
        pdfUrl: "https://example.com/pdf/1234",
        thumbnailUrl: null,
        pageCount: 42,
        title: "Edição 6991",
        content: "Aviso de Licitação",
        supplement: false,
        snippet: "...Aviso de <<Licitação>> - Pregão...",
      };

      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ total: 1 }])
        .mockResolvedValueOnce([mockRow]);

      const result = await service.search({ query: "licitação" });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.publication.id).toBe("pub-1");
      expect(result.data[0]!.publication.doeId).toBe(1234);
      expect(result.data[0]!.snippet).toBe("...Aviso de <<Licitação>> - Pregão...");
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it("should calculate hasMore correctly when more pages exist", async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ total: 50 }])
        .mockResolvedValueOnce([]);

      const result = await service.search({ query: "test query", page: 1, limit: 20 });

      expect(result.hasMore).toBe(true);
      expect(result.total).toBe(50);
    });

    it("should calculate hasMore as false on last page", async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ total: 20 }])
        .mockResolvedValueOnce([]);

      const result = await service.search({ query: "test query", page: 1, limit: 20 });

      expect(result.hasMore).toBe(false);
    });

    it("should use default pagination when not specified", async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([]);

      await service.search({ query: "test query" });

      // The data query should have LIMIT 20 OFFSET 0 (params at the end)
      const dataCallArgs = mockPrisma.$queryRawUnsafe.mock.calls[1]!;
      const limitParam = dataCallArgs[dataCallArgs.length - 2];
      const offsetParam = dataCallArgs[dataCallArgs.length - 1];
      expect(limitParam).toBe(20);
      expect(offsetParam).toBe(0);
    });

    it("should cap limit at 50", async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([]);

      await service.search({ query: "test query", limit: 100 });

      const dataCallArgs = mockPrisma.$queryRawUnsafe.mock.calls[1]!;
      const limitParam = dataCallArgs[dataCallArgs.length - 2];
      expect(limitParam).toBe(50);
    });

    it("should handle empty snippet gracefully", async () => {
      const mockRow = {
        id: "pub-1",
        doeId: 1234,
        edition: "6991",
        publishedDate: new Date("2025-01-20"),
        pdfUrl: "https://example.com/pdf/1234",
        thumbnailUrl: null,
        pageCount: null,
        title: "Test Title",
        content: null,
        supplement: false,
        snippet: "",
      };

      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ total: 1 }])
        .mockResolvedValueOnce([mockRow]);

      const result = await service.search({ query: "test" });
      expect(result.data[0]!.snippet).toBe("");
    });

    it("should return empty data when count is 0", async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([]);

      const result = await service.search({ query: "nonexistent" });
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe("query sanitization", () => {
    it("should sanitize special characters from query", async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([]);

      await service.search({ query: "test:query*with!special&chars" });

      // The first param to $queryRawUnsafe (after the SQL string) is the sanitized query
      const countCallArgs = mockPrisma.$queryRawUnsafe.mock.calls[0]!;
      const sanitizedQuery = countCallArgs[1];
      expect(sanitizedQuery).toBe("test query with special chars");
    });

    it("should handle quotes in search term", async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([]);

      await service.search({ query: 'test "quoted" term' });

      const countCallArgs = mockPrisma.$queryRawUnsafe.mock.calls[0]!;
      const sanitizedQuery = countCallArgs[1];
      expect(sanitizedQuery).not.toContain('"');
    });

    it("should handle parentheses and pipes", async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([]);

      await service.search({ query: "test (query) | other" });

      const countCallArgs = mockPrisma.$queryRawUnsafe.mock.calls[0]!;
      const sanitizedQuery = countCallArgs[1];
      expect(sanitizedQuery).not.toContain("(");
      expect(sanitizedQuery).not.toContain("|");
    });
  });

  describe("date filter parameters", () => {
    it("should pass date parameters to query", async () => {
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([{ total: 0 }])
        .mockResolvedValueOnce([]);

      await service.search({
        query: "test query",
        startDate: "2025-01-01",
        endDate: "2025-01-31",
      });

      // Both count and data queries should include date params
      const countCallArgs = mockPrisma.$queryRawUnsafe.mock.calls[0]!;
      // $1 = sanitized query, $2 = startDate, $3 = endDate
      expect(countCallArgs[2]).toEqual(new Date("2025-01-01"));
      expect(countCallArgs[3]).toEqual(new Date("2025-01-31"));
    });
  });
});
