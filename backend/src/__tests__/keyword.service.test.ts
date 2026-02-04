import { describe, it, expect, vi, beforeEach } from "vitest";
import { KeywordService, KeywordServiceError } from "../services/keyword.service.js";
import type { KeywordRepository } from "../repositories/keyword.repository.js";
import type { Keyword } from "@prisma/client";

function makeKeyword(overrides: Partial<Keyword> = {}): Keyword {
  return {
    id: "kw-1",
    expression: "test keyword",
    userId: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockRepository(): {
  [K in keyof KeywordRepository]: ReturnType<typeof vi.fn>;
} {
  return {
    findByUserId: vi.fn(),
    findById: vi.fn(),
    countByUserId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

describe("KeywordService", () => {
  let service: KeywordService;
  let repo: ReturnType<typeof createMockRepository>;

  beforeEach(() => {
    repo = createMockRepository();
    service = new KeywordService(repo as unknown as KeywordRepository);
  });

  describe("listByUser", () => {
    it("should return keywords for a user", async () => {
      const keywords = [makeKeyword(), makeKeyword({ id: "kw-2", expression: "another" })];
      repo.findByUserId.mockResolvedValue(keywords);

      const result = await service.listByUser("user-1");

      expect(result).toEqual(keywords);
      expect(repo.findByUserId).toHaveBeenCalledWith("user-1");
    });
  });

  describe("create", () => {
    it("should create a keyword with valid input", async () => {
      const keyword = makeKeyword();
      repo.countByUserId.mockResolvedValue(0);
      repo.create.mockResolvedValue(keyword);

      const result = await service.create("user-1", "test keyword");

      expect(result).toEqual(keyword);
      expect(repo.create).toHaveBeenCalledWith("user-1", "test keyword");
    });

    it("should trim whitespace from expression", async () => {
      const keyword = makeKeyword({ expression: "trimmed" });
      repo.countByUserId.mockResolvedValue(0);
      repo.create.mockResolvedValue(keyword);

      await service.create("user-1", "  trimmed  ");

      expect(repo.create).toHaveBeenCalledWith("user-1", "trimmed");
    });

    it("should reject keyword with less than 3 characters", async () => {
      await expect(service.create("user-1", "ab")).rejects.toThrow(KeywordServiceError);
      await expect(service.create("user-1", "ab")).rejects.toMatchObject({
        code: "TOO_SHORT",
      });
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("should reject keyword when trimmed is less than 3 characters", async () => {
      await expect(service.create("user-1", "  ab  ")).rejects.toMatchObject({
        code: "TOO_SHORT",
      });
    });

    it("should reject when user has 5 keywords (limit exceeded)", async () => {
      repo.countByUserId.mockResolvedValue(5);

      await expect(service.create("user-1", "new keyword")).rejects.toThrow(KeywordServiceError);
      await expect(service.create("user-1", "new keyword")).rejects.toMatchObject({
        code: "LIMIT_EXCEEDED",
      });
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("should reject duplicate keyword for same user", async () => {
      repo.countByUserId.mockResolvedValue(1);
      repo.create.mockRejectedValue(new Error("Unique constraint failed on the fields: (`user_id`,`expression`)"));

      await expect(service.create("user-1", "duplicate")).rejects.toMatchObject({
        code: "DUPLICATE",
      });
    });

    it("should rethrow unexpected errors", async () => {
      repo.countByUserId.mockResolvedValue(0);
      repo.create.mockRejectedValue(new Error("Database connection lost"));

      await expect(service.create("user-1", "valid keyword")).rejects.toThrow(
        "Database connection lost",
      );
    });
  });

  describe("update", () => {
    it("should update an existing keyword", async () => {
      const existing = makeKeyword({ userId: "user-1" });
      const updated = makeKeyword({ expression: "updated keyword" });
      repo.findById.mockResolvedValue(existing);
      repo.update.mockResolvedValue(updated);

      const result = await service.update("user-1", "kw-1", "updated keyword");

      expect(result.expression).toBe("updated keyword");
      expect(repo.update).toHaveBeenCalledWith("kw-1", "updated keyword");
    });

    it("should reject update with less than 3 characters", async () => {
      await expect(service.update("user-1", "kw-1", "ab")).rejects.toMatchObject({
        code: "TOO_SHORT",
      });
      expect(repo.findById).not.toHaveBeenCalled();
    });

    it("should return NOT_FOUND for non-existent keyword", async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.update("user-1", "kw-missing", "valid update")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("should prevent update of keyword owned by different user", async () => {
      const otherUserKeyword = makeKeyword({ userId: "other-user" });
      repo.findById.mockResolvedValue(otherUserKeyword);

      await expect(service.update("user-1", "kw-1", "updated")).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("should reject duplicate when updating to existing expression", async () => {
      const existing = makeKeyword({ userId: "user-1" });
      repo.findById.mockResolvedValue(existing);
      repo.update.mockRejectedValue(new Error("Unique constraint failed"));

      await expect(service.update("user-1", "kw-1", "duplicate expr")).rejects.toMatchObject({
        code: "DUPLICATE",
      });
    });
  });

  describe("delete", () => {
    it("should delete an existing keyword", async () => {
      const existing = makeKeyword({ userId: "user-1" });
      repo.findById.mockResolvedValue(existing);
      repo.delete.mockResolvedValue(undefined);

      await service.delete("user-1", "kw-1");

      expect(repo.delete).toHaveBeenCalledWith("kw-1");
    });

    it("should return NOT_FOUND for non-existent keyword", async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.delete("user-1", "kw-missing")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it("should prevent delete of keyword owned by different user", async () => {
      const otherUserKeyword = makeKeyword({ userId: "other-user" });
      repo.findById.mockResolvedValue(otherUserKeyword);

      await expect(service.delete("user-1", "kw-1")).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });
});
