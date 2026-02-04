-- AlterTable: Replace googleId with provider/providerId
ALTER TABLE "users" DROP COLUMN IF EXISTS "google_id";
ALTER TABLE "users" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'google';
ALTER TABLE "users" ADD COLUMN "provider_id" TEXT NOT NULL DEFAULT '';

-- Remove defaults after adding columns
ALTER TABLE "users" ALTER COLUMN "provider" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "provider_id" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "users_provider_provider_id_key" ON "users"("provider", "provider_id");
