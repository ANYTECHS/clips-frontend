-- Drop triggers
DROP TRIGGER IF EXISTS clip_search_vector_trigger ON "ClipSearchIndex";
DROP TRIGGER IF EXISTS project_search_vector_trigger ON "ProjectSearchIndex";
DROP TRIGGER IF EXISTS earning_search_vector_trigger ON "EarningSearchIndex";

-- Drop trigger functions
DROP FUNCTION IF EXISTS update_clip_search_vector();
DROP FUNCTION IF EXISTS update_project_search_vector();
DROP FUNCTION IF EXISTS update_earning_search_vector();

-- Drop indexes
DROP INDEX IF EXISTS "ClipSearchIndex_searchVector_idx";
DROP INDEX IF EXISTS "ProjectSearchIndex_searchVector_idx";
DROP INDEX IF EXISTS "EarningSearchIndex_searchVector_idx";

-- Drop tables
DROP TABLE IF EXISTS "ClipSearchIndex";
DROP TABLE IF EXISTS "ProjectSearchIndex";
DROP TABLE IF EXISTS "EarningSearchIndex";

-- Drop enum
DROP TYPE IF EXISTS "SearchMatchType";
