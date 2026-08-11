-- Product.showInCatalog (visibilidade no catálogo online, independente de isActive)
ALTER TABLE "products" ADD COLUMN "showInCatalog" BOOLEAN NOT NULL DEFAULT true;
