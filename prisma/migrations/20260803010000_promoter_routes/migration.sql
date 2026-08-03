-- Rota do promotor: a ordem em que ele planeja visitar as lojas. Uma por
-- promotor. Não confundir com `promoter_stores`, que é permissão da coordenação.
CREATE TABLE "promoter_routes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Minha rota',
    "optimizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "promoter_routes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "promoter_routes_memberId_key" ON "promoter_routes"("memberId");
CREATE INDEX "promoter_routes_organizationId_idx" ON "promoter_routes"("organizationId");

ALTER TABLE "promoter_routes" ADD CONSTRAINT "promoter_routes_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promoter_routes" ADD CONSTRAINT "promoter_routes_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "promoter_route_stops" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "storeId" TEXT,
    "directoryStoreId" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "promoter_route_stops_pkey" PRIMARY KEY ("id")
);

-- Os dois únicos funcionam porque o Postgres trata NULL como distinto: muitas
-- paradas de catálogo convivem com "storeId" nulo sem colidir entre si, mas a
-- mesma loja duas vezes na mesma rota é barrada.
CREATE UNIQUE INDEX "promoter_route_stops_routeId_storeId_key" ON "promoter_route_stops"("routeId", "storeId");
CREATE UNIQUE INDEX "promoter_route_stops_routeId_directoryStoreId_key" ON "promoter_route_stops"("routeId", "directoryStoreId");
CREATE INDEX "promoter_route_stops_routeId_position_idx" ON "promoter_route_stops"("routeId", "position");
CREATE INDEX "promoter_route_stops_organizationId_idx" ON "promoter_route_stops"("organizationId");

-- "Exatamente um dos dois". O Prisma não expressa; o Postgres sim. `<>` entre
-- booleanos é XOR. O Prisma também não CONHECE este CHECK, então a mesma regra
-- é espelhada no zod para o usuário receber uma frase, não um stack trace.
ALTER TABLE "promoter_route_stops" ADD CONSTRAINT "promoter_route_stops_target_xor"
    CHECK (("storeId" IS NOT NULL) <> ("directoryStoreId" IS NOT NULL));

ALTER TABLE "promoter_route_stops" ADD CONSTRAINT "promoter_route_stops_routeId_fkey"
    FOREIGN KEY ("routeId") REFERENCES "promoter_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promoter_route_stops" ADD CONSTRAINT "promoter_route_stops_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "promoter_route_stops" ADD CONSTRAINT "promoter_route_stops_directoryStoreId_fkey"
    FOREIGN KEY ("directoryStoreId") REFERENCES "directory_stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
