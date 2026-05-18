-- AlterTable
ALTER TABLE "revisions" ADD COLUMN     "api_spec" TEXT;

-- AlterTable
ALTER TABLE "spec_versions" ADD COLUMN     "api_spec" TEXT;
