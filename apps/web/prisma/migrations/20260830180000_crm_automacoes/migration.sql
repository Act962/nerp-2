-- Automações do funil — gatilho, nós e histórico de execução.
--
-- Cinco tabelas novas e dois enums novos. NADA é alterado em tabela que já
-- existe: os únicos ALTER TABLE aqui são ADD CONSTRAINT de chave estrangeira
-- nas tabelas criadas neste mesmo arquivo.
--
-- Idempotente de ponta a ponta (IF NOT EXISTS e blocos que engolem
-- duplicate_object), como as outras migrations escritas à mão deste branch: o
-- banco é compartilhado, o histórico já travou com P3009 uma vez, e repetir a
-- aplicação precisa ser inofensivo.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "crm_node_type" AS ENUM ('TRIGGER_NEW_LEAD', 'TRIGGER_MESSAGE_IN', 'TRIGGER_STAGE_CHANGED', 'TRIGGER_LEAD_IDLE', 'TRIGGER_MANUAL', 'SEND_MESSAGE', 'WAIT', 'MOVE_STAGE', 'SET_TEMPERATURE', 'SET_RESPONSIBLE', 'SET_WIN_LOSS', 'HTTP_REQUEST', 'FILTER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "crm_run_status" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'FILTERED', 'RATE_LIMITED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_workflows" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "funnel_id" TEXT NOT NULL,
    "created_by_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "max_runs_per_hour" INTEGER NOT NULL DEFAULT 60,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_workflow_nodes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "type" "crm_node_type" NOT NULL,
    "name" TEXT NOT NULL,
    "position" JSONB NOT NULL DEFAULT '{}',
    "data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_workflow_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_workflow_connections" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "from_node_id" TEXT NOT NULL,
    "to_node_id" TEXT NOT NULL,
    "from_output" TEXT NOT NULL DEFAULT 'main',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_workflow_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_workflow_runs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "trigger_type" "crm_node_type" NOT NULL,
    "status" "crm_run_status" NOT NULL DEFAULT 'RUNNING',
    "initial_context" JSONB NOT NULL DEFAULT '{}',
    "nodes_executed" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "crm_workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_workflow_node_runs" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "node_id" TEXT NOT NULL,
    "status" "crm_run_status" NOT NULL DEFAULT 'RUNNING',
    "output" JSONB NOT NULL DEFAULT '{}',
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "crm_workflow_node_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_workflows_organization_id_idx" ON "crm_workflows"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_workflows_funnel_id_is_active_idx" ON "crm_workflows"("funnel_id", "is_active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_workflow_nodes_workflow_id_type_idx" ON "crm_workflow_nodes"("workflow_id", "type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_workflow_nodes_organization_id_idx" ON "crm_workflow_nodes"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_workflow_connections_workflow_id_idx" ON "crm_workflow_connections"("workflow_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_workflow_connections_organization_id_idx" ON "crm_workflow_connections"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "crm_workflow_connections_from_node_id_to_node_id_from_outpu_key" ON "crm_workflow_connections"("from_node_id", "to_node_id", "from_output");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_workflow_runs_workflow_id_started_at_idx" ON "crm_workflow_runs"("workflow_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_workflow_runs_organization_id_idx" ON "crm_workflow_runs"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_workflow_runs_lead_id_idx" ON "crm_workflow_runs"("lead_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_workflow_node_runs_run_id_idx" ON "crm_workflow_node_runs"("run_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_workflow_node_runs_node_id_idx" ON "crm_workflow_node_runs"("node_id");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_workflows" ADD CONSTRAINT "crm_workflows_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_workflows" ADD CONSTRAINT "crm_workflows_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "crm_funnels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_workflows" ADD CONSTRAINT "crm_workflows_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_workflow_nodes" ADD CONSTRAINT "crm_workflow_nodes_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "crm_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_workflow_connections" ADD CONSTRAINT "crm_workflow_connections_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "crm_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_workflow_connections" ADD CONSTRAINT "crm_workflow_connections_from_node_id_fkey" FOREIGN KEY ("from_node_id") REFERENCES "crm_workflow_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_workflow_connections" ADD CONSTRAINT "crm_workflow_connections_to_node_id_fkey" FOREIGN KEY ("to_node_id") REFERENCES "crm_workflow_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_workflow_runs" ADD CONSTRAINT "crm_workflow_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_workflow_runs" ADD CONSTRAINT "crm_workflow_runs_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "crm_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_workflow_runs" ADD CONSTRAINT "crm_workflow_runs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_workflow_node_runs" ADD CONSTRAINT "crm_workflow_node_runs_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "crm_workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_workflow_node_runs" ADD CONSTRAINT "crm_workflow_node_runs_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "crm_workflow_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

