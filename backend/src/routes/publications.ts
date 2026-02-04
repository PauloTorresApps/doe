import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PublicationRepository } from "../repositories/publication.repository.js";
import { SearchService, SearchServiceError } from "../services/search.service.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

const searchSchema = z.object({
  q: z.string().min(3, "Search query must have at least 3 characters"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export default async function publicationRoutes(fastify: FastifyInstance) {
  const publicationRepository = new PublicationRepository(fastify.prisma);
  const searchService = new SearchService(fastify.prisma);

  fastify.addHook("preHandler", authMiddleware);

  // GET /publications - List publications with pagination
  fastify.get("/publications", async (request, reply) => {
    const parsed = paginationSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Bad Request",
        message: "Invalid query parameters",
        details: parsed.error.issues,
      });
    }

    const { page, limit } = parsed.data;
    const { data, total } = await publicationRepository.findPaginated(page, limit);

    return reply.send({
      data,
      hasMore: page * limit < total,
      total,
    });
  });

  // GET /publications/search - Full-text search publications
  fastify.get("/publications/search", async (request, reply) => {
    const parsed = searchSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Bad Request",
        message: "Invalid search parameters",
        details: parsed.error.issues,
      });
    }

    try {
      const { q, startDate, endDate, page, limit } = parsed.data;
      const result = await searchService.search({
        query: q,
        startDate,
        endDate,
        page,
        limit,
      });
      return reply.send(result);
    } catch (err) {
      if (err instanceof SearchServiceError) {
        return reply.status(400).send({
          error: "Bad Request",
          message: err.message,
        });
      }
      throw err;
    }
  });
}
