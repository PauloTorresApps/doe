import { Worker } from "bullmq";
import type { Job, ConnectionOptions } from "bullmq";
import { PrismaClient } from "@prisma/client";
import type { Messaging } from "firebase-admin/messaging";
import pino from "pino";
import { NotificationService } from "../services/notification.service.js";
import { NOTIFICATION_QUEUE_NAME, getRedisConnection } from "./queues.js";

const logger = pino({ name: "notification-worker" });

export interface NotificationJobData {
  publicationId: string;
  doeId: number;
  edition: string;
}

export interface NotificationJobResult {
  sent: number;
  failed: number;
}

export function createNotificationWorker(opts?: {
  connection?: ConnectionOptions;
  prisma?: PrismaClient;
  messaging?: Messaging | null;
}): Worker<NotificationJobData, NotificationJobResult> {
  const connection = opts?.connection ?? getRedisConnection();
  const prisma = opts?.prisma ?? new PrismaClient();
  const messaging = opts?.messaging ?? null;
  const notificationService = new NotificationService(prisma, messaging);

  const worker = new Worker<NotificationJobData, NotificationJobResult>(
    NOTIFICATION_QUEUE_NAME,
    async (job: Job<NotificationJobData>) => {
      logger.info(
        { jobId: job.id, publicationId: job.data.publicationId, edition: job.data.edition },
        "Processing notification job",
      );

      const { sent, failed } = await notificationService.notifyMatchingUsers(
        job.data.publicationId,
        job.data.edition,
      );

      const result: NotificationJobResult = { sent, failed };
      logger.info(result, "Notification job completed");
      return result;
    },
    {
      connection,
      concurrency: 3,
    },
  );

  worker.on("completed", (job, result) => {
    logger.info({ jobId: job.id, result }, "Notification job completed successfully");
  });

  worker.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, error: error.message }, "Notification job failed");
  });

  worker.on("error", (error) => {
    logger.error({ error: error.message }, "Notification worker error");
  });

  return worker;
}
