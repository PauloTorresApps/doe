import type { PrismaClient, User } from "@prisma/client";
import type { Messaging } from "firebase-admin/messaging";
import pino from "pino";

const logger = pino({ name: "notification-service" });

export interface MatchingUser {
  userId: string;
  fcmToken: string;
  keywords: string[];
}

export interface NotificationPayload {
  title: string;
  body: string;
  data: {
    publicationId: string;
    keyword: string;
  };
}

export interface SendResult {
  success: boolean;
  userId: string;
  error?: string;
}

export class NotificationService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly messaging: Messaging | null,
  ) {}

  async findMatchingUsers(publicationId: string): Promise<MatchingUser[]> {
    const publication = await this.prisma.publication.findUnique({
      where: { id: publicationId },
    });

    if (!publication || !publication.content) {
      logger.info({ publicationId }, "Publication not found or has no content");
      return [];
    }

    const contentLower = publication.content.toLowerCase();
    const titleLower = (publication.title ?? "").toLowerCase();

    const keywords = await this.prisma.keyword.findMany({
      include: { user: true },
    });

    const userMatches = new Map<string, { user: User; keywords: string[] }>();

    for (const keyword of keywords) {
      const expr = keyword.expression.toLowerCase();
      if (contentLower.includes(expr) || titleLower.includes(expr)) {
        const existing = userMatches.get(keyword.userId);
        if (existing) {
          existing.keywords.push(keyword.expression);
        } else {
          userMatches.set(keyword.userId, {
            user: keyword.user,
            keywords: [keyword.expression],
          });
        }
      }
    }

    const result: MatchingUser[] = [];
    for (const [userId, { user, keywords: matchedKeywords }] of userMatches) {
      if (user.fcmToken) {
        result.push({
          userId,
          fcmToken: user.fcmToken,
          keywords: matchedKeywords,
        });
      }
    }

    logger.info(
      { publicationId, matchCount: result.length },
      "Found matching users for publication",
    );

    return result;
  }

  async sendPushNotification(
    fcmToken: string,
    payload: NotificationPayload,
  ): Promise<SendResult> {
    if (!this.messaging) {
      logger.warn("FCM messaging not configured, skipping notification");
      return { success: false, userId: "", error: "FCM not configured" };
    }

    try {
      await this.messaging.send({
        token: fcmToken,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          publicationId: payload.data.publicationId,
          keyword: payload.data.keyword,
        },
        android: {
          priority: "high",
          notification: {
            channelId: "doe-notifications",
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: payload.title,
                body: payload.body,
              },
              sound: "default",
              badge: 1,
            },
          },
        },
      });

      logger.info({ fcmToken: fcmToken.slice(0, 10) + "..." }, "Push notification sent");
      return { success: true, userId: "" };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = (error as { code?: string }).code;

      if (
        errorCode === "messaging/invalid-registration-token" ||
        errorCode === "messaging/registration-token-not-registered"
      ) {
        logger.warn(
          { fcmToken: fcmToken.slice(0, 10) + "...", errorCode },
          "Invalid FCM token, clearing from database",
        );
        await this.clearInvalidToken(fcmToken);
        return { success: false, userId: "", error: "invalid_token" };
      }

      logger.error({ error: errorMessage }, "Failed to send push notification");
      return { success: false, userId: "", error: errorMessage };
    }
  }

  async notifyMatchingUsers(
    publicationId: string,
    edition: string,
  ): Promise<{ sent: number; failed: number }> {
    const matchingUsers = await this.findMatchingUsers(publicationId);

    let sent = 0;
    let failed = 0;

    for (const match of matchingUsers) {
      const keywordList = match.keywords.join(", ");
      const payload: NotificationPayload = {
        title: `DOE Tocantins - Edição ${edition}`,
        body: `Palavras-chave encontradas: ${keywordList}`,
        data: {
          publicationId,
          keyword: match.keywords[0]!,
        },
      };

      const result = await this.sendPushNotification(match.fcmToken, payload);
      result.userId = match.userId;

      if (result.success) {
        sent++;
      } else {
        failed++;
      }
    }

    logger.info(
      { publicationId, edition, sent, failed },
      "Notification batch completed",
    );

    return { sent, failed };
  }

  private async clearInvalidToken(fcmToken: string): Promise<void> {
    try {
      await this.prisma.user.updateMany({
        where: { fcmToken },
        data: { fcmToken: null },
      });
    } catch (error) {
      logger.error({ error }, "Failed to clear invalid FCM token");
    }
  }
}
