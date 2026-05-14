-- CreateEnum
CREATE TYPE "SpecType" AS ENUM ('FeatureGroup', 'Feature', 'Component', 'Tab', 'State');

-- CreateEnum
CREATE TYPE "SpecRelationType" AS ENUM ('contains', 'depends_on', 'related_component', 'related_slot', 'related_figma', 'related_prototype_route', 'related_ai_task');

-- CreateEnum
CREATE TYPE "SpecStatus" AS ENUM ('Draft', 'Published', 'Archived');

-- CreateEnum
CREATE TYPE "RoleLevel" AS ENUM ('Viewer', 'TaskOwner', 'PrototypeOwner', 'ProjectOwner');

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folders" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "folder_id" TEXT,
    "type" "SpecType" NOT NULL,
    "title" TEXT NOT NULL,
    "task_owner_id" TEXT,
    "design_contact_id" TEXT,
    "prototype_contact_id" TEXT,
    "slot_owner_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "specs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spec_relations" (
    "id" TEXT NOT NULL,
    "from_id" TEXT NOT NULL,
    "to_id" TEXT NOT NULL,
    "type" "SpecRelationType" NOT NULL,

    CONSTRAINT "spec_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spec_versions" (
    "id" TEXT NOT NULL,
    "spec_id" TEXT NOT NULL,
    "version_label" TEXT NOT NULL,
    "status" "SpecStatus" NOT NULL DEFAULT 'Draft',
    "markdown" TEXT NOT NULL,
    "change_summary" TEXT,
    "change_type" TEXT,
    "created_by_id" TEXT NOT NULL,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spec_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revisions" (
    "id" TEXT NOT NULL,
    "spec_id" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "level" "RoleLevel" NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- CreateIndex
CREATE INDEX "folders_project_id_parent_id_idx" ON "folders"("project_id", "parent_id");

-- CreateIndex
CREATE INDEX "specs_project_id_folder_id_idx" ON "specs"("project_id", "folder_id");

-- CreateIndex
CREATE INDEX "spec_relations_to_id_type_idx" ON "spec_relations"("to_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "spec_relations_from_id_to_id_type_key" ON "spec_relations"("from_id", "to_id", "type");

-- CreateIndex
CREATE INDEX "spec_versions_spec_id_status_idx" ON "spec_versions"("spec_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "spec_versions_spec_id_version_label_key" ON "spec_versions"("spec_id", "version_label");

-- CreateIndex
CREATE INDEX "revisions_spec_id_created_at_idx" ON "revisions"("spec_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_project_id_key" ON "user_roles"("user_id", "project_id");

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "folders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specs" ADD CONSTRAINT "specs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specs" ADD CONSTRAINT "specs_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specs" ADD CONSTRAINT "specs_task_owner_id_fkey" FOREIGN KEY ("task_owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specs" ADD CONSTRAINT "specs_design_contact_id_fkey" FOREIGN KEY ("design_contact_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specs" ADD CONSTRAINT "specs_prototype_contact_id_fkey" FOREIGN KEY ("prototype_contact_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "specs" ADD CONSTRAINT "specs_slot_owner_id_fkey" FOREIGN KEY ("slot_owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spec_relations" ADD CONSTRAINT "spec_relations_from_id_fkey" FOREIGN KEY ("from_id") REFERENCES "specs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spec_relations" ADD CONSTRAINT "spec_relations_to_id_fkey" FOREIGN KEY ("to_id") REFERENCES "specs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spec_versions" ADD CONSTRAINT "spec_versions_spec_id_fkey" FOREIGN KEY ("spec_id") REFERENCES "specs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spec_versions" ADD CONSTRAINT "spec_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisions" ADD CONSTRAINT "revisions_spec_id_fkey" FOREIGN KEY ("spec_id") REFERENCES "specs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisions" ADD CONSTRAINT "revisions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
