-- Força de Vendas ÓRBITA — MVP (specs/forca-vendas-orbita.md).
-- Só acréscimos: campos novos em customers/sales/sale_items, a origem
-- FORCA_VENDAS e as tabelas do módulo (carteira, política comercial, flex,
-- condições de pagamento, pedido de campo, roteiro, jornada, localização,
-- visita e avisos do gestor). Idempotente porque o banco de dev é compartilhado.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CarteiraOrigem" AS ENUM ('MANUAL', 'IMPORTACAO', 'ERP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "TipoPedidoFv" AS ENUM ('VENDA', 'ORCAMENTO', 'BONIFICACAO', 'TROCA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "MotivoAprovacaoPedido" AS ENUM ('DESCONTO', 'LIMITE_CREDITO', 'INADIMPLENTE', 'CLIENTE_BLOQUEADO', 'BONIFICACAO', 'FLEX_NEGATIVO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "DestinoPedido" AS ENUM ('NATIVO', 'WINTHOR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "StatusEnvioDestino" AS ENUM ('PENDENTE', 'ACEITO', 'RECUSADO', 'ERRO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "TipoLancamentoFlex" AS ENUM ('PEDIDO', 'ESTORNO', 'AJUSTE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ResultadoVisita" AS ENUM ('PEDIDO', 'SEM_PEDIDO', 'FECHADO', 'AUSENTE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PrioridadeAviso" AS ENUM ('NORMAL', 'IMPORTANTE', 'URGENTE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PublicoAviso" AS ENUM ('TODOS', 'MEMBROS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterEnum
ALTER TYPE "SaleOrigin" ADD VALUE IF NOT EXISTS 'FORCA_VENDAS';

-- AlterTable
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "birthDate" DATE,
ADD COLUMN IF NOT EXISTS "blockedReason" TEXT,
ADD COLUMN IF NOT EXISTS "creditLimit" DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS "erpCode" TEXT,
ADD COLUMN IF NOT EXISTS "isBlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "segment" TEXT,
ADD COLUMN IF NOT EXISTS "stateRegistration" TEXT,
ADD COLUMN IF NOT EXISTS "tradeName" TEXT;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "sellerMemberId" TEXT;

-- AlterTable
ALTER TABLE "sale_items" ADD COLUMN IF NOT EXISTS "requestedQuantity" DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS "tableUnitPrice" DECIMAL(10,2);

-- CreateTable
CREATE TABLE IF NOT EXISTS "configuracoes_forca_vendas" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "desconto_livre_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "desconto_maximo_percent" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "flex_credito_percent" DECIMAL(5,2) NOT NULL DEFAULT 50,
    "flex_limite_negativo" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "auto_aprovar" BOOLEAN NOT NULL DEFAULT true,
    "bloquear_inadimplente" BOOLEAN NOT NULL DEFAULT true,
    "raio_checkin_metros" INTEGER NOT NULL DEFAULT 300,
    "retencao_localizacao_dias" INTEGER NOT NULL DEFAULT 90,
    "destino_pedido" "DestinoPedido" NOT NULL DEFAULT 'NATIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_forca_vendas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "vendedores_perfil" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "codigo" TEXT,
    "desconto_maximo_percent" DECIMAL(5,2),
    "flex_limite_negativo" DECIMAL(12,2),
    "saldo_flex" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "ultima_latitude" DOUBLE PRECISION,
    "ultima_longitude" DOUBLE PRECISION,
    "ultima_precisao_m" DOUBLE PRECISION,
    "ultima_bateria" INTEGER,
    "ultima_posicao_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendedores_perfil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "lancamentos_flex" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "perfil_id" TEXT NOT NULL,
    "tipo" "TipoLancamentoFlex" NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "saldo_apos" DECIMAL(12,2) NOT NULL,
    "sale_id" TEXT,
    "descricao" TEXT NOT NULL,
    "criado_por_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lancamentos_flex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "carteiras_clientes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT true,
    "origem" "CarteiraOrigem" NOT NULL DEFAULT 'MANUAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carteiras_clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "condicoes_pagamento" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "prazos_dias" INTEGER[],
    "forma_pagamento" "PaymentMethod" NOT NULL DEFAULT 'BOLETO',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "condicoes_pagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pedidos_forca_vendas" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "member_id" TEXT,
    "tipo" "TipoPedidoFv" NOT NULL DEFAULT 'VENDA',
    "condicao_pagamento_id" TEXT,
    "visita_id" TEXT,
    "motivos_aprovacao" "MotivoAprovacaoPedido"[],
    "decidido_por_id" TEXT,
    "decidido_em" TIMESTAMP(3),
    "motivo_recusa" TEXT,
    "flex_previsto" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "capturado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "destino" "DestinoPedido" NOT NULL DEFAULT 'NATIVO',
    "status_destino" "StatusEnvioDestino" NOT NULL DEFAULT 'PENDENTE',
    "referencia_destino" TEXT,
    "erro_destino" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_forca_vendas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "roteiros_visita" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "dia_semana" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roteiros_visita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "jornadas_vendedor" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "iniciada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "encerrada_em" TIMESTAMP(3),

    CONSTRAINT "jornadas_vendedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "localizacoes_vendedor" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "jornada_id" TEXT,
    "capturado_em" TIMESTAMP(3) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "precisao_m" DOUBLE PRECISION,
    "bateria" INTEGER,
    "origem" TEXT NOT NULL DEFAULT 'PING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "localizacoes_vendedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "visitas_clientes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "client_operation_id" TEXT,
    "checkin_em" TIMESTAMP(3) NOT NULL,
    "checkin_latitude" DOUBLE PRECISION,
    "checkin_longitude" DOUBLE PRECISION,
    "checkin_precisao_m" DOUBLE PRECISION,
    "distancia_cliente_m" INTEGER,
    "fora_do_raio" BOOLEAN NOT NULL DEFAULT false,
    "justificativa" TEXT,
    "checkout_em" TIMESTAMP(3),
    "checkout_latitude" DOUBLE PRECISION,
    "checkout_longitude" DOUBLE PRECISION,
    "resultado" "ResultadoVisita",
    "motivo_sem_pedido" TEXT,
    "observacao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visitas_clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "avisos_gestor" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "autor_id" TEXT,
    "titulo" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "link" TEXT,
    "prioridade" "PrioridadeAviso" NOT NULL DEFAULT 'NORMAL',
    "exige_confirmacao" BOOLEAN NOT NULL DEFAULT false,
    "publico" "PublicoAviso" NOT NULL DEFAULT 'TODOS',
    "inicio_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fim_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "avisos_gestor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "avisos_gestor_leituras" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "aviso_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "visualizado_em" TIMESTAMP(3),
    "confirmado_em" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "avisos_gestor_leituras_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "configuracoes_forca_vendas_organization_id_key" ON "configuracoes_forca_vendas"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "vendedores_perfil_member_id_key" ON "vendedores_perfil"("member_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vendedores_perfil_organization_id_idx" ON "vendedores_perfil"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "lancamentos_flex_organization_id_perfil_id_created_at_idx" ON "lancamentos_flex"("organization_id", "perfil_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "lancamentos_flex_sale_id_tipo_key" ON "lancamentos_flex"("sale_id", "tipo");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "carteiras_clientes_organization_id_member_id_idx" ON "carteiras_clientes"("organization_id", "member_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "carteiras_clientes_customer_id_member_id_key" ON "carteiras_clientes"("customer_id", "member_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "condicoes_pagamento_organization_id_idx" ON "condicoes_pagamento"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "pedidos_forca_vendas_sale_id_key" ON "pedidos_forca_vendas"("sale_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pedidos_forca_vendas_organization_id_member_id_idx" ON "pedidos_forca_vendas"("organization_id", "member_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "roteiros_visita_organization_id_member_id_dia_semana_idx" ON "roteiros_visita"("organization_id", "member_id", "dia_semana");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "roteiros_visita_member_id_customer_id_dia_semana_key" ON "roteiros_visita"("member_id", "customer_id", "dia_semana");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "jornadas_vendedor_organization_id_member_id_iniciada_em_idx" ON "jornadas_vendedor"("organization_id", "member_id", "iniciada_em");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "localizacoes_vendedor_organization_id_member_id_capturado_e_idx" ON "localizacoes_vendedor"("organization_id", "member_id", "capturado_em");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "localizacoes_vendedor_member_id_capturado_em_key" ON "localizacoes_vendedor"("member_id", "capturado_em");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "visitas_clientes_client_operation_id_key" ON "visitas_clientes"("client_operation_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "visitas_clientes_organization_id_member_id_checkin_em_idx" ON "visitas_clientes"("organization_id", "member_id", "checkin_em");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "visitas_clientes_customer_id_idx" ON "visitas_clientes"("customer_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "avisos_gestor_organization_id_inicio_em_idx" ON "avisos_gestor"("organization_id", "inicio_em");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "avisos_gestor_leituras_organization_id_member_id_idx" ON "avisos_gestor_leituras"("organization_id", "member_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "avisos_gestor_leituras_aviso_id_member_id_key" ON "avisos_gestor_leituras"("aviso_id", "member_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "customers_organizationId_erpCode_idx" ON "customers"("organizationId", "erpCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sales_organizationId_sellerMemberId_idx" ON "sales"("organizationId", "sellerMemberId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "sales" ADD CONSTRAINT "sales_sellerMemberId_fkey" FOREIGN KEY ("sellerMemberId") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "configuracoes_forca_vendas" ADD CONSTRAINT "configuracoes_forca_vendas_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "vendedores_perfil" ADD CONSTRAINT "vendedores_perfil_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "vendedores_perfil" ADD CONSTRAINT "vendedores_perfil_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "lancamentos_flex" ADD CONSTRAINT "lancamentos_flex_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "lancamentos_flex" ADD CONSTRAINT "lancamentos_flex_perfil_id_fkey" FOREIGN KEY ("perfil_id") REFERENCES "vendedores_perfil"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "lancamentos_flex" ADD CONSTRAINT "lancamentos_flex_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "carteiras_clientes" ADD CONSTRAINT "carteiras_clientes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "carteiras_clientes" ADD CONSTRAINT "carteiras_clientes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "carteiras_clientes" ADD CONSTRAINT "carteiras_clientes_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "condicoes_pagamento" ADD CONSTRAINT "condicoes_pagamento_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "pedidos_forca_vendas" ADD CONSTRAINT "pedidos_forca_vendas_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "pedidos_forca_vendas" ADD CONSTRAINT "pedidos_forca_vendas_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "pedidos_forca_vendas" ADD CONSTRAINT "pedidos_forca_vendas_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "pedidos_forca_vendas" ADD CONSTRAINT "pedidos_forca_vendas_condicao_pagamento_id_fkey" FOREIGN KEY ("condicao_pagamento_id") REFERENCES "condicoes_pagamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "pedidos_forca_vendas" ADD CONSTRAINT "pedidos_forca_vendas_visita_id_fkey" FOREIGN KEY ("visita_id") REFERENCES "visitas_clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "roteiros_visita" ADD CONSTRAINT "roteiros_visita_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "roteiros_visita" ADD CONSTRAINT "roteiros_visita_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "roteiros_visita" ADD CONSTRAINT "roteiros_visita_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "jornadas_vendedor" ADD CONSTRAINT "jornadas_vendedor_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "jornadas_vendedor" ADD CONSTRAINT "jornadas_vendedor_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "localizacoes_vendedor" ADD CONSTRAINT "localizacoes_vendedor_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "localizacoes_vendedor" ADD CONSTRAINT "localizacoes_vendedor_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "localizacoes_vendedor" ADD CONSTRAINT "localizacoes_vendedor_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "jornadas_vendedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "visitas_clientes" ADD CONSTRAINT "visitas_clientes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "visitas_clientes" ADD CONSTRAINT "visitas_clientes_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "visitas_clientes" ADD CONSTRAINT "visitas_clientes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "avisos_gestor" ADD CONSTRAINT "avisos_gestor_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "avisos_gestor" ADD CONSTRAINT "avisos_gestor_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "avisos_gestor_leituras" ADD CONSTRAINT "avisos_gestor_leituras_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "avisos_gestor_leituras" ADD CONSTRAINT "avisos_gestor_leituras_aviso_id_fkey" FOREIGN KEY ("aviso_id") REFERENCES "avisos_gestor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "avisos_gestor_leituras" ADD CONSTRAINT "avisos_gestor_leituras_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

