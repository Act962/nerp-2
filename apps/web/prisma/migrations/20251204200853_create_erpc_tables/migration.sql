-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE', 'BASIC', 'PREMIUM', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TRIAL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProductUnit" AS ENUM ('UN', 'KG', 'G', 'L', 'ML', 'M', 'M2', 'M3', 'CX', 'PC', 'PAR', 'DZ');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('ENTRADA', 'SAIDA', 'VENDA', 'COMPRA', 'DEVOLUCAO', 'AJUSTE', 'TRANSFERENCIA', 'PERDA');

-- CreateEnum
CREATE TYPE "PersonType" AS ENUM ('FISICA', 'JURIDICA');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('DINHEIRO', 'PIX', 'DEBITO', 'CREDITO', 'BOLETO', 'TRANSFERENCIA', 'OUTROS');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING', 'CONFIRMED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('BANCO', 'CAIXA', 'POUPANCA', 'INVESTIMENTO', 'OUTROS');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('RECEITA', 'DESPESA');

-- CreateEnum
CREATE TYPE "TransactionCategory" AS ENUM ('VENDAS', 'SERVICOS', 'OUTROS_RECEITAS', 'FORNECEDORES', 'SALARIOS', 'ALUGUEL', 'ENERGIA', 'AGUA', 'INTERNET', 'TELEFONE', 'IMPOSTOS', 'MARKETING', 'MANUTENCAO', 'OUTROS_DESPESAS');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- AlterTable
ALTER TABLE "session" ADD COLUMN     "activeOrganizationId" TEXT;

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "metadata" TEXT,
    "tradeName" TEXT,
    "document" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "subdomain" TEXT,
    "customDomain" TEXT,
    "address" TEXT,
    "addressNumber" TEXT,
    "complement" TEXT,
    "neighborhood" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'BR',
    "primaryColor" TEXT NOT NULL DEFAULT '#3b82f6',
    "plan" "PlanType" NOT NULL DEFAULT 'FREE',
    "status" "OrganizationStatus" NOT NULL DEFAULT 'TRIAL',
    "maxProducts" INTEGER NOT NULL DEFAULT 100,
    "maxUsers" INTEGER NOT NULL DEFAULT 3,
    "trialEndsAt" TIMESTAMP(3),
    "subscribedAt" TIMESTAMP(3),

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inviterId" TEXT NOT NULL,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "showPrices" BOOLEAN NOT NULL DEFAULT true,
    "showStock" BOOLEAN NOT NULL DEFAULT false,
    "allowOrders" BOOLEAN NOT NULL DEFAULT false,
    "whatsappNumber" TEXT,
    "showWhatsapp" BOOLEAN NOT NULL DEFAULT true,
    "contactEmail" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "bannerImage" TEXT,
    "aboutText" TEXT,
    "instagram" TEXT,
    "facebook" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sku" TEXT,
    "barcode" TEXT,
    "costPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "salePrice" DECIMAL(10,2) NOT NULL,
    "promotionalPrice" DECIMAL(10,2),
    "unit" "ProductUnit" NOT NULL DEFAULT 'UN',
    "currentStock" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "minStock" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "maxStock" DECIMAL(10,3),
    "images" TEXT[],
    "weight" DECIMAL(10,3),
    "length" DECIMAL(10,2),
    "width" DECIMAL(10,2),
    "height" DECIMAL(10,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "trackStock" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "previousStock" DECIMAL(10,3) NOT NULL,
    "newStock" DECIMAL(10,3) NOT NULL,
    "unitCost" DECIMAL(10,2),
    "saleId" TEXT,
    "purchaseId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "personType" "PersonType" NOT NULL DEFAULT 'FISICA',
    "document" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "addressNumber" TEXT,
    "complement" TEXT,
    "neighborhood" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tradeName" TEXT,
    "document" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "addressNumber" TEXT,
    "complement" TEXT,
    "neighborhood" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "contactPerson" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT,
    "invoiceNumber" TEXT,
    "saleNumber" INTEGER NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "shipping" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "paymentMethod" "PaymentMethod",
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierId" TEXT,
    "purchaseNumber" INTEGER NOT NULL,
    "invoiceNumber" TEXT,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "shipping" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_items" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_accounts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL DEFAULT 'CAIXA',
    "bank" TEXT,
    "agency" TEXT,
    "account" TEXT,
    "initialBalance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currentBalance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "category" "TransactionCategory" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "saleId" TEXT,
    "purchaseId" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringDay" INTEGER,
    "notes" TEXT,
    "attachment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "organization_document_key" ON "organization"("document");

-- CreateIndex
CREATE UNIQUE INDEX "organization_subdomain_key" ON "organization"("subdomain");

-- CreateIndex
CREATE UNIQUE INDEX "organization_customDomain_key" ON "organization"("customDomain");

-- CreateIndex
CREATE INDEX "organization_slug_idx" ON "organization"("slug");

-- CreateIndex
CREATE INDEX "organization_subdomain_idx" ON "organization"("subdomain");

-- CreateIndex
CREATE INDEX "organization_customDomain_idx" ON "organization"("customDomain");

-- CreateIndex
CREATE INDEX "organization_document_idx" ON "organization"("document");

-- CreateIndex
CREATE INDEX "organization_status_idx" ON "organization"("status");

-- CreateIndex
CREATE INDEX "member_organizationId_idx" ON "member"("organizationId");

-- CreateIndex
CREATE INDEX "member_userId_idx" ON "member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "member_organizationId_userId_key" ON "member"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "invitation_organizationId_idx" ON "invitation"("organizationId");

-- CreateIndex
CREATE INDEX "invitation_email_idx" ON "invitation"("email");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_settings_organizationId_key" ON "catalog_settings"("organizationId");

-- CreateIndex
CREATE INDEX "categories_organizationId_idx" ON "categories"("organizationId");

-- CreateIndex
CREATE INDEX "categories_parentId_idx" ON "categories"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_organizationId_slug_key" ON "categories"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "products_organizationId_idx" ON "products"("organizationId");

-- CreateIndex
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");

-- CreateIndex
CREATE INDEX "products_barcode_idx" ON "products"("barcode");

-- CreateIndex
CREATE INDEX "products_isActive_idx" ON "products"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "products_organizationId_slug_key" ON "products"("organizationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_organizationId_sku_key" ON "products"("organizationId", "sku");

-- CreateIndex
CREATE INDEX "stock_movements_organizationId_idx" ON "stock_movements"("organizationId");

-- CreateIndex
CREATE INDEX "stock_movements_productId_idx" ON "stock_movements"("productId");

-- CreateIndex
CREATE INDEX "stock_movements_type_idx" ON "stock_movements"("type");

-- CreateIndex
CREATE INDEX "stock_movements_createdAt_idx" ON "stock_movements"("createdAt");

-- CreateIndex
CREATE INDEX "stock_movements_saleId_idx" ON "stock_movements"("saleId");

-- CreateIndex
CREATE INDEX "stock_movements_purchaseId_idx" ON "stock_movements"("purchaseId");

-- CreateIndex
CREATE INDEX "customers_organizationId_idx" ON "customers"("organizationId");

-- CreateIndex
CREATE INDEX "customers_document_idx" ON "customers"("document");

-- CreateIndex
CREATE INDEX "customers_email_idx" ON "customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customers_organizationId_document_key" ON "customers"("organizationId", "document");

-- CreateIndex
CREATE INDEX "suppliers_organizationId_idx" ON "suppliers"("organizationId");

-- CreateIndex
CREATE INDEX "suppliers_document_idx" ON "suppliers"("document");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_organizationId_document_key" ON "suppliers"("organizationId", "document");

-- CreateIndex
CREATE INDEX "sales_organizationId_idx" ON "sales"("organizationId");

-- CreateIndex
CREATE INDEX "sales_customerId_idx" ON "sales"("customerId");

-- CreateIndex
CREATE INDEX "sales_status_idx" ON "sales"("status");

-- CreateIndex
CREATE INDEX "sales_createdAt_idx" ON "sales"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "sales_organizationId_saleNumber_key" ON "sales"("organizationId", "saleNumber");

-- CreateIndex
CREATE INDEX "sale_items_saleId_idx" ON "sale_items"("saleId");

-- CreateIndex
CREATE INDEX "sale_items_productId_idx" ON "sale_items"("productId");

-- CreateIndex
CREATE INDEX "purchases_organizationId_idx" ON "purchases"("organizationId");

-- CreateIndex
CREATE INDEX "purchases_supplierId_idx" ON "purchases"("supplierId");

-- CreateIndex
CREATE INDEX "purchases_status_idx" ON "purchases"("status");

-- CreateIndex
CREATE INDEX "purchases_orderDate_idx" ON "purchases"("orderDate");

-- CreateIndex
CREATE UNIQUE INDEX "purchases_organizationId_purchaseNumber_key" ON "purchases"("organizationId", "purchaseNumber");

-- CreateIndex
CREATE INDEX "purchase_items_purchaseId_idx" ON "purchase_items"("purchaseId");

-- CreateIndex
CREATE INDEX "purchase_items_productId_idx" ON "purchase_items"("productId");

-- CreateIndex
CREATE INDEX "financial_accounts_organizationId_idx" ON "financial_accounts"("organizationId");

-- CreateIndex
CREATE INDEX "financial_accounts_isActive_idx" ON "financial_accounts"("isActive");

-- CreateIndex
CREATE INDEX "transactions_organizationId_idx" ON "transactions"("organizationId");

-- CreateIndex
CREATE INDEX "transactions_accountId_idx" ON "transactions"("accountId");

-- CreateIndex
CREATE INDEX "transactions_type_idx" ON "transactions"("type");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "transactions_dueDate_idx" ON "transactions"("dueDate");

-- CreateIndex
CREATE INDEX "transactions_saleId_idx" ON "transactions"("saleId");

-- CreateIndex
CREATE INDEX "transactions_purchaseId_idx" ON "transactions"("purchaseId");

-- CreateIndex
CREATE INDEX "session_token_idx" ON "session"("token");

-- CreateIndex
CREATE INDEX "user_email_idx" ON "user"("email");

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_settings" ADD CONSTRAINT "catalog_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "purchases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
