import { describe, it, expect, vi, beforeEach } from "vitest";

let capturedProcessor: ((...args: unknown[]) => unknown) | null = null;
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
  };
});

vi.mock("../services/notification.service.js", () => {
  return {
    NotificationService: vi.fn().mockImplementation(() => ({
      notifyMatchingUsers: vi.fn(),
    })),
  };
});

import { createNotificationWorker } from "../workers/notification.worker.js";
import { NotificationService } from "../services/notification.service.js";
import type { PrismaClient } from "@prisma/client";

describe("NotificationWorker", () => {
  let mockPrisma: unknown;
  let mockJob: {
    id: string;
    data: { publicationId: string; doeId: number; edition: string };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    capturedProcessor = null;

    mockPrisma = {};

    mockJob = {
      id: "notif-job-1",
      data: {
        publicationId: "pub-123",
        doeId: 1234,
        edition: "6991",
      },
    };
  });

  function createWorkerAndGetProcessor() {
    createNotificationWorker({
      connection: { host: "localhost", port: 6380 },
      prisma: mockPrisma as PrismaClient,
      messaging: null,
    });
    if (!capturedProcessor) throw new Error("Processor not captured");
    return capturedProcessor;
  }

  it("should create a worker with event handlers", () => {
    createWorkerAndGetProcessor();

    expect(mockWorkerOn).toHaveBeenCalledWith("completed", expect.any(Function));
    expect(mockWorkerOn).toHaveBeenCalledWith("failed", expect.any(Function));
    expect(mockWorkerOn).toHaveBeenCalledWith("error", expect.any(Function));
  });

  it("should call notifyMatchingUsers with correct parameters", async () => {
    // First call sets up mock but uses default implementation
    createWorkerAndGetProcessor();

    const mockNotify = vi.fn().mockResolvedValue({ sent: 2, failed: 0 });
    (NotificationService as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      notifyMatchingUsers: mockNotify,
    }));

    // Need to recreate the worker to get the new mock
    capturedProcessor = null;
    const processor = createWorkerAndGetProcessor();

    const result = await processor(mockJob);

    expect(mockNotify).toHaveBeenCalledWith("pub-123", "6991");
    expect(result).toEqual({ sent: 2, failed: 0 });
  });

  it("should propagate errors from notifyMatchingUsers", async () => {
    const mockNotify = vi.fn().mockRejectedValue(new Error("DB connection lost"));
    (NotificationService as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      notifyMatchingUsers: mockNotify,
    }));

    capturedProcessor = null;
    const processor = createWorkerAndGetProcessor();

    await expect(processor(mockJob)).rejects.toThrow("DB connection lost");
  });

  it("should return sent and failed counts", async () => {
    const mockNotify = vi.fn().mockResolvedValue({ sent: 3, failed: 1 });
    (NotificationService as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      notifyMatchingUsers: mockNotify,
    }));

    capturedProcessor = null;
    const processor = createWorkerAndGetProcessor();

    const result = await processor(mockJob);

    expect(result).toEqual({ sent: 3, failed: 1 });
  });
});
