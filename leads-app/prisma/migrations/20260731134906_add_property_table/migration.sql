-- CreateEnum
CREATE TYPE "Role" AS ENUM ('BUYER', 'SELLER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Purpose" AS ENUM ('SALE', 'RENT');

-- CreateEnum
CREATE TYPE "SizeUnit" AS ENUM ('MARLA', 'KANAL', 'SQFT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('PENDING_AI_REVIEW', 'ACTIVE', 'PAUSED', 'DELETED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "passwordResetToken" TEXT,
    "passwordResetExpiresAt" TIMESTAMP(3),
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailOtpHash" TEXT,
    "emailOtpExpiresAt" TIMESTAMP(3),
    "phoneOtpHash" TEXT,
    "phoneOtpExpiresAt" TIMESTAMP(3),
    "otpAttempts" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "purpose" "Purpose" NOT NULL,
    "city" TEXT NOT NULL,
    "locality" TEXT NOT NULL,
    "size" DOUBLE PRECISION NOT NULL,
    "sizeUnit" "SizeUnit" NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "description" TEXT NOT NULL,
    "images" TEXT[],
    "status" "ListingStatus" NOT NULL DEFAULT 'PENDING_AI_REVIEW',
    "originalDesc" TEXT,
    "aiEnhancedDesc" TEXT,
    "sellerId" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "purpose" "Purpose",
    "price" TEXT NOT NULL,
    "priceNumeric" DOUBLE PRECISION NOT NULL,
    "size" TEXT NOT NULL,
    "sizeNumeric" DOUBLE PRECISION NOT NULL,
    "sizeUnit" "SizeUnit" NOT NULL,
    "city" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "locality" TEXT NOT NULL,
    "bedrooms" INTEGER NOT NULL DEFAULT 0,
    "bathrooms" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "amenities" TEXT[],
    "sellerName" TEXT,
    "agencyName" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "agencyProfileUrl" TEXT,
    "addedDate" TEXT,
    "isProject" BOOLEAN NOT NULL DEFAULT false,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "listings_city_category_purpose_idx" ON "listings"("city", "category", "purpose");

-- CreateIndex
CREATE INDEX "properties_city_category_purpose_idx" ON "properties"("city", "category", "purpose");

-- CreateIndex
CREATE INDEX "properties_priceNumeric_idx" ON "properties"("priceNumeric");

-- CreateIndex
CREATE INDEX "properties_scrapedAt_idx" ON "properties"("scrapedAt");

-- CreateIndex
CREATE UNIQUE INDEX "properties_platform_listingId_key" ON "properties"("platform", "listingId");

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
