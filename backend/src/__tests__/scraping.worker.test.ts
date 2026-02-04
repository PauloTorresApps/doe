import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { DoeApiItem } from "../services/scraping.service.js";

// Track the processor captured from Worker constructor
let capturedProcessor: ((...args: unknown[]) => unknown) | null = null;
const mockAdd = vi.fn().mockResolvedValue({});
const mockWorkerOn = vi.fn();

vi.mock("bullmq", () => {
  return {
    Worker: vi.fn().mockImplementation(
      (_name: string, processor: (...args: unknown[]) => unknown) => {
        capturedProcessor = processor;
        return {
          on: mockWorkerOn,
          close: vi.fn().mockResolvedValue(undefined),
        };
      },
    ),
    Queue: vi.fn().mockImplementation(() => ({
      add: mockAdd,
      close: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

import { createScrapingWorker } from "../workers/scraping.worker.js";
import type { ScrapingService } from "../services/scraping.service.js";
import type { PrismaClient } from "@prisma/client";

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

function makePublication(doeId: number) {
  return {
    id: `pub-${doeId}`,
    doeId,
    edition: "6991",
    publishedDate: new Date("2025-01-20"),
    pdfUrl: `https://example.com/${doeId}`,
    thumbnailUrl: null,
    pageCount: 42,
    title: null,
    content: null,
    supplement: false,
    processedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

type MockPrisma = {
  publication: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

describe("ScrapingWorker", () => {
  let mockScrapingService: {
    fetchPublicationList: ReturnType<typeof vi.fn>;
    apiItemToPublicationData: ReturnType<typeof vi.fn>;
  };
  let mockPrisma: MockPrisma;
  let mockJob: {
    id: string;
    data: { trigger: string };
    updateProgress: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    capturedProcessor = null;

    mockScrapingService = {
      fetchPublicationList: vi.fn(),
      apiItemToPublicationData: vi.fn().mockImplementation((item: DoeApiItem) => ({
        doeId: item.id,
        edition: item.edicao,
        publishedDate: new Date(item.data_iso8601),
        pdfUrl: item.link,
        thumbnailUrl: item.imagem,
        pageCount: item.paginas,
        supplement: item.suplemento,
      })),
    };

    mockPrisma = {
      publication: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };

    mockJob = {
      id: "job-1",
      data: { trigger: "manual" },
      updateProgress: vi.fn(),
    };
  });

  afterEach(() => {
    // Don't use restoreAllMocks here as it would destroy vi.mock implementations
  });

  function createWorkerAndGetProcessor() {
    createScrapingWorker({
      connection: { host: "localhost", port: 6380 },
      prisma: mockPrisma as unknown as PrismaClient,
      scrapingService: mockScrapingService as unknown as ScrapingService,
    });
    if (!capturedProcessor) throw new Error("Processor not captured");
    return capturedProcessor;
  }

  it("should create a worker instance with event handlers", () => {
    createWorkerAndGetProcessor();

    expect(mockWorkerOn).toHaveBeenCalledWith("completed", expect.any(Function));
    expect(mockWorkerOn).toHaveBeenCalledWith("failed", expect.any(Function));
    expect(mockWorkerOn).toHaveBeenCalledWith("error", expect.any(Function));
  });

  it("should process items and return correct counts for new publications", async () => {
    const items = [makeDoeApiItem({ id: 1 }), makeDoeApiItem({ id: 2 })];
    mockScrapingService.fetchPublicationList.mockResolvedValue(items);

    mockPrisma.publication.findUnique.mockResolvedValue(null);
    mockPrisma.publication.create.mockImplementation(
      (args: { data: { doeId: number } }) =>
        Promise.resolve(makePublication(args.data.doeId)),
    );

    const processor = createWorkerAndGetProcessor();
    const result = await processor(mockJob);

    expect(result).toEqual({
      newPublications: 2,
      updatedPublications: 0,
      totalProcessed: 2,
    });
  });

  it("should count updated publications separately from new ones", async () => {
    const items = [makeDoeApiItem({ id: 1 }), makeDoeApiItem({ id: 2 })];
    mockScrapingService.fetchPublicationList.mockResolvedValue(items);

    const existingPub = makePublication(1);
    mockPrisma.publication.findUnique
      .mockResolvedValueOnce(existingPub)
      .mockResolvedValueOnce(null);
    mockPrisma.publication.update.mockResolvedValue(existingPub);
    mockPrisma.publication.create.mockResolvedValue(makePublication(2));

    const processor = createWorkerAndGetProcessor();
    const result = await processor(mockJob);

    expect(result).toEqual({
      newPublications: 1,
      updatedPublications: 1,
      totalProcessed: 2,
    });
  });

  it("should enqueue notification job for new publications only", async () => {
    const items = [makeDoeApiItem({ id: 1 }), makeDoeApiItem({ id: 2 })];
    mockScrapingService.fetchPublicationList.mockResolvedValue(items);

    const existingPub = makePublication(1);
    mockPrisma.publication.findUnique
      .mockResolvedValueOnce(existingPub)
      .mockResolvedValueOnce(null);
    mockPrisma.publication.update.mockResolvedValue(existingPub);
    const newPub = makePublication(2);
    mockPrisma.publication.create.mockResolvedValue(newPub);

    const processor = createWorkerAndGetProcessor();
    await processor(mockJob);

    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockAdd).toHaveBeenCalledWith("match-keywords", {
      publicationId: newPub.id,
      doeId: newPub.doeId,
      edition: newPub.edition,
    });
  });

  it("should update job progress during processing", async () => {
    const items = [makeDoeApiItem({ id: 1 }), makeDoeApiItem({ id: 2 })];
    mockScrapingService.fetchPublicationList.mockResolvedValue(items);

    mockPrisma.publication.findUnique.mockResolvedValue(null);
    mockPrisma.publication.create.mockResolvedValue(makePublication(1));

    const processor = createWorkerAndGetProcessor();
    await processor(mockJob);

    expect(mockJob.updateProgress).toHaveBeenCalledTimes(2);
    expect(mockJob.updateProgress).toHaveBeenCalledWith(50);
    expect(mockJob.updateProgress).toHaveBeenCalledWith(100);
  });

  it("should handle empty publication list", async () => {
    mockScrapingService.fetchPublicationList.mockResolvedValue([]);

    const processor = createWorkerAndGetProcessor();
    const result = await processor(mockJob);

    expect(result).toEqual({
      newPublications: 0,
      updatedPublications: 0,
      totalProcessed: 0,
    });
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it("should propagate fetch errors", async () => {
    mockScrapingService.fetchPublicationList.mockRejectedValue(
      new Error("Network timeout"),
    );

    const processor = createWorkerAndGetProcessor();
    await expect(processor(mockJob)).rejects.toThrow("Network timeout");
  });

  it("should propagate database errors", async () => {
    const items = [makeDoeApiItem({ id: 1 })];
    mockScrapingService.fetchPublicationList.mockResolvedValue(items);

    mockPrisma.publication.findUnique.mockRejectedValue(
      new Error("Database connection lost"),
    );

    const processor = createWorkerAndGetProcessor();
    await expect(processor(mockJob)).rejects.toThrow("Database connection lost");
  });
});
