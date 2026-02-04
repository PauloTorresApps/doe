import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ScrapingService } from "../services/scraping.service.js";
import type { DoeApiItem } from "../services/scraping.service.js";

function makeDoeApiItem(overrides: Partial<DoeApiItem> = {}): DoeApiItem {
  return {
    id: 1234,
    edicao: "6991",
    data: "20/01/2025",
    data_iso8601: "2025-01-20",
    suplemento: false,
    paginas: 42,
    tamanho: "5.2 MB",
    downloads: 100,
    link: "https://diariooficial.to.gov.br/download/1234",
    imagem: "https://diariooficial.to.gov.br/images/1234.jpg",
    ...overrides,
  };
}

describe("ScrapingService", () => {
  let service: ScrapingService;

  beforeEach(() => {
    service = new ScrapingService({
      apiUrl: "https://mock-api.test/api.json",
      baseUrl: "https://mock-api.test",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchPublicationList", () => {
    it("should parse JSON array from API", async () => {
      const items = [makeDoeApiItem(), makeDoeApiItem({ id: 5678, edicao: "6992" })];

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(items), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await service.fetchPublicationList();
      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBe(1234);
      expect(result[1]!.edicao).toBe("6992");
    });

    it("should throw on non-OK response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Not Found", { status: 404, statusText: "Not Found" }),
      );

      await expect(service.fetchPublicationList()).rejects.toThrow("DOE API returned 404");
    });

    it("should throw when response is not an array", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ data: "not an array" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await expect(service.fetchPublicationList()).rejects.toThrow(
        "DOE API response is not an array",
      );
    });

    it("should include User-Agent header in request", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify([]), { status: 200 }),
      );

      await service.fetchPublicationList();

      const headers = fetchSpy.mock.calls[0]![1]?.headers as Record<string, string>;
      expect(headers["User-Agent"]).toMatch(/Mozilla\/5\.0/);
    });

    it("should throw on network timeout", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new DOMException("Aborted", "AbortError"));

      await expect(service.fetchPublicationList({ timeoutMs: 1 })).rejects.toThrow();
    });
  });

  describe("fetchPublicationPage", () => {
    it("should fetch HTML from publication page", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("<html><body>Test</body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
      );

      const html = await service.fetchPublicationPage(1234);
      expect(html).toContain("<html>");
    });

    it("should throw on non-OK page response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Server Error", { status: 500, statusText: "Internal Server Error" }),
      );

      await expect(service.fetchPublicationPage(1234)).rejects.toThrow(
        "DOE page 1234 returned 500",
      );
    });

    it("should use correct URL for publication page", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("<html></html>", { status: 200 }),
      );

      await service.fetchPublicationPage(1234);
      expect(fetchSpy.mock.calls[0]![0]).toBe("https://mock-api.test/diario/1234");
    });
  });

  describe("parsePublicationPage", () => {
    it("should extract title from h1.diario-titulo", () => {
      const html = `
        <html><body>
          <h1 class="diario-titulo">Edição 6991</h1>
          <div class="diario-conteudo">Publication content here</div>
        </body></html>
      `;

      const result = service.parsePublicationPage(html);
      expect(result.title).toBe("Edição 6991");
      expect(result.content).toBe("Publication content here");
    });

    it("should fall back to title tag", () => {
      const html = `
        <html><head><title>DOE - Edição 6991</title></head>
        <body><p>No h1 here</p></body></html>
      `;

      const result = service.parsePublicationPage(html);
      expect(result.title).toBe("DOE - Edição 6991");
    });

    it("should return null for missing title and content", () => {
      const html = "<html><body></body></html>";
      const result = service.parsePublicationPage(html);
      expect(result.title).toBeNull();
      expect(result.content).toBeNull();
    });

    it("should extract content from .diario-body", () => {
      const html = `
        <html><body>
          <div class="diario-body">Body content text</div>
        </body></html>
      `;

      const result = service.parsePublicationPage(html);
      expect(result.content).toBe("Body content text");
    });

    it("should extract content from article .content", () => {
      const html = `
        <html><body>
          <article><div class="content">Article content</div></article>
        </body></html>
      `;

      const result = service.parsePublicationPage(html);
      expect(result.content).toBe("Article content");
    });

    it("should handle malformed HTML gracefully", () => {
      const html = "<div><p>Unclosed tags <span>test";
      const result = service.parsePublicationPage(html);
      // Should not throw, returns nulls
      expect(result.title).toBeNull();
    });
  });

  describe("apiItemToPublicationData", () => {
    it("should map API item to publication data", () => {
      const item = makeDoeApiItem();
      const data = service.apiItemToPublicationData(item);

      expect(data.doeId).toBe(1234);
      expect(data.edition).toBe("6991");
      expect(data.publishedDate).toEqual(new Date("2025-01-20"));
      expect(data.pdfUrl).toBe("https://diariooficial.to.gov.br/download/1234");
      expect(data.thumbnailUrl).toBe("https://diariooficial.to.gov.br/images/1234.jpg");
      expect(data.pageCount).toBe(42);
      expect(data.supplement).toBe(false);
    });

    it("should map supplement flag correctly", () => {
      const item = makeDoeApiItem({ suplemento: true });
      const data = service.apiItemToPublicationData(item);
      expect(data.supplement).toBe(true);
    });

    it("should handle all required fields from API", () => {
      const item = makeDoeApiItem({
        id: 999,
        edicao: "7000",
        data_iso8601: "2025-03-15",
        paginas: 10,
      });
      const data = service.apiItemToPublicationData(item);

      expect(data.doeId).toBe(999);
      expect(data.edition).toBe("7000");
      expect(data.pageCount).toBe(10);
    });
  });
});
