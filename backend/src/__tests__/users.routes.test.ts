import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import userRoutes from "../routes/users.js";
import type { JwtPayload } from "../middleware/auth.middleware.js";

const DATABASE_URL =
  "postgresql://doe_user:doe_password@localhost:5433/doe_tocantins?schema=public";

function buildTestApp(prisma: PrismaClient): FastifyInstance {
  const app = Fastify({ logger: false });
  app.register(jwt, { secret: "test-jwt-secret" });
  app.decorate("prisma", prisma);
  app.register(userRoutes);
  return app;
}

describe("User Routes", () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  let testUserId: string;
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
    await prisma.user.deleteMany();

    const user = await prisma.user.create({
      data: {
        email: "fcmtest@example.com",
        name: "FCM Test User",
        provider: "google",
        providerId: "fcm-test-provider-1",
      },
    });
    testUserId = user.id;
    testToken = app.jwt.sign({
      id: user.id,
      email: user.email,
      provider: user.provider,
    } satisfies JwtPayload);
  });

  describe("PUT /users/fcm-token", () => {
    it("should update FCM token and return success", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/users/fcm-token",
        headers: { authorization: `Bearer ${testToken}` },
        payload: { fcm_token: "new-fcm-token-abc123" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ success: true });

      const user = await prisma.user.findUnique({ where: { id: testUserId } });
      expect(user!.fcmToken).toBe("new-fcm-token-abc123");
    });

    it("should overwrite existing FCM token", async () => {
      await prisma.user.update({
        where: { id: testUserId },
        data: { fcmToken: "old-token" },
      });

      const response = await app.inject({
        method: "PUT",
        url: "/users/fcm-token",
        headers: { authorization: `Bearer ${testToken}` },
        payload: { fcm_token: "new-token-xyz" },
      });

      expect(response.statusCode).toBe(200);

      const user = await prisma.user.findUnique({ where: { id: testUserId } });
      expect(user!.fcmToken).toBe("new-token-xyz");
    });

    it("should return 400 for empty FCM token", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/users/fcm-token",
        headers: { authorization: `Bearer ${testToken}` },
        payload: { fcm_token: "" },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 400 for missing fcm_token field", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/users/fcm-token",
        headers: { authorization: `Bearer ${testToken}` },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 401 without authentication", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/users/fcm-token",
        payload: { fcm_token: "some-token" },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 404 for deleted user with valid token", async () => {
      await prisma.user.delete({ where: { id: testUserId } });

      const response = await app.inject({
        method: "PUT",
        url: "/users/fcm-token",
        headers: { authorization: `Bearer ${testToken}` },
        payload: { fcm_token: "some-token" },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
