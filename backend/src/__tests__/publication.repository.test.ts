import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PublicationRepository } from "../repositories/publication.repository.js";
import type { CreatePublicationData } from "../repositories/publication.repository.js";

const DATABASE_URL =
  "postgresql://doe_user:doe_password@localhost:5433/doe_tocantins?schema=public";

function makePubData(overrides: Partial<CreatePublicationData> = {}): CreatePublicationData {
  return {
    doeId: 1234,
    edition: "6991",
    publishedDate: new Date("2025-01-20"),
    pdfUrl: "https://diariooficial.to.gov.br/download/1234",
    thumbnailUrl: "https://diariooficial.to.gov.br/images/1234.jpg",
    pageCount: 42,
    supplement: false,
    ...overrides,
  };
}

describe("PublicationRepository", () => {
  let prisma: PrismaClient;
  let repo: PublicationRepository;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
    await prisma.$connect();
    repo = new PublicationRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.publication.deleteMany();
  });

  describe("upsert", () => {
    it("should create a new publication and return isNew=true", async () => {
      const { publication, isNew } = await repo.upsert(makePubData());

      expect(isNew).toBe(true);
      expect(publication.doeId).toBe(1234);
      expect(publication.edition).toBe("6991");
      expect(publication.pdfUrl).toBe("https://diariooficial.to.gov.br/download/1234");
      expect(publication.pageCount).toBe(42);
      expect(publication.supplement).toBe(false);
    });

    it("should update existing publication and return isNew=false", async () => {
      await repo.upsert(makePubData());

      const { publication, isNew } = await repo.upsert(
        makePubData({ title: "Updated Title", content: "Updated content" }),
      );

      expect(isNew).toBe(false);
      expect(publication.title).toBe("Updated Title");
      expect(publication.content).toBe("Updated content");
    });

    it("should not overwrite existing title/content with null", async () => {
      await repo.upsert(makePubData({ title: "Original Title", content: "Original content" }));

      const { publication } = await repo.upsert(makePubData({ title: null, content: null }));

      expect(publication.title).toBe("Original Title");
      expect(publication.content).toBe("Original content");
    });

    it("should handle duplicate doeId gracefully", async () => {
      const first = await repo.upsert(makePubData({ doeId: 100 }));
      const second = await repo.upsert(makePubData({ doeId: 100 }));

      expect(first.isNew).toBe(true);
      expect(second.isNew).toBe(false);
      expect(first.publication.id).toBe(second.publication.id);
    });

    it("should handle supplement publications", async () => {
      const { publication } = await repo.upsert(makePubData({ supplement: true }));
      expect(publication.supplement).toBe(true);
    });
  });

  describe("findByDoeId", () => {
    it("should find publication by DOE ID", async () => {
      await repo.upsert(makePubData({ doeId: 555 }));

      const found = await repo.findByDoeId(555);
      expect(found).not.toBeNull();
      expect(found!.doeId).toBe(555);
    });

    it("should return null for non-existent DOE ID", async () => {
      const found = await repo.findByDoeId(99999);
      expect(found).toBeNull();
    });
  });

  describe("findLatest", () => {
    it("should return publications ordered by date descending", async () => {
      await repo.upsert(makePubData({ doeId: 1, publishedDate: new Date("2025-01-15") }));
      await repo.upsert(makePubData({ doeId: 2, publishedDate: new Date("2025-01-20") }));
      await repo.upsert(makePubData({ doeId: 3, publishedDate: new Date("2025-01-10") }));

      const latest = await repo.findLatest(3);
      expect(latest).toHaveLength(3);
      expect(latest[0]!.doeId).toBe(2); // most recent
      expect(latest[2]!.doeId).toBe(3); // oldest
    });

    it("should respect limit parameter", async () => {
      await repo.upsert(makePubData({ doeId: 1 }));
      await repo.upsert(makePubData({ doeId: 2 }));
      await repo.upsert(makePubData({ doeId: 3 }));

      const latest = await repo.findLatest(2);
      expect(latest).toHaveLength(2);
    });
  });

  describe("markProcessed", () => {
    it("should set processedAt timestamp", async () => {
      const { publication } = await repo.upsert(makePubData());
      expect(publication.processedAt).toBeNull();

      const processed = await repo.markProcessed(publication.id);
      expect(processed.processedAt).toBeInstanceOf(Date);
    });
  });

  describe("findUnprocessed", () => {
    it("should return only publications without processedAt", async () => {
      const { publication: pub1 } = await repo.upsert(makePubData({ doeId: 1 }));
      await repo.upsert(makePubData({ doeId: 2 }));
      await repo.markProcessed(pub1.id);

      const unprocessed = await repo.findUnprocessed();
      expect(unprocessed).toHaveLength(1);
      expect(unprocessed[0]!.doeId).toBe(2);
    });

    it("should return empty array when all are processed", async () => {
      const { publication } = await repo.upsert(makePubData());
      await repo.markProcessed(publication.id);

      const unprocessed = await repo.findUnprocessed();
      expect(unprocessed).toHaveLength(0);
    });
  });
});
