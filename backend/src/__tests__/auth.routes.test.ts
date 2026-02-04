import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import type { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import authRoutes from "../routes/auth.js";
import type { JwtPayload } from "../middleware/auth.middleware.js";

const DATABASE_URL = "postgresql://doe_user:doe_password@localhost:5433/doe_tocantins?schema=public";

vi.mock("google-auth-library", () => {
  const verifyIdToken = vi.fn();
  return {
    OAuth2Client: vi.fn().mockImplementation(() => ({
      verifyIdToken,
    })),
    __verifyIdToken: verifyIdToken,
  };
});

vi.mock("jose", () => {
  const jwtVerify = vi.fn();
  return {
    jwtVerify,
    createRemoteJWKSet: vi.fn().mockReturnValue("mock-jwks"),
  };
});

import { OAuth2Client } from "google-auth-library";
import * as jose from "jose";

function buildTestApp(prisma: PrismaClient): FastifyInstance {
  const app = Fastify({ logger: false });

  app.register(jwt, { secret: "test-jwt-secret" });

  app.decorate("prisma", prisma);

  app.register(authRoutes);

  return app;
}

describe("Auth Routes", () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;

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
    vi.clearAllMocks();
    await prisma.keyword.deleteMany();
    await prisma.user.deleteMany();
  });

  describe("POST /auth/google", () => {
    it("should authenticate with valid Google token and return JWT", async () => {
      const mockClient = new OAuth2Client();
      (mockClient.verifyIdToken as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        getPayload: () => ({
          sub: "google-123",
          email: "googleuser@gmail.com",
          name: "Google User",
          picture: "https://lh3.googleusercontent.com/photo.jpg",
        }),
      });

      // Get the AuthService instance and replace client
      // We mock at the module level, so the OAuth2Client constructor returns our mock
      const response = await app.inject({
        method: "POST",
        url: "/auth/google",
        payload: { idToken: "valid-google-token" },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.token).toBeDefined();
      expect(body.user).toBeDefined();
      expect(body.user.email).toBe("googleuser@gmail.com");
      expect(body.user.provider).toBe("google");
    });

    it("should return 401 for invalid Google token", async () => {
      const mockClient = new OAuth2Client();
      (mockClient.verifyIdToken as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Invalid token"),
      );

      const response = await app.inject({
        method: "POST",
        url: "/auth/google",
        payload: { idToken: "invalid-google-token" },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("should return 400 for missing idToken", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/auth/google",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe("Bad Request");
    });

    it("should associate FCM token when provided", async () => {
      const mockClient = new OAuth2Client();
      (mockClient.verifyIdToken as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        getPayload: () => ({
          sub: "google-fcm-123",
          email: "fcm@gmail.com",
          name: "FCM User",
        }),
      });

      const response = await app.inject({
        method: "POST",
        url: "/auth/google",
        payload: { idToken: "valid-token", fcmToken: "device-fcm-token" },
      });

      expect(response.statusCode).toBe(200);

      const user = await prisma.user.findFirst({ where: { email: "fcm@gmail.com" } });
      expect(user?.fcmToken).toBe("device-fcm-token");
    });

    it("should update user profile on repeat login", async () => {
      const mockClient = new OAuth2Client();
      (mockClient.verifyIdToken as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          getPayload: () => ({
            sub: "google-repeat-123",
            email: "repeat@gmail.com",
            name: "First Login",
          }),
        })
        .mockResolvedValueOnce({
          getPayload: () => ({
            sub: "google-repeat-123",
            email: "repeat@gmail.com",
            name: "Second Login",
            picture: "https://example.com/updated.jpg",
          }),
        });

      await app.inject({
        method: "POST",
        url: "/auth/google",
        payload: { idToken: "first-token" },
      });

      const response = await app.inject({
        method: "POST",
        url: "/auth/google",
        payload: { idToken: "second-token" },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.user.name).toBe("Second Login");

      const userCount = await prisma.user.count();
      expect(userCount).toBe(1);
    });
  });

  describe("POST /auth/apple", () => {
    it("should authenticate with valid Apple token and return JWT", async () => {
      (jose.jwtVerify as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        payload: {
          sub: "apple-123",
          email: "appleuser@icloud.com",
        },
      });

      const response = await app.inject({
        method: "POST",
        url: "/auth/apple",
        payload: { identityToken: "valid-apple-token" },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.token).toBeDefined();
      expect(body.user.email).toBe("appleuser@icloud.com");
      expect(body.user.provider).toBe("apple");
    });

    it("should return 401 for invalid Apple token", async () => {
      (jose.jwtVerify as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("JWT expired"),
      );

      const response = await app.inject({
        method: "POST",
        url: "/auth/apple",
        payload: { identityToken: "expired-apple-token" },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("should return 400 for missing identityToken", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/auth/apple",
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it("should use fullName when provided", async () => {
      (jose.jwtVerify as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        payload: {
          sub: "apple-name-123",
          email: "named@icloud.com",
        },
      });

      const response = await app.inject({
        method: "POST",
        url: "/auth/apple",
        payload: {
          identityToken: "apple-token-with-name",
          fullName: "John Apple",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.user.name).toBe("John Apple");
    });
  });

  describe("GET /auth/me", () => {
    it("should return user profile for authenticated request", async () => {
      const user = await prisma.user.create({
        data: {
          email: "me@example.com",
          name: "Me User",
          provider: "google",
          providerId: "me-provider-id",
        },
      });

      const token = app.jwt.sign({
        id: user.id,
        email: user.email,
        provider: user.provider,
      } satisfies JwtPayload);

      const response = await app.inject({
        method: "GET",
        url: "/auth/me",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.user.email).toBe("me@example.com");
      expect(body.user.name).toBe("Me User");
    });

    it("should reject request without token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/auth/me",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should reject request with invalid token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/auth/me",
        headers: { authorization: "Bearer invalid-jwt-token" },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should reject request with expired token", async () => {
      const token = app.jwt.sign(
        { id: "some-id", email: "exp@test.com", provider: "google" } satisfies JwtPayload,
        { expiresIn: "1s" },
      );

      // Wait for the token to expire
      await new Promise((r) => setTimeout(r, 1500));

      const response = await app.inject({
        method: "GET",
        url: "/auth/me",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 404 for deleted user with valid token", async () => {
      const token = app.jwt.sign({
        id: "00000000-0000-0000-0000-000000000000",
        email: "gone@example.com",
        provider: "google",
      } satisfies JwtPayload);

      const response = await app.inject({
        method: "GET",
        url: "/auth/me",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("Edge Cases", () => {
    it("should handle malformed JSON body", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/auth/google",
        headers: { "content-type": "application/json" },
        payload: "not-json",
      });

      // Fastify returns 400 for malformed JSON
      expect(response.statusCode).toBe(400);
    });

    it("should handle concurrent login attempts from same user", async () => {
      const mockClient = new OAuth2Client();
      (mockClient.verifyIdToken as ReturnType<typeof vi.fn>).mockResolvedValue({
        getPayload: () => ({
          sub: "concurrent-user-123",
          email: "concurrent@gmail.com",
          name: "Concurrent User",
        }),
      });

      const results = await Promise.all([
        app.inject({
          method: "POST",
          url: "/auth/google",
          payload: { idToken: "token-1" },
        }),
        app.inject({
          method: "POST",
          url: "/auth/google",
          payload: { idToken: "token-2" },
        }),
      ]);

      for (const response of results) {
        expect(response.statusCode).toBe(200);
      }

      const userCount = await prisma.user.count({
        where: { email: "concurrent@gmail.com" },
      });
      expect(userCount).toBe(1);
    });
  });
});
