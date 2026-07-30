import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { ORACLE_QUERY_TEMPLATES } from "@/features/dashboard-widgets/lib/oracle-query-templates";

// Adiciona o ranking de RCAs (relatório Winthor 114 — Vl Venda, Qt.Ped,
// %Part., %Lucro por vendedor) ao painel "Comercial" (cc-comercial) da
// Gotham. Diferente do painel "Comercial — Vendas por supervisor
// (Winthor 146/114)", que já tem essa tabela — aqui é o painel comercial
// GERAL que o usuário pediu explicitamente.
//
// Idempotente: se já existir um widget com este dataSourceKey+title neste
// painel, não duplica.

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const ORG_ID = "SX99VyjCVlkXq8R9uTGC05bTTaoywraV";
const PANEL_TEMPLATE_KEY = "cc-comercial";
const WIDGET_TITLE = "Ranking de vendedores (RCA) — Winthor 114";
const ACCENT = "#6366f1";

async function main() {
  const panel = await prisma.orgDashboardPanel.findFirst({
    where: {
      orgDashboard: { organizationId: ORG_ID },
      templateKey: PANEL_TEMPLATE_KEY,
    },
    select: { id: true, orgDashboardId: true, layout: true },
  });
  if (!panel) throw new Error(`Painel ${PANEL_TEMPLATE_KEY} não encontrado`);

  const existing = await prisma.orgDashboardWidget.findFirst({
    where: { panelId: panel.id, title: WIDGET_TITLE },
    select: { id: true },
  });
  if (existing) {
    console.log("Já existe — nada a fazer.");
    return;
  }

  const tpl = ORACLE_QUERY_TEMPLATES.find(
    (t) => t.key === "ranking-rca-detalhado",
  );
  if (!tpl) throw new Error("Template ranking-rca-detalhado não encontrado");

  // Painel vira largura cheia — os 4 KPIs existentes ficam como estão (o
  // grid interno é fluido; sobra espaço à direita deles), e a tabela nova
  // entra abaixo, ocupando a largura toda.
  const currentLayout = panel.layout as Record<
    string,
    { x: number; y: number; w: number; h: number }
  > | null;
  const topY = currentLayout?.lg?.y ?? 0;
  await prisma.orgDashboardPanel.update({
    where: { id: panel.id },
    data: {
      layout: {
        lg: { x: 0, y: topY, w: 12, h: 11 },
        md: { x: 0, y: topY, w: 8, h: 11 },
        sm: { x: 0, y: topY, w: 4, h: 11 },
      },
    },
  });

  const maxSort = await prisma.orgDashboardWidget.aggregate({
    where: { panelId: panel.id },
    _max: { sortOrder: true },
  });

  // Todos os widgets existentes terminam em y:6 (duas colunas de STATs
  // empilhados) — a tabela entra abaixo, largura cheia.
  const layout = {
    lg: { x: 0, y: 6, w: 12, h: 5 },
    md: { x: 0, y: 6, w: 8, h: 5 },
    sm: { x: 0, y: 6, w: 4, h: 5 },
  };

  await prisma.orgDashboardWidget.create({
    data: {
      orgDashboardId: panel.orgDashboardId,
      panelId: panel.id,
      dataSourceKey: "oracle.custom",
      title: WIDGET_TITLE,
      displayType: "TABLE",
      color: ACCENT,
      options: {
        oracle: tpl.config,
        // Deriva % Part., Contrib., % Lucro, % MC, % Acum. — mesma config já
        // usada no painel Winthor (custo é a 4ª medida, M3).
        report: { valueKey: "M0", costKey: "M3" },
      } as never,
      layout: layout as never,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });

  console.log(`🧩 "${WIDGET_TITLE}" adicionado ao painel Comercial.`);
}

main()
  .catch((error) => {
    console.error("❌", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
