import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import publicationRoutes from "../routes/publications.js";
import type { JwtPayload } from "../middleware/auth.middleware.js";

const DATABASE_URL = "postgresql://doe_user:doe_password@localhost:5433/doe_tocantins?schema=public";

function buildTestApp(prisma: PrismaClient): FastifyInstance {
  const app = Fastify({ logger: false });
  app.register(jwt, { secret: "test-jwt-secret" });
  app.decorate("prisma", prisma);
  app.register(publicationRoutes);
  return app;
}

describe("Publication Routes", () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  let testToken: string;

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
    await prisma.publication.deleteMany();
    await prisma.user.deleteMany();

    const user = await prisma.user.create({
      data: {
        email: "pubtest@example.com",
        name: "Pub Test User",
        provider: "google",
        providerId: "pub-test-provider-1",
      },
    });

    testToken = app.jwt.sign({
      id: user.id,
      email: user.email,
      provider: user.provider,
    } satisfies JwtPayload);
  });

  async function createPublication(overrides: Record<string, unknown> = {}) {
    const doeId = overrides.doeId ?? Math.floor(Math.random() * 100000);
    return prisma.publication.create({
      data: {
        doeId: doeId as number,
        edition: "6991",
        publishedDate: new Date("2025-01-20"),
        pdfUrl: `https://example.com/pdf/${doeId}`,
        title: "Edição 6991",
        content: "Aviso de Licitação - Pregão Eletrônico",
        supplement: false,
        ...overrides,
      },
    });
  }

  describe("GET /publications", () => {
    it("should return paginated publications", async () => {
      await createPublication({ doeId: 1001 });
      await createPublication({ doeId: 1002 });
      await createPublication({ doeId: 1003 });

      const res = await app.inject({
        method: "GET",
        url: "/publications?page=1&limit=2",
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toHaveLength(2);
      expect(body.hasMore).toBe(true);
      expect(body.total).toBe(3);
    });

    it("should return empty data when no publications", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/publications",
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toHaveLength(0);
      expect(body.hasMore).toBe(false);
      expect(body.total).toBe(0);
    });

    it("should use default pagination when not specified", async () => {
      await createPublication({ doeId: 2001 });

      const res = await app.inject({
        method: "GET",
        url: "/publications",
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toHaveLength(1);
    });

    it("should return 401 without auth token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/publications",
      });

      expect(res.statusCode).toBe(401);
    });

    it("should order by publishedDate descending", async () => {
      await createPublication({ doeId: 3001, publishedDate: new Date("2025-01-15") });
      await createPublication({ doeId: 3002, publishedDate: new Date("2025-01-20") });
      await createPublication({ doeId: 3003, publishedDate: new Date("2025-01-10") });

      const res = await app.inject({
        method: "GET",
        url: "/publications",
        headers: { authorization: `Bearer ${testToken}` },
      });

      const body = JSON.parse(res.body);
      const dates = body.data.map((p: { publishedDate: string }) => new Date(p.publishedDate).getTime());
      expect(dates[0]).toBeGreaterThan(dates[1]!);
      expect(dates[1]).toBeGreaterThan(dates[2]!);
    });
  });

  describe("GET /publications/search", () => {
    it("should find publications matching query in content", async () => {
      await createPublication({
        doeId: 4001,
        content: "Aviso de Licitação - Pregão Eletrônico nº 001/2025",
      });
      await createPublication({
        doeId: 4002,
        content: "Ata de reunião ordinária do conselho",
      });

      const res = await app.inject({
        method: "GET",
        url: "/publications/search?q=licitação",
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].publication.doeId).toBe(4001);
      expect(body.total).toBe(1);
      expect(body.hasMore).toBe(false);
    });

    it("should return snippets with search results", async () => {
      await createPublication({
        doeId: 4010,
        content: "Aviso de Licitação - Pregão Eletrônico nº 001/2025. Processo administrativo em andamento.",
      });

      const res = await app.inject({
        method: "GET",
        url: "/publications/search?q=licitação",
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].snippet).toBeDefined();
      expect(typeof body.data[0].snippet).toBe("string");
    });

    it("should find publications matching query in title", async () => {
      await createPublication({
        doeId: 5001,
        title: "Edição Suplementar - Licitação",
        content: "No matching content here",
      });

      const res = await app.inject({
        method: "GET",
        url: "/publications/search?q=suplementar",
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toHaveLength(1);
    });

    it("should be case-insensitive", async () => {
      await createPublication({
        doeId: 6001,
        content: "AVISO DE LICITAÇÃO PÚBLICA",
      });

      const res = await app.inject({
        method: "GET",
        url: "/publications/search?q=licitação",
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toHaveLength(1);
    });

    it("should filter by date range", async () => {
      await createPublication({ doeId: 7001, publishedDate: new Date("2025-01-10") });
      await createPublication({ doeId: 7002, publishedDate: new Date("2025-01-20") });
      await createPublication({ doeId: 7003, publishedDate: new Date("2025-01-30") });

      const res = await app.inject({
        method: "GET",
        url: "/publications/search?q=Licitação&startDate=2025-01-15&endDate=2025-01-25",
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].publication.doeId).toBe(7002);
    });

    it("should return 400 without query parameter", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/publications/search",
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(res.statusCode).toBe(400);
    });

    it("should return 400 for query with less than 3 characters", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/publications/search?q=ab",
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(res.statusCode).toBe(400);
    });

    it("should return empty data array when no matches", async () => {
      await createPublication({ doeId: 8001, content: "Ata de reunião ordinária" });

      const res = await app.inject({
        method: "GET",
        url: "/publications/search?q=inexistente",
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toHaveLength(0);
      expect(body.total).toBe(0);
      expect(body.hasMore).toBe(false);
    });

    it("should return 401 without auth token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/publications/search?q=test",
      });

      expect(res.statusCode).toBe(401);
    });

    it("should support pagination parameters", async () => {
      // Create 3 publications that all match
      await createPublication({ doeId: 9001, content: "Aviso de Licitação número um" });
      await createPublication({ doeId: 9002, content: "Aviso de Licitação número dois" });
      await createPublication({ doeId: 9003, content: "Aviso de Licitação número três" });

      const res = await app.inject({
        method: "GET",
        url: "/publications/search?q=licitação&page=1&limit=2",
        headers: { authorization: `Bearer ${testToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toHaveLength(2);
      expect(body.total).toBe(3);
      expect(body.hasMore).toBe(true);
    });

    it("should handle special characters in search query", async () => {
      await createPublication({ doeId: 10001, content: "Aviso de Licitação" });

      const res = await app.inject({
        method: "GET",
        url: "/publications/search?q=licitação:test*query",
        headers: { authorization: `Bearer ${testToken}` },
      });

      // Should not error - special chars are sanitized
      expect(res.statusCode).toBe(200);
    });
  });
});
