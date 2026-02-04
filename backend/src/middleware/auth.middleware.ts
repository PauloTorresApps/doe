import type { FastifyRequest, FastifyReply } from "fastify";

export interface JwtPayload {
  id: string;
  email: string;
  provider: string;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.status(401).send({ error: "Unauthorized", message: "Invalid or missing token" });
  }
}
