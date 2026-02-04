import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthService } from "../services/auth.service.js";

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

describe("AuthService", () => {
  let authService: AuthService;
  const mockGoogleClientId = "test-google-client-id";
  const mockAppleClientId = "test-apple-client-id";

  beforeEach(() => {
    vi.clearAllMocks();
    authService = new AuthService({
      googleClientId: mockGoogleClientId,
      appleClientId: mockAppleClientId,
    });
  });

  describe("validateGoogleToken", () => {
    it("should return user data for a valid Google token", async () => {
      const mockPayload = {
        sub: "google-user-123",
        email: "user@example.com",
        name: "Test User",
        picture: "https://example.com/photo.jpg",
      };

      const mockClient = new OAuth2Client();
      (mockClient.verifyIdToken as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        getPayload: () => mockPayload,
      });

      // Replace the internal client
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (authService as any).googleClient = mockClient;

      const result = await authService.validateGoogleToken("valid-token");

      expect(result).toEqual({
        email: "user@example.com",
        name: "Test User",
        provider: "google",
        providerId: "google-user-123",
        avatarUrl: "https://example.com/photo.jpg",
      });
    });

    it("should use email as name when name is not provided", async () => {
      const mockPayload = {
        sub: "google-user-123",
        email: "user@example.com",
        name: undefined,
        picture: undefined,
      };

      const mockClient = new OAuth2Client();
      (mockClient.verifyIdToken as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        getPayload: () => mockPayload,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (authService as any).googleClient = mockClient;

      const result = await authService.validateGoogleToken("valid-token");

      expect(result.name).toBe("user@example.com");
      expect(result.avatarUrl).toBeNull();
    });

    it("should throw for invalid Google token (no payload)", async () => {
      const mockClient = new OAuth2Client();
      (mockClient.verifyIdToken as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        getPayload: () => undefined,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (authService as any).googleClient = mockClient;

      await expect(authService.validateGoogleToken("invalid-token")).rejects.toThrow(
        "Invalid Google token: no payload",
      );
    });

    it("should throw for Google token with missing required fields", async () => {
      const mockClient = new OAuth2Client();
      (mockClient.verifyIdToken as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        getPayload: () => ({ sub: undefined, email: undefined }),
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (authService as any).googleClient = mockClient;

      await expect(authService.validateGoogleToken("bad-token")).rejects.toThrow(
        "Invalid Google token: missing required fields",
      );
    });

    it("should throw when Google verification fails", async () => {
      const mockClient = new OAuth2Client();
      (mockClient.verifyIdToken as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Token expired"),
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (authService as any).googleClient = mockClient;

      await expect(authService.validateGoogleToken("expired-token")).rejects.toThrow(
        "Token expired",
      );
    });
  });

  describe("validateAppleToken", () => {
    it("should return user data for a valid Apple token", async () => {
      (jose.jwtVerify as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        payload: {
          sub: "apple-user-123",
          email: "user@icloud.com",
          name: "Apple User",
        },
      });

      const result = await authService.validateAppleToken("valid-apple-token");

      expect(result).toEqual({
        email: "user@icloud.com",
        name: "Apple User",
        provider: "apple",
        providerId: "apple-user-123",
        avatarUrl: null,
      });
    });

    it("should use private relay email when email is not provided", async () => {
      (jose.jwtVerify as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        payload: {
          sub: "apple-user-456",
        },
      });

      const result = await authService.validateAppleToken("private-relay-token");

      expect(result.email).toBe("apple-user-456@privaterelay.appleid.com");
      expect(result.provider).toBe("apple");
      expect(result.providerId).toBe("apple-user-456");
    });

    it("should throw for Apple token with missing subject", async () => {
      (jose.jwtVerify as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        payload: {},
      });

      await expect(authService.validateAppleToken("no-sub-token")).rejects.toThrow(
        "Invalid Apple token: missing subject",
      );
    });

    it("should throw when Apple JWT verification fails", async () => {
      (jose.jwtVerify as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("JWT verification failed"),
      );

      await expect(authService.validateAppleToken("bad-apple-token")).rejects.toThrow(
        "JWT verification failed",
      );
    });
  });
});
