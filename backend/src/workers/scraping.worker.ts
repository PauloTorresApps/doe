import { Worker, Queue } from "bullmq";
import type { Job, ConnectionOptions } from "bullmq";
import { PrismaClient } from "@prisma/client";
import pino from "pino";
import { ScrapingService } from "../services/scraping.service.js";
import { PublicationRepository } from "../repositories/publication.repository.js";
import { SCRAPING_QUEUE_NAME, NOTIFICATION_QUEUE_NAME, getRedisConnection } from "./queues.js";

const logger = pino({ name: "scraping-worker" });

const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes

export interface ScrapingJobData {
  trigger?: "scheduled" | "manual";
}

export interface ScrapingJobResult {
  newPublications: number;
  updatedPublications: number;
  totalProcessed: number;
}

export function createScrapingWorker(opts?: {
  connection?: ConnectionOptions;
  prisma?: PrismaClient;
  scrapingService?: ScrapingService;
}): Worker<ScrapingJobData, ScrapingJobResult> {
  const connection = opts?.connection ?? getRedisConnection();
  const prisma = opts?.prisma ?? new PrismaClient();
  const scrapingService = opts?.scrapingService ?? new ScrapingService();
  const publicationRepo = new PublicationRepository(prisma);
  const notificationQueue = new Queue(NOTIFICATION_QUEUE_NAME, { connection });

  const worker = new Worker<ScrapingJobData, ScrapingJobResult>(
    SCRAPING_QUEUE_NAME,
    async (job: Job<ScrapingJobData>) => {
      logger.info({ jobId: job.id, trigger: job.data.trigger }, "Starting scraping job");

      let newCount = 0;
      let updatedCount = 0;

      const items = await scrapingService.fetchPublicationList();
      logger.info({ count: items.length }, "Fetched publication list from DOE API");

      for (const item of items) {
        const pubData = scrapingService.apiItemToPublicationData(item);
        const { publication, isNew } = await publicationRepo.upsert(pubData);

        if (isNew) {
          newCount++;
          logger.info({ doeId: item.id, edition: item.edicao }, "New publication stored");

          await notificationQueue.add("match-keywords", {
            publicationId: publication.id,
            doeId: publication.doeId,
            edition: publication.edition,
          });
        } else {
          updatedCount++;
        }

        await job.updateProgress(Math.round(((newCount + updatedCount) / items.length) * 100));
      }

      const result: ScrapingJobResult = {
        newPublications: newCount,
        updatedPublications: updatedCount,
        totalProcessed: items.length,
      };

      logger.info(result, "Scraping job completed");
      return result;
    },
    {
      connection,
      concurrency: 1,
      limiter: {
        max: 1,
        duration: RATE_LIMIT_MS,
      },
    },
  );

  worker.on("completed", (job, result) => {
    logger.info({ jobId: job.id, result }, "Job completed successfully");
  });

  worker.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, error: error.message }, "Job failed");
  });

  worker.on("error", (error) => {
    logger.error({ error: error.message }, "Worker error");
  });

  return worker;
}
