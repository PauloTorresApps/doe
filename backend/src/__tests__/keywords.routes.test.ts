import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import keywordRoutes from "../routes/keywords.js";
import type { JwtPayload } from "../middleware/auth.middleware.js";

const DATABASE_URL = "postgresql://doe_user:doe_password@localhost:5433/doe_tocantins?schema=public";

function buildTestApp(prisma: PrismaClient): FastifyInstance {
  const app = Fastify({ logger: false });
  app.register(jwt, { secret: "test-jwt-secret" });
  app.decorate("prisma", prisma);
  app.register(keywordRoutes);
  return app;
}

describe("Keyword Routes", () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  let testUserId: string;
  let testToken: string;
  let otherUserId: string;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
    await prisma.$connect();
    app = buildTestApp(prisma);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.keyword.deleteMany();
    await prisma.user.deleteMany();

    const user = await prisma.user.create({
      data: {
        email: "kwtest@example.com",
        name: "KW Test User",
        provider: "google",
        providerId: "kw-test-provider-1",
      },
    });
    testUserId = user.id;
    testToken = app.jwt.sign({
      id: user.id,
      email: user.email,
      provider: user.provider,
    } satisfies JwtPayload);

    const other = await prisma.user.create({
      data: {
        email: "other@example.com",
        name: "Other User",
        provider: "google",
        providerId: "kw-test-provider-2",
      },
    });
    otherUserId = other.id;
  });

  describe("GET /keywords", () => {
    it("should return empty list when user has no keywords", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/keywords",
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().keywords).toEqual([]);
    });

    it("should return user's keywords", async () => {
      await prisma.keyword.createMany({
        data: [
          { userId: testUserId, expression: "keyword one" },
          { userId: testUserId, expression: "keyword two" },
        ],
      });

      const response = await app.inject({
        method: "GET",
        url: "/keywords",
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(response.statusCode).toBe(200);
      const { keywords } = response.json();
      expect(keywords).toHaveLength(2);
    });

    it("should not return other user's keywords", async () => {
      await prisma.keyword.create({
        data: { userId: otherUserId, expression: "other keyword" },
      });

      const response = await app.inject({
        method: "GET",
        url: "/keywords",
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().keywords).toHaveLength(0);
    });

    it("should return 401 without authentication token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/keywords",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("POST /keywords", () => {
    it("should create keyword and return 201", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/keywords",
        headers: { authorization: `Bearer ${testToken}` },
        payload: { expression: "new keyword" },
      });

      expect(response.statusCode).toBe(201);
      const { keyword } = response.json();
      expect(keyword.expression).toBe("new keyword");
      expect(keyword.id).toBeDefined();
    });

    it("should return 400 for keyword with less than 3 characters", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/keywords",
        headers: { authorization: `Bearer ${testToken}` },
        payload: { expression: "ab" },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toContain("3 characters");
    });

    it("should return 400 when limit of 5 keywords exceeded", async () => {
      for (let i = 0; i < 5; i++) {
        await prisma.keyword.create({
          data: { userId: testUserId, expression: `keyword ${i + 1}` },
        });
      }

      const response = await app.inject({
        method: "POST",
        url: "/keywords",
        headers: { authorization: `Bearer ${testToken}` },
        payload: { expression: "sixth keyword" },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toContain("Maximum");
    });

    it("should return 400 for duplicate keyword", async () => {
      await prisma.keyword.create({
        data: { userId: testUserId, expression: "duplicate" },
      });

      const response = await app.inject({
        method: "POST",
        url: "/keywords",
        headers: { authorization: `Bearer ${testToken}` },
        payload: { expression: "duplicate" },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toContain("already exists");
    });

    it("should return 400 for missing expression", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/keywords",
        headers: { authorization: `Bearer ${testToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 401 without authentication token", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/keywords",
        payload: { expression: "test keyword" },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("PUT /keywords/:id", () => {
    it("should update keyword successfully", async () => {
      const kw = await prisma.keyword.create({
        data: { userId: testUserId, expression: "original" },
      });

      const response = await app.inject({
        method: "PUT",
        url: `/keywords/${kw.id}`,
        headers: { authorization: `Bearer ${testToken}` },
        payload: { expression: "updated value" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().keyword.expression).toBe("updated value");
    });

    it("should return 404 for non-existent keyword ID", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/keywords/00000000-0000-0000-0000-000000000000",
        headers: { authorization: `Bearer ${testToken}` },
        payload: { expression: "updated" },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return 403 when updating another user's keyword", async () => {
      const kw = await prisma.keyword.create({
        data: { userId: otherUserId, expression: "other's keyword" },
      });

      const response = await app.inject({
        method: "PUT",
        url: `/keywords/${kw.id}`,
        headers: { authorization: `Bearer ${testToken}` },
        payload: { expression: "hacked" },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 400 for keyword with less than 3 characters", async () => {
      const kw = await prisma.keyword.create({
        data: { userId: testUserId, expression: "original" },
      });

      const response = await app.inject({
        method: "PUT",
        url: `/keywords/${kw.id}`,
        headers: { authorization: `Bearer ${testToken}` },
        payload: { expression: "ab" },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 for invalid UUID param", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/keywords/not-a-uuid",
        headers: { authorization: `Bearer ${testToken}` },
        payload: { expression: "updated" },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 401 without authentication token", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/keywords/00000000-0000-0000-0000-000000000000",
        payload: { expression: "updated" },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("DELETE /keywords/:id", () => {
    it("should delete keyword and return 204", async () => {
      const kw = await prisma.keyword.create({
        data: { userId: testUserId, expression: "to delete" },
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/keywords/${kw.id}`,
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(response.statusCode).toBe(204);

      const deleted = await prisma.keyword.findUnique({ where: { id: kw.id } });
      expect(deleted).toBeNull();
    });

    it("should return 404 for non-existent keyword ID", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/keywords/00000000-0000-0000-0000-000000000000",
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should return 403 when deleting another user's keyword", async () => {
      const kw = await prisma.keyword.create({
        data: { userId: otherUserId, expression: "other's keyword" },
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/keywords/${kw.id}`,
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 401 without authentication token", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: "/keywords/00000000-0000-0000-0000-000000000000",
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe("Cascade Delete", () => {
    it("should delete keywords when user is deleted", async () => {
      await prisma.keyword.create({
        data: { userId: testUserId, expression: "cascade test" },
      });

      await prisma.user.delete({ where: { id: testUserId } });

      const keywords = await prisma.keyword.findMany({
        where: { userId: testUserId },
      });
      expect(keywords).toHaveLength(0);
    });
  });
});
