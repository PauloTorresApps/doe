import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { UserRepository } from "../repositories/user.repository.js";

const DATABASE_URL = "postgresql://doe_user:doe_password@localhost:5433/doe_tocantins?schema=public";

describe("UserRepository", () => {
  let prisma: PrismaClient;
  let userRepo: UserRepository;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
    await prisma.$connect();
    userRepo = new UserRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.keyword.deleteMany();
    await prisma.user.deleteMany();
  });

  describe("createOrUpdate", () => {
    it("should create a new user", async () => {
      const user = await userRepo.createOrUpdate({
        email: "test@example.com",
        name: "Test User",
        provider: "google",
        providerId: "google-123",
        avatarUrl: "https://example.com/photo.jpg",
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe("test@example.com");
      expect(user.name).toBe("Test User");
      expect(user.provider).toBe("google");
      expect(user.providerId).toBe("google-123");
      expect(user.avatarUrl).toBe("https://example.com/photo.jpg");
    });

    it("should update an existing user on repeat login", async () => {
      await userRepo.createOrUpdate({
        email: "test@example.com",
        name: "Test User",
        provider: "google",
        providerId: "google-123",
      });

      const updatedUser = await userRepo.createOrUpdate({
        email: "newemail@example.com",
        name: "Updated Name",
        provider: "google",
        providerId: "google-123",
        avatarUrl: "https://example.com/new-photo.jpg",
      });

      expect(updatedUser.email).toBe("newemail@example.com");
      expect(updatedUser.name).toBe("Updated Name");
      expect(updatedUser.avatarUrl).toBe("https://example.com/new-photo.jpg");

      const count = await prisma.user.count();
      expect(count).toBe(1);
    });

    it("should enforce provider + providerId uniqueness", async () => {
      await userRepo.createOrUpdate({
        email: "user1@example.com",
        name: "User 1",
        provider: "google",
        providerId: "unique-id-1",
      });

      const user2 = await userRepo.createOrUpdate({
        email: "user2@example.com",
        name: "User 2",
        provider: "apple",
        providerId: "unique-id-1",
      });

      expect(user2.provider).toBe("apple");

      const count = await prisma.user.count();
      expect(count).toBe(2);
    });
  });

  describe("findByProvider", () => {
    it("should find user by provider and providerId", async () => {
      const created = await userRepo.createOrUpdate({
        email: "find@example.com",
        name: "Find Me",
        provider: "google",
        providerId: "findable-123",
      });

      const found = await userRepo.findByProvider("google", "findable-123");
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it("should return null for non-existent provider", async () => {
      const found = await userRepo.findByProvider("google", "nonexistent");
      expect(found).toBeNull();
    });
  });

  describe("findById", () => {
    it("should find user by id", async () => {
      const created = await userRepo.createOrUpdate({
        email: "byid@example.com",
        name: "By Id",
        provider: "apple",
        providerId: "apple-byid",
      });

      const found = await userRepo.findById(created.id);
      expect(found).not.toBeNull();
      expect(found!.email).toBe("byid@example.com");
    });

    it("should return null for non-existent id", async () => {
      const found = await userRepo.findById("00000000-0000-0000-0000-000000000000");
      expect(found).toBeNull();
    });
  });

  describe("findByEmail", () => {
    it("should find user by email", async () => {
      await userRepo.createOrUpdate({
        email: "findme@example.com",
        name: "Email User",
        provider: "google",
        providerId: "email-provider-id",
      });

      const found = await userRepo.findByEmail("findme@example.com");
      expect(found).not.toBeNull();
      expect(found!.name).toBe("Email User");
    });
  });

  describe("updateFcmToken", () => {
    it("should update FCM token for a user", async () => {
      const user = await userRepo.createOrUpdate({
        email: "fcm@example.com",
        name: "FCM User",
        provider: "google",
        providerId: "fcm-provider-id",
      });

      const updated = await userRepo.updateFcmToken(user.id, "new-fcm-token-123");
      expect(updated.fcmToken).toBe("new-fcm-token-123");
    });
  });
});
