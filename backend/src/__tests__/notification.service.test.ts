import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotificationService } from "../services/notification.service.js";
import type { PrismaClient, Publication, Keyword, User } from "@prisma/client";
import type { Messaging } from "firebase-admin/messaging";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    provider: "google",
    providerId: "google-123",
    avatarUrl: null,
    fcmToken: "fcm-token-valid",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeKeyword(
  overrides: Partial<Keyword> = {},
  user?: User,
): Keyword & { user: User } {
  const defaultUser = user ?? makeUser();
  return {
    id: "kw-1",
    expression: "licitação",
    userId: defaultUser.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: defaultUser,
    ...overrides,
  } as Keyword & { user: User };
}

function makePublication(overrides: Partial<Publication> = {}): Publication {
  return {
    id: "pub-1",
    doeId: 1234,
    edition: "6991",
    publishedDate: new Date("2025-01-20"),
    pdfUrl: "https://example.com/download/1234",
    thumbnailUrl: null,
    pageCount: 42,
    title: "Edição 6991",
    content: "Aviso de Licitação - Pregão Eletrônico nº 001/2025",
    supplement: false,
    processedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

type MockPrisma = {
  publication: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  keyword: {
    findMany: ReturnType<typeof vi.fn>;
  };
  user: {
    updateMany: ReturnType<typeof vi.fn>;
  };
};

type MockMessaging = {
  send: ReturnType<typeof vi.fn>;
};

describe("NotificationService", () => {
  let mockPrisma: MockPrisma;
  let mockMessaging: MockMessaging;
  let service: NotificationService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      publication: {
        findUnique: vi.fn(),
      },
      keyword: {
        findMany: vi.fn(),
      },
      user: {
        updateMany: vi.fn(),
      },
    };

    mockMessaging = {
      send: vi.fn().mockResolvedValue("message-id-123"),
    };

    service = new NotificationService(
      mockPrisma as unknown as PrismaClient,
      mockMessaging as unknown as Messaging,
    );
  });

  describe("findMatchingUsers", () => {
    it("should return matching users when keyword found in content", async () => {
      const user = makeUser();
      const publication = makePublication({
        content: "Aviso de Licitação - Pregão Eletrônico nº 001/2025",
      });
      const keyword = makeKeyword({ expression: "licitação" }, user);

      mockPrisma.publication.findUnique.mockResolvedValue(publication);
      mockPrisma.keyword.findMany.mockResolvedValue([keyword]);

      const result = await service.findMatchingUsers("pub-1");

      expect(result).toHaveLength(1);
      expect(result[0]!.userId).toBe("user-1");
      expect(result[0]!.fcmToken).toBe("fcm-token-valid");
      expect(result[0]!.keywords).toContain("licitação");
    });

    it("should return matching users when keyword found in title", async () => {
      const user = makeUser();
      const publication = makePublication({
        title: "Edição Suplementar - Licitação",
        content: "Conteúdo sem correspondência",
      });
      const keyword = makeKeyword({ expression: "licitação" }, user);

      mockPrisma.publication.findUnique.mockResolvedValue(publication);
      mockPrisma.keyword.findMany.mockResolvedValue([keyword]);

      const result = await service.findMatchingUsers("pub-1");

      expect(result).toHaveLength(1);
      expect(result[0]!.keywords).toContain("licitação");
    });

    it("should be case-insensitive when matching keywords", async () => {
      const user = makeUser();
      const publication = makePublication({
        content: "AVISO DE LICITAÇÃO PÚBLICA",
      });
      const keyword = makeKeyword({ expression: "licitação" }, user);

      mockPrisma.publication.findUnique.mockResolvedValue(publication);
      mockPrisma.keyword.findMany.mockResolvedValue([keyword]);

      const result = await service.findMatchingUsers("pub-1");

      expect(result).toHaveLength(1);
    });

    it("should return empty array when no keywords match", async () => {
      const user = makeUser();
      const publication = makePublication({
        content: "Ata de reunião ordinária",
      });
      const keyword = makeKeyword({ expression: "licitação" }, user);

      mockPrisma.publication.findUnique.mockResolvedValue(publication);
      mockPrisma.keyword.findMany.mockResolvedValue([keyword]);

      const result = await service.findMatchingUsers("pub-1");

      expect(result).toHaveLength(0);
    });

    it("should return empty array when publication not found", async () => {
      mockPrisma.publication.findUnique.mockResolvedValue(null);

      const result = await service.findMatchingUsers("nonexistent");

      expect(result).toHaveLength(0);
    });

    it("should return empty array when publication has no content", async () => {
      const publication = makePublication({ content: null });

      mockPrisma.publication.findUnique.mockResolvedValue(publication);

      const result = await service.findMatchingUsers("pub-1");

      expect(result).toHaveLength(0);
    });

    it("should exclude users without FCM token", async () => {
      const userWithToken = makeUser({ id: "user-1", fcmToken: "valid-token" });
      const userWithoutToken = makeUser({ id: "user-2", fcmToken: null });

      const publication = makePublication({
        content: "Aviso de Licitação",
      });

      mockPrisma.publication.findUnique.mockResolvedValue(publication);
      mockPrisma.keyword.findMany.mockResolvedValue([
        makeKeyword({ id: "kw-1", expression: "licitação", userId: "user-1" }, userWithToken),
        makeKeyword({ id: "kw-2", expression: "licitação", userId: "user-2" }, userWithoutToken),
      ]);

      const result = await service.findMatchingUsers("pub-1");

      expect(result).toHaveLength(1);
      expect(result[0]!.userId).toBe("user-1");
    });

    it("should group multiple matching keywords per user", async () => {
      const user = makeUser();
      const publication = makePublication({
        content: "Aviso de Licitação e Concurso Público",
      });

      mockPrisma.publication.findUnique.mockResolvedValue(publication);
      mockPrisma.keyword.findMany.mockResolvedValue([
        makeKeyword({ id: "kw-1", expression: "licitação" }, user),
        makeKeyword({ id: "kw-2", expression: "concurso" }, user),
      ]);

      const result = await service.findMatchingUsers("pub-1");

      expect(result).toHaveLength(1);
      expect(result[0]!.keywords).toHaveLength(2);
      expect(result[0]!.keywords).toContain("licitação");
      expect(result[0]!.keywords).toContain("concurso");
    });

    it("should match multiple users with same keyword", async () => {
      const user1 = makeUser({ id: "user-1", fcmToken: "token-1" });
      const user2 = makeUser({ id: "user-2", fcmToken: "token-2" });

      const publication = makePublication({
        content: "Aviso de Licitação",
      });

      mockPrisma.publication.findUnique.mockResolvedValue(publication);
      mockPrisma.keyword.findMany.mockResolvedValue([
        makeKeyword({ id: "kw-1", expression: "licitação", userId: "user-1" }, user1),
        makeKeyword({ id: "kw-2", expression: "licitação", userId: "user-2" }, user2),
      ]);

      const result = await service.findMatchingUsers("pub-1");

      expect(result).toHaveLength(2);
    });
  });

  describe("sendPushNotification", () => {
    it("should send notification to valid FCM token", async () => {
      const payload = {
        title: "DOE Tocantins - Edição 6991",
        body: 'Palavras-chave encontradas: licitação',
        data: { publicationId: "pub-1", keyword: "licitação" },
      };

      const result = await service.sendPushNotification("fcm-token-valid", payload);

      expect(result.success).toBe(true);
      expect(mockMessaging.send).toHaveBeenCalledWith(
        expect.objectContaining({
          token: "fcm-token-valid",
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: {
            publicationId: "pub-1",
            keyword: "licitação",
          },
        }),
      );
    });

    it("should include Android and APNS configuration", async () => {
      const payload = {
        title: "Test",
        body: "Test body",
        data: { publicationId: "pub-1", keyword: "test" },
      };

      await service.sendPushNotification("fcm-token", payload);

      const sentMessage = mockMessaging.send.mock.calls[0]![0];
      expect(sentMessage.android).toEqual({
        priority: "high",
        notification: { channelId: "doe-notifications" },
      });
      expect(sentMessage.apns).toBeDefined();
      expect(sentMessage.apns.payload.aps.sound).toBe("default");
    });

    it("should handle invalid token errors and clear from database", async () => {
      const error = new Error("Invalid registration token");
      (error as unknown as { code: string }).code = "messaging/invalid-registration-token";
      mockMessaging.send.mockRejectedValue(error);
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.sendPushNotification("invalid-token", {
        title: "Test",
        body: "Test",
        data: { publicationId: "pub-1", keyword: "test" },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("invalid_token");
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: { fcmToken: "invalid-token" },
        data: { fcmToken: null },
      });
    });

    it("should handle unregistered token errors and clear from database", async () => {
      const error = new Error("Token not registered");
      (error as unknown as { code: string }).code = "messaging/registration-token-not-registered";
      mockMessaging.send.mockRejectedValue(error);
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.sendPushNotification("expired-token", {
        title: "Test",
        body: "Test",
        data: { publicationId: "pub-1", keyword: "test" },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("invalid_token");
    });

    it("should handle network failures without clearing token", async () => {
      mockMessaging.send.mockRejectedValue(new Error("Network timeout"));

      const result = await service.sendPushNotification("valid-token", {
        title: "Test",
        body: "Test",
        data: { publicationId: "pub-1", keyword: "test" },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network timeout");
      expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
    });

    it("should return failure when messaging is not configured", async () => {
      const serviceNoFcm = new NotificationService(
        mockPrisma as unknown as PrismaClient,
        null,
      );

      const result = await serviceNoFcm.sendPushNotification("any-token", {
        title: "Test",
        body: "Test",
        data: { publicationId: "pub-1", keyword: "test" },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("FCM not configured");
    });
  });

  describe("notifyMatchingUsers", () => {
    it("should send notifications to all matching users", async () => {
      const user1 = makeUser({ id: "user-1", fcmToken: "token-1" });
      const user2 = makeUser({ id: "user-2", fcmToken: "token-2" });

      const publication = makePublication({ content: "Aviso de Licitação" });

      mockPrisma.publication.findUnique.mockResolvedValue(publication);
      mockPrisma.keyword.findMany.mockResolvedValue([
        makeKeyword({ id: "kw-1", expression: "licitação", userId: "user-1" }, user1),
        makeKeyword({ id: "kw-2", expression: "licitação", userId: "user-2" }, user2),
      ]);

      const result = await service.notifyMatchingUsers("pub-1", "6991");

      expect(result.sent).toBe(2);
      expect(result.failed).toBe(0);
      expect(mockMessaging.send).toHaveBeenCalledTimes(2);
    });

    it("should include correct payload structure", async () => {
      const user = makeUser();
      const publication = makePublication({ content: "Resultado do Concurso" });

      mockPrisma.publication.findUnique.mockResolvedValue(publication);
      mockPrisma.keyword.findMany.mockResolvedValue([
        makeKeyword({ expression: "concurso" }, user),
      ]);

      await service.notifyMatchingUsers("pub-1", "6991");

      const sentMessage = mockMessaging.send.mock.calls[0]![0];
      expect(sentMessage.notification.title).toBe("DOE Tocantins - Edição 6991");
      expect(sentMessage.notification.body).toContain("concurso");
      expect(sentMessage.data.publicationId).toBe("pub-1");
      expect(sentMessage.data.keyword).toBe("concurso");
    });

    it("should count failures separately from successes", async () => {
      const user1 = makeUser({ id: "user-1", fcmToken: "good-token" });
      const user2 = makeUser({ id: "user-2", fcmToken: "bad-token" });

      const publication = makePublication({ content: "Aviso de Licitação" });

      mockPrisma.publication.findUnique.mockResolvedValue(publication);
      mockPrisma.keyword.findMany.mockResolvedValue([
        makeKeyword({ id: "kw-1", expression: "licitação", userId: "user-1" }, user1),
        makeKeyword({ id: "kw-2", expression: "licitação", userId: "user-2" }, user2),
      ]);

      mockMessaging.send
        .mockResolvedValueOnce("msg-1")
        .mockRejectedValueOnce(new Error("Send failed"));

      const result = await service.notifyMatchingUsers("pub-1", "6991");

      expect(result.sent).toBe(1);
      expect(result.failed).toBe(1);
    });

    it("should return zero counts when no users match", async () => {
      const publication = makePublication({ content: "Ata de reunião" });

      mockPrisma.publication.findUnique.mockResolvedValue(publication);
      mockPrisma.keyword.findMany.mockResolvedValue([
        makeKeyword({ expression: "licitação" }, makeUser()),
      ]);

      const result = await service.notifyMatchingUsers("pub-1", "6991");

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
      expect(mockMessaging.send).not.toHaveBeenCalled();
    });
  });
});
