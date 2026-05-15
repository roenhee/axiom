-- AlterTable
ALTER TABLE "specs" ADD COLUMN     "parent_spec_id" TEXT;

-- CreateIndex
CREATE INDEX "specs_project_id_parent_spec_id_idx" ON "specs"("project_id", "parent_spec_id");

-- AddForeignKey
ALTER TABLE "specs" ADD CONSTRAINT "specs_parent_spec_id_fkey" FOREIGN KEY ("parent_spec_id") REFERENCES "specs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
