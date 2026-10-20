-- CreateEnum
CREATE TYPE "SearchMatchType" AS ENUM ('exact', 'prefix', 'substring', 'fuzzy');

-- CreateIndex
CREATE TABLE "ClipSearchIndex" (
    "id" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "style" TEXT,
    "tags" TEXT,
    "searchText" TEXT NOT NULL,
    "searchVector" TSVECTOR,

    CONSTRAINT "ClipSearchIndex_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClipSearchIndex_clipId_key" ON "ClipSearchIndex"("clipId");

-- CreateIndex (GIN index for full-text search)
CREATE INDEX "ClipSearchIndex_searchVector_idx" ON "ClipSearchIndex" USING GIN ("searchVector");

-- CreateIndex
CREATE TABLE "ProjectSearchIndex" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "filename" TEXT,
    "status" TEXT NOT NULL,
    "searchText" TEXT NOT NULL,
    "searchVector" TSVECTOR,

    CONSTRAINT "ProjectSearchIndex_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectSearchIndex_jobId_key" ON "ProjectSearchIndex"("jobId");

-- CreateIndex (GIN index for full-text search)
CREATE INDEX "ProjectSearchIndex_searchVector_idx" ON "ProjectSearchIndex" USING GIN ("searchVector");

-- CreateIndex
CREATE TABLE "EarningSearchIndex" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "platform" TEXT,
    "status" TEXT NOT NULL,
    "searchText" TEXT NOT NULL,
    "searchVector" TSVECTOR,

    CONSTRAINT "EarningSearchIndex_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EarningSearchIndex_transactionId_key" ON "EarningSearchIndex"("transactionId");

-- CreateIndex (GIN index for full-text search)
CREATE INDEX "EarningSearchIndex_searchVector_idx" ON "EarningSearchIndex" USING GIN ("searchVector");

-- Create trigger function to update searchVector on insert/update
CREATE OR REPLACE FUNCTION update_clip_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.searchVector := to_tsvector('english', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.style, '') || ' ' || COALESCE(NEW.tags, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clip_search_vector_trigger
  BEFORE INSERT OR UPDATE ON "ClipSearchIndex"
  FOR EACH ROW
  EXECUTE FUNCTION update_clip_search_vector();

-- Create trigger function for projects
CREATE OR REPLACE FUNCTION update_project_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.searchVector := to_tsvector('english', COALESCE(NEW.filename, '') || ' ' || COALESCE(NEW.status, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER project_search_vector_trigger
  BEFORE INSERT OR UPDATE ON "ProjectSearchIndex"
  FOR EACH ROW
  EXECUTE FUNCTION update_project_search_vector();

-- Create trigger function for earnings
CREATE OR REPLACE FUNCTION update_earning_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.searchVector := to_tsvector('english', COALESCE(NEW.description, '') || ' ' || COALESCE(NEW.platform, '') || ' ' || COALESCE(NEW.status, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER earning_search_vector_trigger
  BEFORE INSERT OR UPDATE ON "EarningSearchIndex"
  FOR EACH ROW
  EXECUTE FUNCTION update_earning_search_vector();
