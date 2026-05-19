-- CreateEnum
CREATE TYPE "FigmaRequiredLevel" AS ENUM ('required', 'recommended', 'optional', 'not_needed');

-- CreateTable
CREATE TABLE "figma_frames" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "file_key" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "figma_frames_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spec_figma_links" (
    "id" TEXT NOT NULL,
    "spec_id" TEXT NOT NULL,
    "figma_frame_id" TEXT NOT NULL,
    "required_level" "FigmaRequiredLevel" NOT NULL DEFAULT 'optional',
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spec_figma_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "figma_frames_project_id_idx" ON "figma_frames"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "figma_frames_project_id_file_key_node_id_key" ON "figma_frames"("project_id", "file_key", "node_id");

-- CreateIndex
CREATE INDEX "spec_figma_links_spec_id_idx" ON "spec_figma_links"("spec_id");

-- CreateIndex
CREATE UNIQUE INDEX "spec_figma_links_spec_id_figma_frame_id_key" ON "spec_figma_links"("spec_id", "figma_frame_id");

-- AddForeignKey
ALTER TABLE "figma_frames" ADD CONSTRAINT "figma_frames_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "figma_frames" ADD CONSTRAINT "figma_frames_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spec_figma_links" ADD CONSTRAINT "spec_figma_links_spec_id_fkey" FOREIGN KEY ("spec_id") REFERENCES "specs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spec_figma_links" ADD CONSTRAINT "spec_figma_links_figma_frame_id_fkey" FOREIGN KEY ("figma_frame_id") REFERENCES "figma_frames"("id") ON DELETE CASCADE ON UPDATE CASCADE;
