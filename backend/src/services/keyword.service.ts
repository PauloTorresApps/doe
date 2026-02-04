import type { Keyword } from "@prisma/client";
import type { KeywordRepository } from "../repositories/keyword.repository.js";

const MAX_KEYWORDS_PER_USER = 5;
const MIN_EXPRESSION_LENGTH = 3;

export class KeywordServiceError extends Error {
  constructor(
    message: string,
    public readonly code: "LIMIT_EXCEEDED" | "TOO_SHORT" | "DUPLICATE" | "NOT_FOUND" | "FORBIDDEN",
  ) {
    super(message);
    this.name = "KeywordServiceError";
  }
}

export class KeywordService {
  constructor(private readonly keywordRepository: KeywordRepository) {}

  async listByUser(userId: string): Promise<Keyword[]> {
    return this.keywordRepository.findByUserId(userId);
  }

  async create(userId: string, expression: string): Promise<Keyword> {
    const trimmed = expression.trim();

    if (trimmed.length < MIN_EXPRESSION_LENGTH) {
      throw new KeywordServiceError(
        `Keyword must have at least ${MIN_EXPRESSION_LENGTH} characters`,
        "TOO_SHORT",
      );
    }

    const count = await this.keywordRepository.countByUserId(userId);
    if (count >= MAX_KEYWORDS_PER_USER) {
      throw new KeywordServiceError(
        `Maximum of ${MAX_KEYWORDS_PER_USER} keywords per user`,
        "LIMIT_EXCEEDED",
      );
    }

    try {
      return await this.keywordRepository.create(userId, trimmed);
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes("Unique constraint failed")
      ) {
        throw new KeywordServiceError(
          "This keyword already exists for your account",
          "DUPLICATE",
        );
      }
      throw err;
    }
  }

  async update(userId: string, keywordId: string, expression: string): Promise<Keyword> {
    const trimmed = expression.trim();

    if (trimmed.length < MIN_EXPRESSION_LENGTH) {
      throw new KeywordServiceError(
        `Keyword must have at least ${MIN_EXPRESSION_LENGTH} characters`,
        "TOO_SHORT",
      );
    }

    const keyword = await this.keywordRepository.findById(keywordId);

    if (!keyword) {
      throw new KeywordServiceError("Keyword not found", "NOT_FOUND");
    }

    if (keyword.userId !== userId) {
      throw new KeywordServiceError("You do not have permission to update this keyword", "FORBIDDEN");
    }

    try {
      return await this.keywordRepository.update(keywordId, trimmed);
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.includes("Unique constraint failed")
      ) {
        throw new KeywordServiceError(
          "This keyword already exists for your account",
          "DUPLICATE",
        );
      }
      throw err;
    }
  }

  async delete(userId: string, keywordId: string): Promise<void> {
    const keyword = await this.keywordRepository.findById(keywordId);

    if (!keyword) {
      throw new KeywordServiceError("Keyword not found", "NOT_FOUND");
    }

    if (keyword.userId !== userId) {
      throw new KeywordServiceError("You do not have permission to delete this keyword", "FORBIDDEN");
    }

    await this.keywordRepository.delete(keywordId);
  }
}
