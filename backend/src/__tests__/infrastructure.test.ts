import { describe, it, expect, afterAll } from "vitest";
import { execSync } from "child_process";
import { Client } from "pg";
import Redis from "ioredis";
import path from "path";

const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");
const BACKEND_ROOT = path.resolve(__dirname, "..", "..");

describe("Infrastructure Validation", () => {
  describe("Docker Compose Services", () => {
    it("should have PostgreSQL container running", () => {
      const result = execSync("docker compose ps --format json postgres", {
        cwd: PROJECT_ROOT,
        encoding: "utf-8",
      });
      const service = JSON.parse(result);
      expect(service.State).toBe("running");
    });

    it("should have Redis container running", () => {
      const result = execSync("docker compose ps --format json redis", {
        cwd: PROJECT_ROOT,
        encoding: "utf-8",
      });
      const service = JSON.parse(result);
      expect(service.State).toBe("running");
    });
  });

  describe("PostgreSQL Connectivity", () => {
    let client: Client;

    afterAll(async () => {
      if (client) {
        await client.end();
      }
    });

    it("should connect to PostgreSQL database", async () => {
      client = new Client({
        host: "localhost",
        port: 5433,
        user: "doe_user",
        password: "doe_password",
        database: "doe_tocantins",
      });

      await client.connect();
      const result = await client.query("SELECT 1 as connected");
      expect(result.rows[0]?.connected).toBe(1);
    });
  });

  describe("Redis Connectivity", () => {
    let redis: Redis;

    afterAll(async () => {
      if (redis) {
        await redis.quit();
      }
    });

    it("should connect to Redis instance", async () => {
      redis = new Redis({
        host: "localhost",
        port: 6380,
        maxRetriesPerRequest: 3,
        connectTimeout: 5000,
      });

      const pong = await redis.ping();
      expect(pong).toBe("PONG");
    });

    it("should be able to set and get values in Redis", async () => {
      redis = new Redis({
        host: "localhost",
        port: 6380,
        maxRetriesPerRequest: 3,
        connectTimeout: 5000,
      });

      await redis.set("test:key", "test-value");
      const value = await redis.get("test:key");
      expect(value).toBe("test-value");
      await redis.del("test:key");
    });
  });

  describe("Prisma Schema Validation", () => {
    it("should validate Prisma schema without errors", () => {
      const result = execSync("npx prisma validate", {
        cwd: BACKEND_ROOT,
        encoding: "utf-8",
        env: {
          ...process.env,
          DATABASE_URL:
            "postgresql://doe_user:doe_password@localhost:5433/doe_tocantins?schema=public",
        },
      });
      expect(result).toContain("The schema at");
    });

    it("should be able to run Prisma migrations", () => {
      const result = execSync("npx prisma migrate dev --name init --skip-generate", {
        cwd: BACKEND_ROOT,
        encoding: "utf-8",
        env: {
          ...process.env,
          DATABASE_URL:
            "postgresql://doe_user:doe_password@localhost:5433/doe_tocantins?schema=public",
        },
      });
      const migrationApplied = result.includes("migrations") || result.includes("Already in sync");
      expect(migrationApplied).toBe(true);
    });
  });

  describe("TypeScript Compilation", () => {
    it("should compile backend TypeScript without errors", () => {
      try {
        const result = execSync("npx tsc --noEmit 2>&1", {
          cwd: BACKEND_ROOT,
          encoding: "utf-8",
        });
        expect(result.trim()).toBe("");
      } catch (err) {
        const error = err as { stdout?: string; stderr?: string };
        throw new Error(
          `TypeScript compilation failed:\n${error.stdout ?? ""}\n${error.stderr ?? ""}`,
        );
      }
    });
  });
});
