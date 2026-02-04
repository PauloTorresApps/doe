import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AuthService } from "../services/auth.service.js";
import { UserRepository } from "../repositories/user.repository.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const googleAuthSchema = z.object({
  idToken: z.string().min(1),
  fcmToken: z.string().optional(),
});

const appleAuthSchema = z.object({
  identityToken: z.string().min(1),
  fullName: z.string().optional(),
  fcmToken: z.string().optional(),
});

export default async function authRoutes(fastify: FastifyInstance) {
  const authService = new AuthService({
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
    appleClientId: process.env.APPLE_CLIENT_ID ?? "",
  });
  const userRepository = new UserRepository(fastify.prisma);

  fastify.post("/auth/google", async (request, reply) => {
    const parsed = googleAuthSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Bad Request",
        message: "Invalid request body",
        details: parsed.error.issues,
      });
    }

    const { idToken, fcmToken } = parsed.data;

    let userInfo;
    try {
      userInfo = await authService.validateGoogleToken(idToken);
    } catch {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Invalid Google token",
      });
    }

    const user = await userRepository.createOrUpdate(userInfo);

    if (fcmToken) {
      await userRepository.updateFcmToken(user.id, fcmToken);
    }

    const token = fastify.jwt.sign(
      { id: user.id, email: user.email, provider: user.provider },
      { expiresIn: "7d" },
    );

    return reply.send({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        provider: user.provider,
      },
    });
  });

  fastify.post("/auth/apple", async (request, reply) => {
    const parsed = appleAuthSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Bad Request",
        message: "Invalid request body",
        details: parsed.error.issues,
      });
    }

    const { identityToken, fullName, fcmToken } = parsed.data;

    let userInfo;
    try {
      userInfo = await authService.validateAppleToken(identityToken);
    } catch {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Invalid Apple token",
      });
    }

    if (fullName) {
      userInfo.name = fullName;
    }

    const user = await userRepository.createOrUpdate(userInfo);

    if (fcmToken) {
      await userRepository.updateFcmToken(user.id, fcmToken);
    }

    const token = fastify.jwt.sign(
      { id: user.id, email: user.email, provider: user.provider },
      { expiresIn: "7d" },
    );

    return reply.send({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        provider: user.provider,
      },
    });
  });

  fastify.get("/auth/me", { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.user;
    const user = await userRepository.findById(id);

    if (!user) {
      return reply.status(404).send({ error: "Not Found", message: "User not found" });
    }

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        provider: user.provider,
      },
    });
  });
}
