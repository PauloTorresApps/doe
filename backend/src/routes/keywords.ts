import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { KeywordRepository } from "../repositories/keyword.repository.js";
import { KeywordService, KeywordServiceError } from "../services/keyword.service.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const createKeywordSchema = z.object({
  expression: z.string().min(1, "Expression is required"),
});

const updateKeywordSchema = z.object({
  expression: z.string().min(1, "Expression is required"),
});

const keywordIdParamSchema = z.object({
  id: z.string().uuid("Invalid keyword ID"),
});

function handleServiceError(error: KeywordServiceError) {
  switch (error.code) {
    case "TOO_SHORT":
    case "LIMIT_EXCEEDED":
    case "DUPLICATE":
      return { status: 400 as const, body: { error: "Bad Request", message: error.message } };
    case "NOT_FOUND":
      return { status: 404 as const, body: { error: "Not Found", message: error.message } };
    case "FORBIDDEN":
      return { status: 403 as const, body: { error: "Forbidden", message: error.message } };
  }
}

export default async function keywordRoutes(fastify: FastifyInstance) {
  const keywordRepository = new KeywordRepository(fastify.prisma);
  const keywordService = new KeywordService(keywordRepository);

  fastify.addHook("preHandler", authMiddleware);

  // GET /keywords - List user's keywords
  fastify.get("/keywords", async (request, reply) => {
    const keywords = await keywordService.listByUser(request.user.id);
    return reply.send({ keywords });
  });

  // POST /keywords - Create a new keyword
  fastify.post("/keywords", async (request, reply) => {
    const parsed = createKeywordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Bad Request",
        message: "Invalid request body",
        details: parsed.error.issues,
      });
    }

    try {
      const keyword = await keywordService.create(request.user.id, parsed.data.expression);
      return reply.status(201).send({ keyword });
    } catch (err) {
      if (err instanceof KeywordServiceError) {
        const { status, body } = handleServiceError(err);
        return reply.status(status).send(body);
      }
      throw err;
    }
  });

  // PUT /keywords/:id - Update a keyword
  fastify.put<{ Params: { id: string } }>("/keywords/:id", async (request, reply) => {
    const paramParsed = keywordIdParamSchema.safeParse(request.params);
    if (!paramParsed.success) {
      return reply.status(400).send({
        error: "Bad Request",
        message: "Invalid keyword ID",
      });
    }

    const bodyParsed = updateKeywordSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send({
        error: "Bad Request",
        message: "Invalid request body",
        details: bodyParsed.error.issues,
      });
    }

    try {
      const keyword = await keywordService.update(
        request.user.id,
        paramParsed.data.id,
        bodyParsed.data.expression,
      );
      return reply.send({ keyword });
    } catch (err) {
      if (err instanceof KeywordServiceError) {
        const { status, body } = handleServiceError(err);
        return reply.status(status).send(body);
      }
      throw err;
    }
  });

  // DELETE /keywords/:id - Delete a keyword
  fastify.delete<{ Params: { id: string } }>("/keywords/:id", async (request, reply) => {
    const paramParsed = keywordIdParamSchema.safeParse(request.params);
    if (!paramParsed.success) {
      return reply.status(400).send({
        error: "Bad Request",
        message: "Invalid keyword ID",
      });
    }

    try {
      await keywordService.delete(request.user.id, paramParsed.data.id);
      return reply.status(204).send();
    } catch (err) {
      if (err instanceof KeywordServiceError) {
        const { status, body } = handleServiceError(err);
        return reply.status(status).send(body);
      }
      throw err;
    }
  });
}
