-- CRM + WhatsApp + Campanhas + Agenda + Stars — port do Órbita (nasaex-wey).
--
-- 36 tabelas novas, nenhuma alteração destrutiva: a única mudança em objeto
-- existente é o valor `CRM` no enum `IntegrationCategory`, para o card do
-- Órbita CRM aparecer na seção certa do catálogo de integrações.
--
-- Duas diferenças conscientes em relação ao schema de origem:
--
--  1. Todo modelo carrega `organization_id`. No Órbita o lead não tem — a
--     organização é alcançada por join com o funil. Aqui o escopo por tenant é
--     manual em cada handler, e depender de join para saber de quem é a linha
--     é como vazamento entre organizações acontece.
--
--  2. `messages.external_message_id` é UNIQUE global. É a chave de
--     idempotência do webhook: a Meta reentrega o mesmo evento em qualquer
--     resposta 5xx, e sem essa restrição a mesma mensagem duplica na conversa.
--
-- `IF NOT EXISTS` / `EXCEPTION WHEN duplicate_object` em tudo porque o
-- `migrate deploy` desta base já esteve bloqueado por migração falha (P3009) e
-- as recentes são aplicadas à mão.
--
-- O `ALTER TYPE ... ADD VALUE` abaixo roda dentro da transação da migration; o
-- valor novo só pode ser USADO a partir da migration seguinte — nenhuma linha
-- aqui o usa.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "crm_participant_role" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "crm_reason_type" AS ENUM ('WIN', 'LOSS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "crm_tag_type" AS ENUM ('CUSTOM', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "crm_lead_action" AS ENUM ('ACTIVE', 'DELETED', 'WON', 'LOST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "crm_lead_event_type" AS ENUM ('ACTION_CHANGE', 'STATUS_CHANGE', 'FUNNEL_CHANGE', 'RESPONSIBLE_CHANGE', 'TAG_ADDED', 'TAG_REMOVED', 'FILE_UPLOADED', 'NOTE', 'SLA_BREACHED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "crm_lead_source" AS ENUM ('DEFAULT', 'WHATSAPP', 'AGENDA', 'INSTAGRAM', 'TIKTOK', 'LINKEDIN', 'GMAIL', 'GOOGLE_MAPS', 'IMPORT', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "crm_temperature" AS ENUM ('COLD', 'WARM', 'HOT', 'VERY_HOT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "crm_status_flow" AS ENUM ('NEW', 'ACTIVE', 'WAITING', 'FINISHED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "crm_idle_message_mode" AS ENUM ('NONE', 'FIXED', 'AI_REOPEN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "whatsapp_connection_status" AS ENUM ('CONNECTED', 'DISCONNECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "conversation_channel" AS ENUM ('WHATSAPP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "message_status" AS ENUM ('SENT', 'DELIVERED', 'SEEN', 'FAILED', 'DELETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "broadcast_status" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'PAUSED', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "broadcast_recipient_status" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "whatsapp_template_category" AS ENUM ('MARKETING', 'UTILITY', 'AUTHENTICATION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "star_transaction_type" AS ENUM ('PLAN_CREDIT', 'TOPUP_PURCHASE', 'APP_CHARGE', 'MANUAL_ADJUST', 'REFUND', 'WELCOME_BONUS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "day_of_week" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "appointment_status" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'NO_SHOW', 'DONE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "meeting_type" AS ENUM ('ONLINE', 'IN_PERSON');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "reminder_recurrence_type" AS ENUM ('ONCE', 'WEEKLY', 'BIWEEKLY', 'MONTHLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AlterEnum
ALTER TYPE "IntegrationCategory" ADD VALUE IF NOT EXISTS 'CRM';

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_funnels" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "card_border_color" TEXT,
    "card_background_image" TEXT,
    "card_background_blur" INTEGER NOT NULL DEFAULT 8,
    "card_background_opacity" INTEGER NOT NULL DEFAULT 25,
    "kanban_card_background_color" TEXT,
    "kanban_card_border_color" TEXT,
    "kanban_card_background_opacity" INTEGER NOT NULL DEFAULT 100,
    "kanban_column_background_color" TEXT,
    "kanban_column_border_color" TEXT,
    "kanban_column_background_opacity" INTEGER NOT NULL DEFAULT 100,
    "kanban_background_color" TEXT,
    "kanban_background_image" TEXT,
    "kanban_background_blur" INTEGER NOT NULL DEFAULT 0,
    "kanban_background_opacity" INTEGER NOT NULL DEFAULT 50,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_funnels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_funnel_participants" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "funnel_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "crm_participant_role" NOT NULL DEFAULT 'MEMBER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_funnel_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_funnel_consultants" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "funnel_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "max_flow" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_assigned_at" TIMESTAMP(3),

    CONSTRAINT "crm_funnel_consultants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_funnel_card_configs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "funnel_id" TEXT NOT NULL,
    "card_visibility" JSONB NOT NULL DEFAULT '{}',
    "show_sla_timer" BOOLEAN NOT NULL DEFAULT true,
    "show_purchase_basket" BOOLEAN NOT NULL DEFAULT true,
    "basket_recent_days" INTEGER NOT NULL DEFAULT 30,
    "basket_medium_days" INTEGER NOT NULL DEFAULT 60,
    "basket_long_days" INTEGER NOT NULL DEFAULT 90,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_funnel_card_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_funnel_idle_automations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "funnel_id" TEXT NOT NULL,
    "no_first_resp_active" BOOLEAN NOT NULL DEFAULT false,
    "no_first_resp_minutes" INTEGER NOT NULL DEFAULT 60,
    "no_first_resp_enable_ai" BOOLEAN NOT NULL DEFAULT false,
    "no_first_resp_message_mode" "crm_idle_message_mode" NOT NULL DEFAULT 'NONE',
    "no_first_resp_message" TEXT,
    "no_first_resp_notify_resp" BOOLEAN NOT NULL DEFAULT false,
    "no_first_resp_resp_template" TEXT,
    "in_conv_active" BOOLEAN NOT NULL DEFAULT false,
    "in_conv_minutes" INTEGER NOT NULL DEFAULT 120,
    "in_conv_enable_ai" BOOLEAN NOT NULL DEFAULT false,
    "in_conv_message_mode" "crm_idle_message_mode" NOT NULL DEFAULT 'NONE',
    "in_conv_message" TEXT,
    "in_conv_notify_resp" BOOLEAN NOT NULL DEFAULT false,
    "in_conv_resp_template" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_funnel_idle_automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_stages" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "funnel_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT DEFAULT '#1447e6',
    "order" DECIMAL(20,10) NOT NULL DEFAULT 0,
    "sla_hours" INTEGER,
    "notify_client_on_enter" BOOLEAN NOT NULL DEFAULT false,
    "client_notify_template" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_leads" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "funnel_id" TEXT NOT NULL,
    "stage_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "responsible_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "document" TEXT,
    "nickname" TEXT,
    "description" TEXT,
    "profile" TEXT,
    "order" DECIMAL(20,10) NOT NULL DEFAULT 0,
    "source" "crm_lead_source" NOT NULL DEFAULT 'DEFAULT',
    "temperature" "crm_temperature" NOT NULL DEFAULT 'COLD',
    "amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "status_flow" "crm_status_flow" NOT NULL DEFAULT 'ACTIVE',
    "current_action" "crm_lead_action" NOT NULL DEFAULT 'ACTIVE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "utm_content" TEXT,
    "utm_term" TEXT,
    "referrer" TEXT,
    "landing_page" TEXT,
    "device" TEXT,
    "ctwa_clid" TEXT,
    "meta_ad_id" TEXT,
    "meta_adset_id" TEXT,
    "meta_campaign_id" TEXT,
    "meta_source_url" TEXT,
    "meta_headline" TEXT,
    "meta_body" TEXT,
    "assigned_at" TIMESTAMP(3),
    "last_inbound_at" TIMESTAMP(3),
    "last_outbound_at" TIMESTAMP(3),
    "first_response_at" TIMESTAMP(3),
    "last_status_change_at" TIMESTAMP(3),
    "sla_deadline" TIMESTAMP(3),
    "stage_entered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "crm_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_win_loss_reasons" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "funnel_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "crm_reason_type" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_win_loss_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_lead_histories" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "action" "crm_lead_action" NOT NULL,
    "event_type" "crm_lead_event_type",
    "previous_stage_id" TEXT,
    "new_stage_id" TEXT,
    "previous_funnel_id" TEXT,
    "new_funnel_id" TEXT,
    "previous_responsible_id" TEXT,
    "new_responsible_id" TEXT,
    "metadata" JSONB,
    "reason_id" TEXT,
    "notes" TEXT,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_lead_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_lead_journey_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_lead_journey_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_tag_groups" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_tag_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_tags" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "funnel_id" TEXT,
    "tag_group_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT DEFAULT '#1447e6',
    "description" TEXT,
    "icon" TEXT,
    "type" "crm_tag_type" NOT NULL DEFAULT 'CUSTOM',
    "whatsapp_id" TEXT,
    "archived_at" TIMESTAMP(3),
    "archived_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_lead_tags" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_lead_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "crm_lead_files" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "file_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_lead_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "whatsapp_connections" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "funnel_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "whatsapp_connection_status" NOT NULL DEFAULT 'DISCONNECTED',
    "phone_number" TEXT,
    "profile_name" TEXT,
    "profile_pic_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "meta_phone_number_id" TEXT,
    "meta_business_account_id" TEXT,
    "meta_access_token_enc" TEXT,
    "meta_app_secret_enc" TEXT,
    "meta_verify_token_enc" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "last_error" TEXT,
    "last_error_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "conversations" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "funnel_id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "channel" "conversation_channel" NOT NULL DEFAULT 'WHATSAPP',
    "remote_jid" TEXT NOT NULL,
    "name" TEXT,
    "profile_pic_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_group" BOOLEAN NOT NULL DEFAULT false,
    "group_subject" TEXT,
    "group_participants_count" INTEGER,
    "first_user_message_at" TIMESTAMP(3),
    "last_message_id" TEXT,
    "last_message_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "messages" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "body" TEXT,
    "from_me" BOOLEAN NOT NULL DEFAULT false,
    "status" "message_status" NOT NULL DEFAULT 'SENT',
    "seen" BOOLEAN NOT NULL DEFAULT false,
    "external_message_id" TEXT NOT NULL,
    "media_key" TEXT,
    "media_type" TEXT,
    "media_caption" TEXT,
    "mimetype" TEXT,
    "file_name" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "quoted_message_id" TEXT,
    "sender_id" TEXT,
    "sender_name" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "message_stickers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "file_key" TEXT NOT NULL,
    "mimetype" TEXT NOT NULL DEFAULT 'image/webp',
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_stickers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "broadcasts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "funnel_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "broadcast_status" NOT NULL DEFAULT 'DRAFT',
    "template_name" TEXT,
    "template_language" TEXT,
    "template_category" "whatsapp_template_category",
    "template_variables" JSONB,
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "total_recipients" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "delivered_count" INTEGER NOT NULL DEFAULT 0,
    "read_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "broadcast_recipients" (
    "id" TEXT NOT NULL,
    "broadcast_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "name" TEXT,
    "phone" TEXT NOT NULL,
    "variables" JSONB,
    "status" "broadcast_recipient_status" NOT NULL DEFAULT 'PENDING',
    "external_message_id" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "broadcast_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "star_transactions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "type" "star_transaction_type" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "action_key" TEXT,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "star_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "star_rules" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "action_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "star_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "member_star_budgets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "monthly_budget" INTEGER NOT NULL DEFAULT 0,
    "current_usage" INTEGER NOT NULL DEFAULT 0,
    "cycle_start" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_star_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "star_packages" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "price_brl" DECIMAL(10,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "star_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "stars_payments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "package_id" TEXT,
    "stars_amount" INTEGER NOT NULL,
    "amount_brl" DECIMAL(10,2) NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "external_id" TEXT,
    "stripe_payment_intent_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paid_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stars_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "processed_stripe_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'stars',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_stripe_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "agendas" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "funnel_id" TEXT NOT NULL,
    "stage_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "slot_duration" INTEGER NOT NULL DEFAULT 30,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agendas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "agenda_responsibles" (
    "id" TEXT NOT NULL,
    "agenda_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agenda_responsibles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "agenda_availabilities" (
    "id" TEXT NOT NULL,
    "agenda_id" TEXT NOT NULL,
    "day_of_week" "day_of_week" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "agenda_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "availability_time_slots" (
    "id" TEXT NOT NULL,
    "availability_id" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "availability_time_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "agenda_date_availabilities" (
    "id" TEXT NOT NULL,
    "agenda_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agenda_date_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "agenda_date_availability_slots" (
    "id" TEXT NOT NULL,
    "date_availability_id" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "agenda_date_availability_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "agenda_date_overrides" (
    "id" TEXT NOT NULL,
    "agenda_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "is_blocked" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agenda_date_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "appointments" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "agenda_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "user_id" TEXT,
    "title" TEXT,
    "notes" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "status" "appointment_status" NOT NULL DEFAULT 'PENDING',
    "meeting_type" "meeting_type" NOT NULL DEFAULT 'ONLINE',
    "gcal_event_id" TEXT,
    "cancelled_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "reminders" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "recurrence_type" "reminder_recurrence_type" NOT NULL,
    "day_of_month" INTEGER,
    "remind_time" TEXT NOT NULL,
    "notify_phone" TEXT,
    "next_remind_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "lead_id" TEXT,
    "conversation_id" TEXT,
    "funnel_id" TEXT,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "reminder_occurrences" (
    "id" TEXT NOT NULL,
    "reminder_id" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_funnels_organization_id_idx" ON "crm_funnels"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_funnels_organization_id_is_archived_idx" ON "crm_funnels"("organization_id", "is_archived");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_funnel_participants_funnel_id_idx" ON "crm_funnel_participants"("funnel_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_funnel_participants_organization_id_idx" ON "crm_funnel_participants"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "crm_funnel_participants_user_id_funnel_id_key" ON "crm_funnel_participants"("user_id", "funnel_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_funnel_consultants_funnel_id_idx" ON "crm_funnel_consultants"("funnel_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_funnel_consultants_organization_id_idx" ON "crm_funnel_consultants"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "crm_funnel_consultants_user_id_funnel_id_key" ON "crm_funnel_consultants"("user_id", "funnel_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "crm_funnel_card_configs_funnel_id_key" ON "crm_funnel_card_configs"("funnel_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_funnel_card_configs_organization_id_idx" ON "crm_funnel_card_configs"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "crm_funnel_idle_automations_funnel_id_key" ON "crm_funnel_idle_automations"("funnel_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_funnel_idle_automations_organization_id_idx" ON "crm_funnel_idle_automations"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_stages_funnel_id_order_idx" ON "crm_stages"("funnel_id", "order");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_stages_organization_id_idx" ON "crm_stages"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_leads_organization_id_idx" ON "crm_leads"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_leads_funnel_id_idx" ON "crm_leads"("funnel_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_leads_stage_id_order_idx" ON "crm_leads"("stage_id", "order");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_leads_customer_id_idx" ON "crm_leads"("customer_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_leads_responsible_id_idx" ON "crm_leads"("responsible_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_leads_organization_id_phone_idx" ON "crm_leads"("organization_id", "phone");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_leads_email_idx" ON "crm_leads"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_leads_current_action_idx" ON "crm_leads"("current_action");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_leads_is_active_idx" ON "crm_leads"("is_active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_leads_last_inbound_at_idx" ON "crm_leads"("last_inbound_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_leads_assigned_at_idx" ON "crm_leads"("assigned_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_leads_utm_campaign_idx" ON "crm_leads"("utm_campaign");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_leads_meta_ad_id_idx" ON "crm_leads"("meta_ad_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_leads_meta_campaign_id_idx" ON "crm_leads"("meta_campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "crm_leads_phone_funnel_id_key" ON "crm_leads"("phone", "funnel_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_win_loss_reasons_funnel_id_idx" ON "crm_win_loss_reasons"("funnel_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_win_loss_reasons_organization_id_idx" ON "crm_win_loss_reasons"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_lead_histories_lead_id_idx" ON "crm_lead_histories"("lead_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_lead_histories_organization_id_idx" ON "crm_lead_histories"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_lead_histories_event_type_idx" ON "crm_lead_histories"("event_type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_lead_histories_created_at_idx" ON "crm_lead_histories"("created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_lead_journey_events_lead_id_occurred_at_idx" ON "crm_lead_journey_events"("lead_id", "occurred_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_lead_journey_events_organization_id_idx" ON "crm_lead_journey_events"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_lead_journey_events_kind_idx" ON "crm_lead_journey_events"("kind");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_tag_groups_organization_id_order_idx" ON "crm_tag_groups"("organization_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "crm_tag_groups_name_organization_id_key" ON "crm_tag_groups"("name", "organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_tags_organization_id_idx" ON "crm_tags"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_tags_funnel_id_idx" ON "crm_tags"("funnel_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_tags_organization_id_archived_at_idx" ON "crm_tags"("organization_id", "archived_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_tags_tag_group_id_idx" ON "crm_tags"("tag_group_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "crm_tags_slug_organization_id_funnel_id_key" ON "crm_tags"("slug", "organization_id", "funnel_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "crm_tags_name_organization_id_funnel_id_key" ON "crm_tags"("name", "organization_id", "funnel_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_lead_tags_lead_id_idx" ON "crm_lead_tags"("lead_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_lead_tags_tag_id_idx" ON "crm_lead_tags"("tag_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "crm_lead_tags_lead_id_tag_id_key" ON "crm_lead_tags"("lead_id", "tag_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_lead_files_lead_id_idx" ON "crm_lead_files"("lead_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_lead_files_organization_id_idx" ON "crm_lead_files"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "crm_lead_files_created_by_id_idx" ON "crm_lead_files"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_connections_funnel_id_key" ON "whatsapp_connections"("funnel_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_connections_meta_phone_number_id_key" ON "whatsapp_connections"("meta_phone_number_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "whatsapp_connections_organization_id_idx" ON "whatsapp_connections"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "whatsapp_connections_status_idx" ON "whatsapp_connections"("status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "conversations_lead_id_key" ON "conversations"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "conversations_last_message_id_key" ON "conversations"("last_message_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "conversations_organization_id_idx" ON "conversations"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "conversations_funnel_id_idx" ON "conversations"("funnel_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "conversations_last_message_at_idx" ON "conversations"("last_message_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "conversations_is_active_idx" ON "conversations"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "conversations_remote_jid_funnel_id_key" ON "conversations"("remote_jid", "funnel_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "messages_external_message_id_key" ON "messages"("external_message_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "messages_organization_id_idx" ON "messages"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "messages_status_idx" ON "messages"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "messages_from_me_idx" ON "messages"("from_me");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "message_stickers_organization_id_created_at_idx" ON "message_stickers"("organization_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "message_stickers_created_by_id_idx" ON "message_stickers"("created_by_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "broadcasts_organization_id_idx" ON "broadcasts"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "broadcasts_funnel_id_idx" ON "broadcasts"("funnel_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "broadcasts_status_idx" ON "broadcasts"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "broadcasts_status_scheduled_at_idx" ON "broadcasts"("status", "scheduled_at");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "broadcast_recipients_external_message_id_key" ON "broadcast_recipients"("external_message_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "broadcast_recipients_broadcast_id_status_idx" ON "broadcast_recipients"("broadcast_id", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "broadcast_recipients_lead_id_idx" ON "broadcast_recipients"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "broadcast_recipients_broadcast_id_phone_key" ON "broadcast_recipients"("broadcast_id", "phone");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "star_transactions_organization_id_created_at_idx" ON "star_transactions"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "star_transactions_type_idx" ON "star_transactions"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "star_rules_organization_id_idx" ON "star_rules"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "star_rules_organization_id_action_key_key" ON "star_rules"("organization_id", "action_key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "member_star_budgets_organization_id_idx" ON "member_star_budgets"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "member_star_budgets_organization_id_user_id_key" ON "member_star_budgets"("organization_id", "user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stars_payments_organization_id_idx" ON "stars_payments"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stars_payments_user_id_idx" ON "stars_payments"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stars_payments_external_id_idx" ON "stars_payments"("external_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stars_payments_stripe_payment_intent_id_idx" ON "stars_payments"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "stars_payments_status_idx" ON "stars_payments"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "agendas_organization_id_idx" ON "agendas"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "agendas_funnel_id_idx" ON "agendas"("funnel_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "agendas_is_active_idx" ON "agendas"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "agendas_slug_organization_id_key" ON "agendas"("slug", "organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "agenda_responsibles_agenda_id_idx" ON "agenda_responsibles"("agenda_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "agenda_responsibles_user_id_idx" ON "agenda_responsibles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "agenda_responsibles_agenda_id_user_id_key" ON "agenda_responsibles"("agenda_id", "user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "agenda_availabilities_agenda_id_idx" ON "agenda_availabilities"("agenda_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "agenda_availabilities_agenda_id_day_of_week_key" ON "agenda_availabilities"("agenda_id", "day_of_week");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "availability_time_slots_availability_id_idx" ON "availability_time_slots"("availability_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "agenda_date_availabilities_agenda_id_idx" ON "agenda_date_availabilities"("agenda_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "agenda_date_availabilities_agenda_id_date_key" ON "agenda_date_availabilities"("agenda_id", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "agenda_date_availability_slots_date_availability_id_idx" ON "agenda_date_availability_slots"("date_availability_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "agenda_date_overrides_agenda_id_idx" ON "agenda_date_overrides"("agenda_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "agenda_date_overrides_agenda_id_date_key" ON "agenda_date_overrides"("agenda_id", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "appointments_organization_id_idx" ON "appointments"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "appointments_agenda_id_idx" ON "appointments"("agenda_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "appointments_lead_id_idx" ON "appointments"("lead_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "appointments_user_id_idx" ON "appointments"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "appointments_starts_at_idx" ON "appointments"("starts_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "appointments_status_idx" ON "appointments"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "reminders_next_remind_at_is_active_idx" ON "reminders"("next_remind_at", "is_active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "reminders_organization_id_idx" ON "reminders"("organization_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "reminders_lead_id_idx" ON "reminders"("lead_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "reminders_conversation_id_idx" ON "reminders"("conversation_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "reminders_funnel_id_idx" ON "reminders"("funnel_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "reminder_occurrences_reminder_id_idx" ON "reminder_occurrences"("reminder_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "reminder_occurrences_scheduled_at_sent_idx" ON "reminder_occurrences"("scheduled_at", "sent");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_funnels" ADD CONSTRAINT "crm_funnels_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_funnel_participants" ADD CONSTRAINT "crm_funnel_participants_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "crm_funnels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_funnel_participants" ADD CONSTRAINT "crm_funnel_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_funnel_consultants" ADD CONSTRAINT "crm_funnel_consultants_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "crm_funnels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_funnel_consultants" ADD CONSTRAINT "crm_funnel_consultants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_funnel_card_configs" ADD CONSTRAINT "crm_funnel_card_configs_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "crm_funnels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_funnel_idle_automations" ADD CONSTRAINT "crm_funnel_idle_automations_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "crm_funnels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_stages" ADD CONSTRAINT "crm_stages_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "crm_funnels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "crm_funnels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "crm_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_win_loss_reasons" ADD CONSTRAINT "crm_win_loss_reasons_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "crm_funnels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_lead_histories" ADD CONSTRAINT "crm_lead_histories_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_lead_histories" ADD CONSTRAINT "crm_lead_histories_reason_id_fkey" FOREIGN KEY ("reason_id") REFERENCES "crm_win_loss_reasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_lead_histories" ADD CONSTRAINT "crm_lead_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_lead_journey_events" ADD CONSTRAINT "crm_lead_journey_events_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_lead_journey_events" ADD CONSTRAINT "crm_lead_journey_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_tag_groups" ADD CONSTRAINT "crm_tag_groups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_tags" ADD CONSTRAINT "crm_tags_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_tags" ADD CONSTRAINT "crm_tags_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "crm_funnels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_tags" ADD CONSTRAINT "crm_tags_tag_group_id_fkey" FOREIGN KEY ("tag_group_id") REFERENCES "crm_tag_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_tags" ADD CONSTRAINT "crm_tags_archived_by_id_fkey" FOREIGN KEY ("archived_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_lead_tags" ADD CONSTRAINT "crm_lead_tags_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_lead_tags" ADD CONSTRAINT "crm_lead_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "crm_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_lead_files" ADD CONSTRAINT "crm_lead_files_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "crm_lead_files" ADD CONSTRAINT "crm_lead_files_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "crm_funnels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "conversations" ADD CONSTRAINT "conversations_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "crm_funnels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "conversations" ADD CONSTRAINT "conversations_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "conversations" ADD CONSTRAINT "conversations_last_message_id_fkey" FOREIGN KEY ("last_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "messages" ADD CONSTRAINT "messages_quoted_message_id_fkey" FOREIGN KEY ("quoted_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "message_stickers" ADD CONSTRAINT "message_stickers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "message_stickers" ADD CONSTRAINT "message_stickers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "crm_funnels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "star_transactions" ADD CONSTRAINT "star_transactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "star_transactions" ADD CONSTRAINT "star_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "star_rules" ADD CONSTRAINT "star_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "member_star_budgets" ADD CONSTRAINT "member_star_budgets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "member_star_budgets" ADD CONSTRAINT "member_star_budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "stars_payments" ADD CONSTRAINT "stars_payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "stars_payments" ADD CONSTRAINT "stars_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "agendas" ADD CONSTRAINT "agendas_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "agendas" ADD CONSTRAINT "agendas_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "crm_funnels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "agendas" ADD CONSTRAINT "agendas_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "crm_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "agenda_responsibles" ADD CONSTRAINT "agenda_responsibles_agenda_id_fkey" FOREIGN KEY ("agenda_id") REFERENCES "agendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "agenda_responsibles" ADD CONSTRAINT "agenda_responsibles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "agenda_availabilities" ADD CONSTRAINT "agenda_availabilities_agenda_id_fkey" FOREIGN KEY ("agenda_id") REFERENCES "agendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "availability_time_slots" ADD CONSTRAINT "availability_time_slots_availability_id_fkey" FOREIGN KEY ("availability_id") REFERENCES "agenda_availabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "agenda_date_availabilities" ADD CONSTRAINT "agenda_date_availabilities_agenda_id_fkey" FOREIGN KEY ("agenda_id") REFERENCES "agendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "agenda_date_availability_slots" ADD CONSTRAINT "agenda_date_availability_slots_date_availability_id_fkey" FOREIGN KEY ("date_availability_id") REFERENCES "agenda_date_availabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "agenda_date_overrides" ADD CONSTRAINT "agenda_date_overrides_agenda_id_fkey" FOREIGN KEY ("agenda_id") REFERENCES "agendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "appointments" ADD CONSTRAINT "appointments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "appointments" ADD CONSTRAINT "appointments_agenda_id_fkey" FOREIGN KEY ("agenda_id") REFERENCES "agendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "appointments" ADD CONSTRAINT "appointments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "appointments" ADD CONSTRAINT "appointments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "reminders" ADD CONSTRAINT "reminders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "reminders" ADD CONSTRAINT "reminders_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "reminders" ADD CONSTRAINT "reminders_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "reminders" ADD CONSTRAINT "reminders_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "reminders" ADD CONSTRAINT "reminders_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "crm_funnels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "reminder_occurrences" ADD CONSTRAINT "reminder_occurrences_reminder_id_fkey" FOREIGN KEY ("reminder_id") REFERENCES "reminders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

