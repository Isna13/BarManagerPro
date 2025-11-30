/*
  Warnings:

  - You are about to drop the column `entityId` on the `audit_logs` table. All the data in the column will be lost.
  - The `details` column on the `audit_logs` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `settings` column on the `branches` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `pointsMultiplier` on the `campaigns` table. All the data in the column will be lost.
  - You are about to drop the column `targetProducts` on the `campaigns` table. All the data in the column will be lost.
  - You are about to drop the column `usageCount` on the `campaigns` table. All the data in the column will be lost.
  - You are about to drop the column `usageLimit` on the `campaigns` table. All the data in the column will be lost.
  - The `targetSegment` column on the `campaigns` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `discountPercent` on the `campaigns` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(5,2)`.
  - You are about to drop the column `closingAmount` on the `cash_boxes` table. All the data in the column will be lost.
  - You are about to drop the column `closingNotes` on the `cash_boxes` table. All the data in the column will be lost.
  - You are about to drop the column `expectedAmount` on the `cash_boxes` table. All the data in the column will be lost.
  - You are about to drop the column `openingAmount` on the `cash_boxes` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `cash_boxes` table. All the data in the column will be lost.
  - You are about to drop the column `completedAt` on the `checklist_logs` table. All the data in the column will be lost.
  - You are about to drop the column `completedBy` on the `checklist_logs` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `checklist_templates` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `totalPurchases` on the `customers` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `debts` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `debts` table. All the data in the column will be lost.
  - You are about to alter the column `confidence` on the `forecast_items` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(5,2)`.
  - You are about to drop the column `createdBy` on the `inventory_movements` table. All the data in the column will be lost.
  - You are about to drop the column `qtyBoxes` on the `inventory_movements` table. All the data in the column will be lost.
  - You are about to drop the column `completedAt` on the `inventory_transfers` table. All the data in the column will be lost.
  - You are about to drop the column `completedBy` on the `inventory_transfers` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `inventory_transfers` table. All the data in the column will be lost.
  - You are about to drop the column `qtyBoxes` on the `inventory_transfers` table. All the data in the column will be lost.
  - You are about to drop the column `qtyUnits` on the `inventory_transfers` table. All the data in the column will be lost.
  - You are about to drop the column `stock` on the `loyalty_rewards` table. All the data in the column will be lost.
  - You are about to drop the column `value` on the `loyalty_rewards` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `loyalty_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `reason` on the `loyalty_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `saleId` on the `loyalty_transactions` table. All the data in the column will be lost.
  - You are about to drop the column `isRead` on the `notifications` table. All the data in the column will be lost.
  - The `metadata` column on the `notifications` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `reference` on the `payments` table. All the data in the column will be lost.
  - The `routeTypes` column on the `printers` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `changedAt` on the `product_price_history` table. All the data in the column will be lost.
  - You are about to drop the column `hasExpiration` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `minStock` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `shelfLifeDays` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `unitCost` on the `products` table. All the data in the column will be lost.
  - You are about to alter the column `minMarginPercent` on the `products` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(5,2)`.
  - You are about to alter the column `maxDiscountMuntu` on the `products` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(5,2)`.
  - You are about to alter the column `taxRate` on the `products` table. The data in that column could be lost. The data in that column will be cast from `Integer` to `Decimal(5,2)`.
  - You are about to drop the column `costPerUnit` on the `purchase_items` table. All the data in the column will be lost.
  - You are about to drop the column `totalCost` on the `purchase_items` table. All the data in the column will be lost.
  - You are about to drop the column `invoiceDate` on the `purchases` table. All the data in the column will be lost.
  - You are about to drop the column `invoiceNumber` on the `purchases` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `purchases` table. All the data in the column will be lost.
  - You are about to drop the column `discount` on the `sale_items` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `sales` table. All the data in the column will be lost.
  - You are about to drop the column `contact` on the `suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `entityType` on the `sync_conflicts` table. All the data in the column will be lost.
  - You are about to drop the column `attempts` on the `sync_queue` table. All the data in the column will be lost.
  - You are about to drop the column `entityType` on the `sync_queue` table. All the data in the column will be lost.
  - You are about to drop the column `syncedAt` on the `sync_queue` table. All the data in the column will be lost.
  - You are about to drop the column `capacity` on the `tables` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `tables` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `feedback` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[couponCode]` on the table `campaigns` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[boxNumber]` on the table `cash_boxes` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code]` on the table `customers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[debtNumber]` on the table `debts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[saleId]` on the table `debts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[productId,branchId,batchNumber]` on the table `inventory_items` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code]` on the table `suppliers` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[qrCode]` on the table `tables` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `boxNumber` to the `cash_boxes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `openedBy` to the `cash_boxes` table without a default value. This is not possible if the table is not empty.
  - Added the required column `performedBy` to the `checklist_logs` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `responses` on the `checklist_logs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `category` to the `checklist_templates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `frequency` to the `checklist_templates` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `items` on the `checklist_templates` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `code` to the `customers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fullName` to the `customers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdBy` to the `debts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `debtNumber` to the `debts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `originalAmount` to the `debts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `forecast_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `inventory_transfers` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `items` on the `inventory_transfers` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `pointsCost` to the `loyalty_rewards` table without a default value. This is not possible if the table is not empty.
  - Made the column `userId` on table `notifications` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `total` to the `purchase_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdBy` to the `purchases` table without a default value. This is not possible if the table is not empty.
  - Added the required column `taxAmount` to the `sale_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `unitCost` to the `sale_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `sale_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cashierId` to the `sales` table without a default value. This is not possible if the table is not empty.
  - Added the required column `code` to the `suppliers` table without a default value. This is not possible if the table is not empty.
  - Added the required column `deviceId` to the `sync_conflicts` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `localData` on the `sync_conflicts` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `remoteData` on the `sync_conflicts` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `deviceId` on table `sync_queue` required. This step will fail if there are existing NULL values in that column.
  - Changed the type of `data` on the `sync_queue` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "cash_boxes" DROP CONSTRAINT "cash_boxes_userId_fkey";

-- DropForeignKey
ALTER TABLE "categories" DROP CONSTRAINT "categories_parentId_fkey";

-- DropForeignKey
ALTER TABLE "checklist_logs" DROP CONSTRAINT "checklist_logs_templateId_fkey";

-- DropForeignKey
ALTER TABLE "customers" DROP CONSTRAINT "customers_branchId_fkey";

-- DropForeignKey
ALTER TABLE "debts" DROP CONSTRAINT "debts_branchId_fkey";

-- DropForeignKey
ALTER TABLE "debts" DROP CONSTRAINT "debts_customerId_fkey";

-- DropForeignKey
ALTER TABLE "debts" DROP CONSTRAINT "debts_userId_fkey";

-- DropForeignKey
ALTER TABLE "feedback" DROP CONSTRAINT "feedback_branchId_fkey";

-- DropForeignKey
ALTER TABLE "feedback" DROP CONSTRAINT "feedback_customerId_fkey";

-- DropForeignKey
ALTER TABLE "feedback" DROP CONSTRAINT "feedback_saleId_fkey";

-- DropForeignKey
ALTER TABLE "inventory_transfers" DROP CONSTRAINT "inventory_transfers_productId_fkey";

-- DropForeignKey
ALTER TABLE "loyalty_transactions" DROP CONSTRAINT "loyalty_transactions_saleId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_userId_fkey";

-- DropForeignKey
ALTER TABLE "purchases" DROP CONSTRAINT "purchases_userId_fkey";

-- DropForeignKey
ALTER TABLE "sales" DROP CONSTRAINT "sales_userId_fkey";

-- DropForeignKey
ALTER TABLE "suppliers" DROP CONSTRAINT "suppliers_branchId_fkey";

-- DropForeignKey
ALTER TABLE "sync_conflicts" DROP CONSTRAINT "sync_conflicts_branchId_fkey";

-- DropForeignKey
ALTER TABLE "sync_queue" DROP CONSTRAINT "sync_queue_branchId_fkey";

-- DropIndex
DROP INDEX "audit_logs_entity_idx";

-- DropIndex
DROP INDEX "audit_logs_resource_idx";

-- DropIndex
DROP INDEX "campaigns_branchId_idx";

-- DropIndex
DROP INDEX "campaigns_startDate_idx";

-- DropIndex
DROP INDEX "cash_boxes_userId_idx";

-- DropIndex
DROP INDEX "debts_branchId_idx";

-- DropIndex
DROP INDEX "inventory_items_productId_branchId_key";

-- DropIndex
DROP INDEX "inventory_transfers_productId_idx";

-- DropIndex
DROP INDEX "loyalty_rewards_pointsRequired_idx";

-- DropIndex
DROP INDEX "loyalty_transactions_saleId_idx";

-- DropIndex
DROP INDEX "notifications_branchId_idx";

-- DropIndex
DROP INDEX "notifications_isRead_idx";

-- DropIndex
DROP INDEX "sales_userId_idx";

-- DropIndex
DROP INDEX "sync_conflicts_entityType_idx";

-- DropIndex
DROP INDEX "sync_conflicts_resolution_idx";

-- DropIndex
DROP INDEX "sync_queue_branchId_idx";

-- DropIndex
DROP INDEX "sync_queue_entityType_idx";

-- DropIndex
DROP INDEX "sync_queue_priority_idx";

-- DropIndex
DROP INDEX "users_role_idx";

-- AlterTable
ALTER TABLE "audit_logs" DROP COLUMN "entityId",
ADD COLUMN     "userAgent" TEXT,
DROP COLUMN "details",
ADD COLUMN     "details" JSONB;

-- AlterTable
ALTER TABLE "branches" DROP COLUMN "settings",
ADD COLUMN     "settings" JSONB;

-- AlterTable
ALTER TABLE "campaigns" DROP COLUMN "pointsMultiplier",
DROP COLUMN "targetProducts",
DROP COLUMN "usageCount",
DROP COLUMN "usageLimit",
ADD COLUMN     "couponCode" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "loyaltyPoints" INTEGER,
ADD COLUMN     "maxUses" INTEGER,
ADD COLUMN     "usedCount" INTEGER NOT NULL DEFAULT 0,
DROP COLUMN "targetSegment",
ADD COLUMN     "targetSegment" JSONB,
ALTER COLUMN "discountPercent" SET DATA TYPE DECIMAL(5,2);

-- AlterTable
ALTER TABLE "cash_boxes" DROP COLUMN "closingAmount",
DROP COLUMN "closingNotes",
DROP COLUMN "expectedAmount",
DROP COLUMN "openingAmount",
DROP COLUMN "userId",
ADD COLUMN     "boxNumber" TEXT NOT NULL,
ADD COLUMN     "closedBy" TEXT,
ADD COLUMN     "closingCash" INTEGER,
ADD COLUMN     "openedBy" TEXT NOT NULL,
ADD COLUMN     "openingCash" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalCard" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalCash" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalDebt" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalMobileMoney" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalSales" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "checklist_logs" DROP COLUMN "completedAt",
DROP COLUMN "completedBy",
ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "performedBy" TEXT NOT NULL,
DROP COLUMN "responses",
ADD COLUMN     "responses" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "checklist_templates" DROP COLUMN "type",
ADD COLUMN     "category" TEXT NOT NULL,
ADD COLUMN     "frequency" TEXT NOT NULL,
DROP COLUMN "items",
ADD COLUMN     "items" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "name",
DROP COLUMN "totalPurchases",
ADD COLUMN     "blockReason" TEXT,
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "fullName" TEXT NOT NULL,
ADD COLUMN     "totalSpent" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "branchId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "debts" DROP COLUMN "description",
DROP COLUMN "userId",
ADD COLUMN     "createdBy" TEXT NOT NULL,
ADD COLUMN     "debtNumber" TEXT NOT NULL,
ADD COLUMN     "originalAmount" INTEGER NOT NULL,
ADD COLUMN     "paidAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "saleId" TEXT,
ALTER COLUMN "status" SET DEFAULT 'open';

-- AlterTable
ALTER TABLE "forecast_items" ADD COLUMN     "suggestReorder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suggestedQty" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "confidence" SET DATA TYPE DECIMAL(5,2);

-- AlterTable
ALTER TABLE "inventory_items" ADD COLUMN     "batchNumber" TEXT,
ADD COLUMN     "expiryDate" TIMESTAMP(3),
ADD COLUMN     "lastCountBy" TEXT,
ADD COLUMN     "location" TEXT,
ALTER COLUMN "minStock" SET DEFAULT 10;

-- AlterTable
ALTER TABLE "inventory_movements" DROP COLUMN "createdBy",
DROP COLUMN "qtyBoxes",
ADD COLUMN     "performedBy" TEXT;

-- AlterTable
ALTER TABLE "inventory_transfers" DROP COLUMN "completedAt",
DROP COLUMN "completedBy",
DROP COLUMN "productId",
DROP COLUMN "qtyBoxes",
DROP COLUMN "qtyUnits",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "receivedAt" TIMESTAMP(3),
ADD COLUMN     "receivedBy" TEXT,
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "sentBy" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "items",
ADD COLUMN     "items" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "loyalty_rewards" DROP COLUMN "stock",
DROP COLUMN "value",
ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "pointsCost" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "loyalty_transactions" DROP COLUMN "description",
DROP COLUMN "reason",
DROP COLUMN "saleId",
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "referenceType" TEXT;

-- AlterTable
ALTER TABLE "notifications" DROP COLUMN "isRead",
ADD COLUMN     "read" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "userId" SET NOT NULL,
DROP COLUMN "metadata",
ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "payments" DROP COLUMN "reference",
ADD COLUMN     "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "referenceNumber" TEXT,
ADD COLUMN     "transactionId" TEXT;

-- AlterTable
ALTER TABLE "printers" ADD COLUMN     "model" TEXT,
ALTER COLUMN "ipAddress" DROP NOT NULL,
ALTER COLUMN "port" DROP NOT NULL,
ALTER COLUMN "port" DROP DEFAULT,
DROP COLUMN "routeTypes",
ADD COLUMN     "routeTypes" TEXT[];

-- AlterTable
ALTER TABLE "product_price_history" DROP COLUMN "changedAt",
ADD COLUMN     "changedBy" TEXT,
ADD COLUMN     "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "effectiveTo" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "products" DROP COLUMN "hasExpiration",
DROP COLUMN "minStock",
DROP COLUMN "shelfLifeDays",
DROP COLUMN "unitCost",
ADD COLUMN     "allowFractions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "expiryDays" INTEGER,
ADD COLUMN     "hasExpiry" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isMuntuEligible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "preparationTime" INTEGER,
ADD COLUMN     "productionStation" TEXT,
ALTER COLUMN "minMarginPercent" SET DEFAULT 0,
ALTER COLUMN "minMarginPercent" SET DATA TYPE DECIMAL(5,2),
ALTER COLUMN "maxDiscountMuntu" SET DEFAULT 0,
ALTER COLUMN "maxDiscountMuntu" SET DATA TYPE DECIMAL(5,2),
ALTER COLUMN "taxRate" SET DEFAULT 0,
ALTER COLUMN "taxRate" SET DATA TYPE DECIMAL(5,2);

-- AlterTable
ALTER TABLE "purchase_items" DROP COLUMN "costPerUnit",
DROP COLUMN "totalCost",
ADD COLUMN     "batchNumber" TEXT,
ADD COLUMN     "boxCost" INTEGER,
ADD COLUMN     "expiryDate" TIMESTAMP(3),
ADD COLUMN     "taxAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "total" INTEGER NOT NULL,
ALTER COLUMN "qtyUnits" DROP DEFAULT,
ALTER COLUMN "unitCost" DROP DEFAULT;

-- AlterTable
ALTER TABLE "purchases" DROP COLUMN "invoiceDate",
DROP COLUMN "invoiceNumber",
DROP COLUMN "userId",
ADD COLUMN     "createdBy" TEXT NOT NULL,
ADD COLUMN     "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "subtotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxTotal" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "total" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "sale_items" DROP COLUMN "discount",
ADD COLUMN     "discountAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "productionStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "readyAt" TIMESTAMP(3),
ADD COLUMN     "sentToKitchenAt" TIMESTAMP(3),
ADD COLUMN     "servedAt" TIMESTAMP(3),
ADD COLUMN     "taxAmount" INTEGER NOT NULL,
ADD COLUMN     "unitCost" INTEGER NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "sales" DROP COLUMN "userId",
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cashierId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "suppliers" DROP COLUMN "contact",
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paymentTerms" TEXT,
ALTER COLUMN "branchId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "sync_conflicts" DROP COLUMN "entityType",
ADD COLUMN     "deviceId" TEXT NOT NULL,
DROP COLUMN "localData",
ADD COLUMN     "localData" JSONB NOT NULL,
DROP COLUMN "remoteData",
ADD COLUMN     "remoteData" JSONB NOT NULL,
ALTER COLUMN "resolution" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sync_queue" DROP COLUMN "attempts",
DROP COLUMN "entityType",
DROP COLUMN "syncedAt",
ADD COLUMN     "processedAt" TIMESTAMP(3),
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "deviceId" SET NOT NULL,
DROP COLUMN "data",
ADD COLUMN     "data" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "tables" DROP COLUMN "capacity",
DROP COLUMN "name",
ADD COLUMN     "area" TEXT,
ADD COLUMN     "qrCode" TEXT,
ADD COLUMN     "seats" INTEGER NOT NULL DEFAULT 4;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "name",
DROP COLUMN "role",
ADD COLUMN     "roleId" TEXT,
ADD COLUMN     "roleName" TEXT,
ALTER COLUMN "fullName" DROP DEFAULT;

-- DropTable
DROP TABLE "feedback";

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_feedbacks" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "category" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedbacks" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "saleId" TEXT,
    "branchId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backups" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "branchId" TEXT,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PermissionToRole" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_resource_action_key" ON "permissions"("resource", "action");

-- CreateIndex
CREATE INDEX "customer_feedbacks_rating_idx" ON "customer_feedbacks"("rating");

-- CreateIndex
CREATE INDEX "customer_feedbacks_submittedAt_idx" ON "customer_feedbacks"("submittedAt");

-- CreateIndex
CREATE INDEX "feedbacks_customerId_idx" ON "feedbacks"("customerId");

-- CreateIndex
CREATE INDEX "feedbacks_saleId_idx" ON "feedbacks"("saleId");

-- CreateIndex
CREATE INDEX "feedbacks_branchId_idx" ON "feedbacks"("branchId");

-- CreateIndex
CREATE INDEX "backups_branchId_idx" ON "backups"("branchId");

-- CreateIndex
CREATE INDEX "backups_createdAt_idx" ON "backups"("createdAt");

-- CreateIndex
CREATE INDEX "attachments_entityType_entityId_idx" ON "attachments"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "_PermissionToRole_AB_unique" ON "_PermissionToRole"("A", "B");

-- CreateIndex
CREATE INDEX "_PermissionToRole_B_index" ON "_PermissionToRole"("B");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_couponCode_key" ON "campaigns"("couponCode");

-- CreateIndex
CREATE INDEX "campaigns_couponCode_idx" ON "campaigns"("couponCode");

-- CreateIndex
CREATE INDEX "campaigns_startDate_endDate_idx" ON "campaigns"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "cash_boxes_boxNumber_key" ON "cash_boxes"("boxNumber");

-- CreateIndex
CREATE INDEX "checklist_logs_performedAt_idx" ON "checklist_logs"("performedAt");

-- CreateIndex
CREATE UNIQUE INDEX "customers_code_key" ON "customers"("code");

-- CreateIndex
CREATE INDEX "customers_code_idx" ON "customers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "debts_debtNumber_key" ON "debts"("debtNumber");

-- CreateIndex
CREATE UNIQUE INDEX "debts_saleId_key" ON "debts"("saleId");

-- CreateIndex
CREATE INDEX "inventory_items_productId_idx" ON "inventory_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_productId_branchId_batchNumber_key" ON "inventory_items"("productId", "branchId", "batchNumber");

-- CreateIndex
CREATE INDEX "loyalty_rewards_branchId_idx" ON "loyalty_rewards"("branchId");

-- CreateIndex
CREATE INDEX "loyalty_transactions_createdAt_idx" ON "loyalty_transactions"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_read_idx" ON "notifications"("read");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "payments_debtId_idx" ON "payments"("debtId");

-- CreateIndex
CREATE INDEX "products_barcode_idx" ON "products"("barcode");

-- CreateIndex
CREATE INDEX "sales_saleNumber_idx" ON "sales"("saleNumber");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_code_key" ON "suppliers"("code");

-- CreateIndex
CREATE INDEX "suppliers_code_idx" ON "suppliers"("code");

-- CreateIndex
CREATE INDEX "sync_conflicts_deviceId_idx" ON "sync_conflicts"("deviceId");

-- CreateIndex
CREATE INDEX "sync_conflicts_entity_entityId_idx" ON "sync_conflicts"("entity", "entityId");

-- CreateIndex
CREATE INDEX "sync_queue_priority_createdAt_idx" ON "sync_queue"("priority", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "tables_qrCode_key" ON "tables"("qrCode");

-- CreateIndex
CREATE INDEX "tables_branchId_idx" ON "tables"("branchId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_boxes" ADD CONSTRAINT "cash_boxes_openedBy_fkey" FOREIGN KEY ("openedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_feedbacks" ADD CONSTRAINT "customer_feedbacks_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_logs" ADD CONSTRAINT "checklist_logs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "checklist_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_A_fkey" FOREIGN KEY ("A") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PermissionToRole" ADD CONSTRAINT "_PermissionToRole_B_fkey" FOREIGN KEY ("B") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
