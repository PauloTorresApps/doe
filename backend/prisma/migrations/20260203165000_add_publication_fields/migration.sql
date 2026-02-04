-- DropIndex
DROP INDEX "publications_edition_key";

-- AlterTable
ALTER TABLE "publications" ADD COLUMN "content" TEXT,
ADD COLUMN "doe_id" INTEGER,
ADD COLUMN "supplement" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "title" TEXT;

-- Populate doe_id from existing data (use id hash as fallback)
UPDATE "publications" SET "doe_id" = abs(hashtext("id")) WHERE "doe_id" IS NULL;

-- Make doe_id required
ALTER TABLE "publications" ALTER COLUMN "doe_id" SET NOT NULL;

-- Change edition type from INTEGER to TEXT
ALTER TABLE "publications" ALTER COLUMN "edition" TYPE TEXT USING "edition"::TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "publications_doe_id_key" ON "publications"("doe_id");
