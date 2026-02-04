import { Queue } from "bullmq";
import type { ConnectionOptions } from "bullmq";

export function getRedisConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL ?? "redis://localhost:6380";
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    password: parsed.password || undefined,
  };
}

export const SCRAPING_QUEUE_NAME = "scraping";
export const NOTIFICATION_QUEUE_NAME = "notification-matching";

export function createScrapingQueue(connection?: ConnectionOptions): Queue {
  return new Queue(SCRAPING_QUEUE_NAME, {
    connection: connection ?? getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 60_000,
      },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  });
}

export function createNotificationQueue(connection?: ConnectionOptions): Queue {
  return new Queue(NOTIFICATION_QUEUE_NAME, {
    connection: connection ?? getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 10_000,
      },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  });
}
