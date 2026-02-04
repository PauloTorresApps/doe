import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { UserRepository } from "../repositories/user.repository.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const fcmTokenSchema = z.object({
  fcm_token: z.string().min(1, "FCM token is required"),
});

export default async function userRoutes(fastify: FastifyInstance) {
  const userRepository = new UserRepository(fastify.prisma);

  fastify.put(
    "/users/fcm-token",
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const parsed = fcmTokenSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Bad Request",
          message: "Invalid request body",
          details: parsed.error.issues,
        });
      }

      const { id } = request.user;
      const { fcm_token } = parsed.data;

      const user = await userRepository.findById(id);
      if (!user) {
        return reply.status(404).send({
          error: "Not Found",
          message: "User not found",
        });
      }

      await userRepository.updateFcmToken(id, fcm_token);

      return reply.send({ success: true });
    },
  );
}
