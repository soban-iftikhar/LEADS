-- Areas screen: what kind of place a locality is (sector, housing society, other area).

-- AlterTable
ALTER TABLE "config"."localities" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'AREA';

ALTER TABLE "config"."localities" ADD CONSTRAINT "localities_kind_check" CHECK ("kind" IN ('SECTOR', 'SOCIETY', 'AREA'));
-- Islamabad sectors are named like G-13 or G-13/2; the rest default to AREA until an admin sets them
UPDATE "config"."localities" SET "kind" = 'SECTOR' WHERE "name" ~ '^[A-Z]-[0-9]+(/[0-9]+)?$';
UPDATE "config"."localities" SET "kind" = 'SOCIETY' WHERE "name" ~* '(bahria|dha|askari|gulraiz|chaklala|town|scheme)' AND "kind" = 'AREA';
