import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import prismaPlugin from "./plugins/prisma.js";
import authRoutes from "./routes/auth.js";
import keywordRoutes from "./routes/keywords.js";
import userRoutes from "./routes/users.js";
import publicationRoutes from "./routes/publications.js";

const envToLogger: Record<string, object | boolean> = {
  development: {
    transport: {
      target: "pino-pretty",
      options: {
        translateTime: "HH:MM:ss Z",
        ignore: "pid,hostname",
      },
    },
  },
  production: true,
  test: false,
};

const environment = process.env.NODE_ENV ?? "development";

export function buildApp(opts?: { skipPrisma?: boolean }) {
  const app = Fastify({
    logger: envToLogger[environment] ?? true,
  });

  app.register(cors, {
    origin: true,
  });

  app.register(helmet);

  app.register(jwt, {
    secret: process.env.JWT_SECRET ?? "dev-secret-change-in-production",
  });

  if (!opts?.skipPrisma) {
    app.register(prismaPlugin);
  }

  app.register(authRoutes);
  app.register(keywordRoutes);
  app.register(userRoutes);
  app.register(publicationRoutes);

  app.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  return app;
}

async function start() {
  const app = buildApp();
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST ?? "0.0.0.0";

  try {
    await app.listen({ port, host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
