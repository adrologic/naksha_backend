-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "seoCanonicalUrl" TEXT,
ADD COLUMN     "seoKeywords" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "seoNoFollow" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seoNoIndex" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seoOgDescription" TEXT,
ADD COLUMN     "seoOgTitle" TEXT;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "seoCanonicalUrl" TEXT,
ADD COLUMN     "seoKeywords" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "seoNoFollow" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seoNoIndex" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seoOgDescription" TEXT,
ADD COLUMN     "seoOgTitle" TEXT;

-- AlterTable
ALTER TABLE "Leader" ADD COLUMN     "seoCanonicalUrl" TEXT,
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoKeywords" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "seoNoFollow" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seoNoIndex" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seoOgDescription" TEXT,
ADD COLUMN     "seoOgImage" TEXT,
ADD COLUMN     "seoOgTitle" TEXT,
ADD COLUMN     "seoTitle" TEXT;

-- AlterTable
ALTER TABLE "Market" ADD COLUMN     "seoCanonicalUrl" TEXT,
ADD COLUMN     "seoKeywords" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "seoNoFollow" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seoNoIndex" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seoOgDescription" TEXT,
ADD COLUMN     "seoOgTitle" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "seoCanonicalUrl" TEXT,
ADD COLUMN     "seoKeywords" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "seoNoFollow" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seoNoIndex" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seoOgDescription" TEXT,
ADD COLUMN     "seoOgTitle" TEXT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "seoCanonicalUrl" TEXT,
ADD COLUMN     "seoKeywords" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "seoNoFollow" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seoNoIndex" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seoOgDescription" TEXT,
ADD COLUMN     "seoOgTitle" TEXT;

-- CreateTable
CREATE TABLE "SeoPage" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "keywords" JSONB NOT NULL DEFAULT '[]',
    "ogTitle" TEXT,
    "ogDescription" TEXT,
    "ogImage" TEXT,
    "canonicalUrl" TEXT,
    "noIndex" BOOLEAN NOT NULL DEFAULT false,
    "noFollow" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SeoPage_path_key" ON "SeoPage"("path");
