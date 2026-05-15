-- SpecType enum 에서 Tab 제거 (D-032).
-- PostgreSQL 은 enum 값 직접 삭제 불가 — enum recreate 패턴.

ALTER TYPE "SpecType" RENAME TO "SpecType_old";

CREATE TYPE "SpecType" AS ENUM ('FeatureGroup', 'Feature', 'Component', 'State');

ALTER TABLE "specs"
  ALTER COLUMN "type" TYPE "SpecType"
  USING "type"::text::"SpecType";

DROP TYPE "SpecType_old";
