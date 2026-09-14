-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('CONTACTED', 'REPLIED', 'DECLINED', 'FORM_SENT', 'FORM_SUBMITTED');

-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "listedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "prospects" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "waMessageId" TEXT,
    "status" "ProspectStatus" NOT NULL DEFAULT 'CONTACTED',
    "contactedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repliedAt" TIMESTAMP(3),
    "lastReplyText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospects_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
