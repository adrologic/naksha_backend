-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "seoPrimaryKeyword" TEXT,
ADD COLUMN     "seoSecondaryKeywords" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Leader" ADD COLUMN     "seoPrimaryKeyword" TEXT,
ADD COLUMN     "seoSecondaryKeywords" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "seoPrimaryKeyword" TEXT,
ADD COLUMN     "seoSecondaryKeywords" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "seoPrimaryKeyword" TEXT,
ADD COLUMN     "seoSecondaryKeywords" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "SeoPage" ADD COLUMN     "primaryKeyword" TEXT,
ADD COLUMN     "secondaryKeywords" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "seoPrimaryKeyword" TEXT,
ADD COLUMN     "seoSecondaryKeywords" JSONB NOT NULL DEFAULT '[]';
