-- Market intelligence: daily median asking price per marla per area, type and size band
-- (AreaPriceSnapshot). The crawler pipeline fills it; the market dashboard buckets it.

-- CreateTable
CREATE TABLE "intel"."area_price_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "locality_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "size_band" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "median_per_marla" DECIMAL(14,2) NOT NULL,
    "listings" INTEGER NOT NULL,

    CONSTRAINT "area_price_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "area_price_snapshots_category_size_band_day_idx" ON "intel"."area_price_snapshots"("category", "size_band", "day");

-- CreateIndex
CREATE UNIQUE INDEX "area_price_snapshots_locality_id_category_size_band_day_key" ON "intel"."area_price_snapshots"("locality_id", "category", "size_band", "day");
