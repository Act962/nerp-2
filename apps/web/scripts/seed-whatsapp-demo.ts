import path from "node:path";
import dotenv from "dotenv";

// Mesma ordem de precedência do Next: `.env.local` primeiro, `.env` depois.
// `import "dotenv/config"` sozinho leria só o `.env`, e é no `.env.local` que
// mora a APP_ENCRYPTION_KEY.
dotenv.config({
  path: [
    path.resolve(__dirname, "../.env.local"),
    path.resolve(__dirname, "../.env"),
  ],
});
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { encryptMetaCredentialsInput } from "@/features/whatsapp-chat/lib/providers/meta-credentials";

/**
 * Popula o módulo WhatsApp/CRM com conversas de mentira, para acompanhar como
 * está ficando sem precisar de conta na Meta.
 *
 * O que cria, na organização que você passar:
 *  - um funil "Atendimento (demo)" com as cinco etapas padrão;
 *  - uma conexão de WhatsApp marcada como conectada, com credencial falsa
 *    (nada aqui fala com a Meta — quem envia de verdade é o modo demo);
 *  - seis clientes em situações diferentes: esperando resposta, em conversa,
 *    encerrado, com e sem vínculo com o cadastro do ERP;
 *  - histórico de mensagens nos dois sentidos, com não-lidas.
 *
 * Quando encontra clientes de verdade no cadastro da organização, liga alguns
 * leads a eles — é assim que a ficha lateral mostra compras reais.
 *
 * **Idempotente**: roda quantas vezes quiser, não duplica. As mensagens usam
 * id externo determinístico, então a segunda execução só atualiza.
 *
 * Uso:
 *   pnpm --filter @nerp/web exec tsx scripts/seed-whatsapp-demo.ts <slug-da-org>
 *
 * Para desfazer:
 *   pnpm --filter @nerp/web exec tsx scripts/seed-whatsapp-demo.ts <slug> --remover
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const NOME_DO_FUNIL = "Atendimento (demo)";
const PREFIXO_DE_MENSAGEM = "wamid.SEED-DEMO";

const PESSOAS = [
  {
    apelido: "ana",
    nome: "Ana Ribeiro",
    telefone: "5586988110001",
    etapa: "Novo",
    atendimento: "WAITING" as const,
    interesse: "HOT" as const,
    conversa: [
      { de: "cliente", texto: "Oi! Vocês têm o filtro de barro de 8 litros?" },
      { de: "cliente", texto: "Preciso pra hoje se possível" },
    ],
  },
  {
    apelido: "bruno",
    nome: "Bruno Carvalho",
    telefone: "5586988110002",
    etapa: "Em atendimento",
    atendimento: "ACTIVE" as const,
    interesse: "WARM" as const,
    conversa: [
      {
        de: "cliente",
        texto: "Bom dia, queria saber o preço do jogo de panelas",
      },
      {
        de: "loja",
        texto: "Bom dia, Bruno! O jogo com 5 peças está R$ 289,90.",
      },
      { de: "cliente", texto: "Consegue parcelar?" },
      { de: "loja", texto: "Consigo sim, em até 6x sem juros no cartão." },
    ],
  },
  {
    apelido: "carla",
    nome: "Carla Mendes",
    telefone: "5586988110003",
    etapa: "Proposta",
    atendimento: "ACTIVE" as const,
    interesse: "VERY_HOT" as const,
    valor: 1450,
    conversa: [
      { de: "cliente", texto: "Recebi o orçamento, obrigada!" },
      { de: "loja", texto: "De nada, Carla! Qualquer dúvida é só chamar." },
      { de: "cliente", texto: "Vou fechar. Como faço o pagamento?" },
    ],
  },
  {
    apelido: "diego",
    nome: "Diego Alves",
    telefone: "5586988110004",
    etapa: "Ganho",
    atendimento: "FINISHED" as const,
    interesse: "HOT" as const,
    valor: 890,
    conversa: [
      { de: "cliente", texto: "Chegou tudo certinho, valeu!" },
      { de: "loja", texto: "Que bom, Diego! Precisando, estamos aqui." },
    ],
  },
  {
    apelido: "elisa",
    nome: "Elisa Nogueira",
    telefone: "5586988110005",
    etapa: "Novo",
    atendimento: "WAITING" as const,
    interesse: "COLD" as const,
    conversa: [{ de: "cliente", texto: "vocês entregam em Parnaíba?" }],
  },
  {
    apelido: "fabio",
    nome: "Fábio Torres",
    telefone: "5586988110006",
    etapa: "Perdido",
    atendimento: "FINISHED" as const,
    interesse: "COLD" as const,
    conversa: [
      { de: "cliente", texto: "Achei caro, vou deixar pra depois" },
      { de: "loja", texto: "Sem problema, Fábio. Quando quiser é só chamar." },
    ],
  },
];

async function main() {
  const slug = process.argv[2];
  const remover = process.argv.includes("--remover");

  if (!slug) {
    const orgs = await prisma.organization.findMany({
      select: { slug: true, name: true },
      orderBy: { createdAt: "asc" },
    });
    console.log("Informe o slug da organização. Disponíveis:\n");
    for (const org of orgs) console.log(`  ${org.slug.padEnd(24)} ${org.name}`);
    console.log(
      "\nExemplo: pnpm --filter @nerp/web exec tsx scripts/seed-whatsapp-demo.ts gotham",
    );
    return;
  }

  const org = await prisma.organization.findFirst({
    where: { slug },
    select: { id: true, name: true },
  });
  if (!org) throw new Error(`Organização "${slug}" não encontrada.`);

  if (remover) return desfazer(org.id, org.name);

  const dono = await prisma.member.findFirst({
    where: { organizationId: org.id },
    select: { userId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!dono) throw new Error(`A organização "${slug}" não tem membros.`);

  console.log(`\nPopulando o WhatsApp/CRM de "${org.name}"…\n`);

  // ── Funil + etapas ──────────────────────────────────────────────────────
  let funil = await prisma.crmFunnel.findFirst({
    where: { organizationId: org.id, name: NOME_DO_FUNIL },
    select: { id: true },
  });

  if (!funil) {
    funil = await prisma.crmFunnel.create({
      data: {
        organizationId: org.id,
        name: NOME_DO_FUNIL,
        description: "Criado pelo seed de demonstração",
      },
      select: { id: true },
    });
    await prisma.crmStage.createMany({
      data: [
        { name: "Novo", color: "#3b82f6", order: 1000 },
        { name: "Em atendimento", color: "#f59e0b", order: 2000 },
        { name: "Proposta", color: "#8b5cf6", order: 3000 },
        { name: "Ganho", color: "#22c55e", order: 4000 },
        { name: "Perdido", color: "#ef4444", order: 5000 },
      ].map((etapa) => ({
        ...etapa,
        organizationId: org.id,
        funnelId: funil?.id ?? "",
      })),
    });
    await prisma.crmFunnelParticipant.create({
      data: {
        organizationId: org.id,
        funnelId: funil.id,
        userId: dono.userId,
        role: "OWNER",
      },
    });
    console.log("  ✓ funil criado com as cinco etapas");
  } else {
    console.log("  · funil já existia");
  }

  const etapas = await prisma.crmStage.findMany({
    where: { funnelId: funil.id },
    select: { id: true, name: true },
  });
  const etapaPorNome = new Map(etapas.map((e) => [e.name, e.id]));

  // ── Conexão de mentira, só para a tela mostrar "conectado" ──────────────
  const jaTemConexao = await prisma.whatsAppConnection.findFirst({
    where: { funnelId: funil.id },
    select: { id: true },
  });
  if (!jaTemConexao) {
    await prisma.whatsAppConnection.create({
      data: {
        organizationId: org.id,
        funnelId: funil.id,
        name: "Número de demonstração",
        status: "CONNECTED",
        phoneNumber: "+55 86 98811-0000",
        profileName: org.name,
        ...encryptMetaCredentialsInput({
          // Valores falsos de propósito: nada aqui fala com a Meta.
          accessToken: `demo-token-${org.id}`,
          phoneNumberId: `demo-${org.id}`,
          appSecret: `demo-secret-${org.id}`,
        }),
      },
    });
    console.log("  ✓ conexão de demonstração criada (credencial falsa)");
  } else {
    console.log("  · conexão já existia");
  }

  // ── Clientes do ERP para vincular ───────────────────────────────────────
  const clientesReais = await prisma.customer.findMany({
    where: { organizationId: org.id },
    select: { id: true, name: true },
    take: 3,
    orderBy: { createdAt: "desc" },
  });
  if (clientesReais.length > 0) {
    console.log(
      `  · ${clientesReais.length} cliente(s) do cadastro serão vinculados`,
    );
  }

  // ── Leads, conversas e mensagens ────────────────────────────────────────
  const agora = Date.now();
  let indice = 0;

  for (const pessoa of PESSOAS) {
    const stageId = etapaPorNome.get(pessoa.etapa);
    if (!stageId) continue;

    // Espalha as conversas ao longo das últimas horas, para a ordenação da
    // caixa de entrada ficar parecida com a de um dia de trabalho.
    const base = agora - indice * 47 * 60_000;
    const clienteVinculado = clientesReais[indice] ?? null;

    const lead = await prisma.crmLead.upsert({
      where: {
        phone_funnelId: { phone: pessoa.telefone, funnelId: funil.id },
      },
      update: {
        stageId,
        statusFlow: pessoa.atendimento,
        temperature: pessoa.interesse,
      },
      create: {
        organizationId: org.id,
        funnelId: funil.id,
        stageId,
        name: pessoa.nome,
        phone: pessoa.telefone,
        source: "WHATSAPP",
        statusFlow: pessoa.atendimento,
        temperature: pessoa.interesse,
        amount: pessoa.valor ?? 0,
        customerId: clienteVinculado?.id ?? null,
        lastInboundAt: new Date(base),
      },
      select: { id: true },
    });

    const conversa = await prisma.conversation.upsert({
      where: { leadId: lead.id },
      update: {},
      create: {
        organizationId: org.id,
        funnelId: funil.id,
        leadId: lead.id,
        remoteJid: pessoa.telefone,
        name: pessoa.nome,
      },
      select: { id: true },
    });

    let ultimaMensagem: string | null = null;
    let posicao = 0;

    for (const fala of pessoa.conversa) {
      const daLoja = fala.de === "loja";
      const externalMessageId = `${PREFIXO_DE_MENSAGEM}-${pessoa.apelido}-${posicao}`;
      const quando = new Date(base + posicao * 90_000);

      const mensagem = await prisma.message.upsert({
        where: { externalMessageId },
        update: {},
        create: {
          organizationId: org.id,
          conversationId: conversa.id,
          externalMessageId,
          body: fala.texto,
          fromMe: daLoja,
          // A da loja sai com um tique; a do cliente entra "não lida" para o
          // badge da caixa de entrada aparecer.
          status: daLoja ? "SENT" : "SEEN",
          seen: daLoja,
          senderName: daLoja ? null : pessoa.nome,
          senderId: daLoja ? dono.userId : pessoa.telefone,
          createdAt: quando,
        },
        select: { id: true },
      });

      ultimaMensagem = mensagem.id;
      posicao += 1;
    }

    if (ultimaMensagem) {
      await prisma.conversation.update({
        where: { id: conversa.id },
        data: { lastMessageId: ultimaMensagem },
      });
    }

    console.log(
      `  ✓ ${pessoa.nome.padEnd(18)} ${pessoa.etapa.padEnd(16)} ${pessoa.conversa.length} mensagem(ns)${clienteVinculado ? ` · ligado a ${clienteVinculado.name}` : ""}`,
    );
    indice += 1;
  }

  await semearAgenda(org.id, funil.id, slug);

  console.log(`\nPronto. Abra /whatsapp?funil=${funil.id}\n`);
}

const NOME_DA_AGENDA = "Consultoria (demo)";

/**
 * Uma agenda pronta para clicar: grade de segunda a sábado e um horário já
 * marcado, para a aba de compromissos não abrir vazia.
 *
 * Vai pendurada no funil de demonstração de propósito — a cascata do funil
 * leva a agenda junto, então `--remover` continua limpando tudo de uma vez.
 */
