import pino from "pino";
import admin from "firebase-admin";
import { createScrapingWorker } from "./scraping.worker.js";
import { createNotificationWorker } from "./notification.worker.js";
import { createScrapingQueue, getRedisConnection } from "./queues.js";

const logger = pino({ name: "worker-runner" });

function initializeFirebase() {
  const credentialPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (!credentialPath) {
    logger.warn("No FIREBASE_SERVICE_ACCOUNT_PATH set. FCM notifications disabled.");
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const serviceAccount = require(credentialPath);
    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    logger.info("Firebase Admin SDK initialized for workers");
    return admin.messaging(app);
  } catch (error) {
    logger.error({ error }, "Failed to initialize Firebase. Notifications disabled.");
    return null;
  }
}

async function main() {
  const connection = getRedisConnection();
  const messaging = initializeFirebase();

  logger.info("Starting scraping worker...");
  const scrapingWorker = createScrapingWorker({ connection });

  logger.info("Starting notification worker...");
  const notificationWorker = createNotificationWorker({ connection, messaging });

  const scrapingQueue = createScrapingQueue(connection);

  // Add a repeatable job that runs every 30 minutes
  await scrapingQueue.upsertJobScheduler(
    "scraping-scheduler",
    { every: 30 * 60 * 1000 },
    { name: "scheduled-scraping", data: { trigger: "scheduled" as const } },
  );

  logger.info("Scraping scheduler registered (every 30 minutes)");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Received shutdown signal");
    await scrapingWorker.close();
    await notificationWorker.close();
    await scrapingQueue.close();
    logger.info("Workers and queues closed gracefully");
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  logger.info("All workers running. Press Ctrl+C to stop.");
}

main().catch((err) => {
  logger.error({ error: err }, "Failed to start workers");
  process.exit(1);
});