async function semearAgenda(
  organizationId: string,
  funnelId: string,
  orgSlug: string,
) {
  const jaExiste = await prisma.agenda.findFirst({
    where: { organizationId, name: NOME_DA_AGENDA },
    select: { id: true, slug: true },
  });
  if (jaExiste) {
    console.log(
      `\n  ✓ agenda já existia · /publico/agenda/${orgSlug}/${jaExiste.slug}`,
    );
    return;
  }

  const agenda = await prisma.agenda.create({
    data: {
      organizationId,
      funnelId,
      name: NOME_DA_AGENDA,
      description: "Trinta minutos para entender a necessidade da loja.",
      slug: "consultoria-demo",
      slotDuration: 30,
    },
    select: { id: true, slug: true },
  });

  const DIAS = [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ] as const;

  for (const dia of DIAS) {
    await prisma.agendaAvailability.create({
      data: {
        agendaId: agenda.id,
        dayOfWeek: dia,
        timeSlots: {
          create: [
            { startTime: "09:00", endTime: "12:00", order: 0 },
            { startTime: "14:00", endTime: "17:00", order: 1 },
          ],
        },
      },
    });
  }

  // Um compromisso já marcado, amanhã às 10h no fuso da loja (UTC−3).
  const amanha = new Date(Date.now() + 86_400_000);
  const inicio = new Date(
    Date.UTC(
      amanha.getUTCFullYear(),
      amanha.getUTCMonth(),
      amanha.getUTCDate(),
      13,
      0,
    ),
  );
  const lead = await prisma.crmLead.findFirst({
    where: { organizationId, funnelId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  if (lead) {
    await prisma.appointment.create({
      data: {
        organizationId,
        agendaId: agenda.id,
        leadId: lead.id,
        title: `${NOME_DA_AGENDA} — ${lead.name}`,
        startsAt: inicio,
        endsAt: new Date(inicio.getTime() + 30 * 60_000),
        meetingType: "ONLINE",
      },
    });
  }

  console.log(
    `\n  ✓ agenda "${NOME_DA_AGENDA}" · link do cliente: /publico/agenda/${orgSlug}/${agenda.slug}`,
  );
}

async function desfazer(organizationId: string, nome: string) {
  const funil = await prisma.crmFunnel.findFirst({
    where: { organizationId, name: NOME_DO_FUNIL },
    select: { id: true },
  });
  if (!funil) {
    console.log(`Nada a remover em "${nome}".`);
    return;
  }
  // Cascata do funil leva etapas, leads, conversas, mensagens e a conexão.
  await prisma.crmFunnel.delete({ where: { id: funil.id } });
  console.log(`Funil de demonstração removido de "${nome}".`);
}

main()
  .catch((erro) => {
    console.error("\nFalhou:", erro instanceof Error ? erro.message : erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
