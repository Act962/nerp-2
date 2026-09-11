import { safeValidateUIMessages, type UIMessage } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  anexosDasMensagens,
  conferirAnexos,
} from "@/features/astro/server/anexos";
import {
  cobrarBuscasNaWeb,
  cobrarTokensDoAstro,
  podeConversar,
} from "@/features/astro/server/cobranca";
import {
  CONFIGURACAO_DE_APROVACAO,
  segredoDeAprovacao,
} from "@/features/astro/server/acoes/aprovacao";
import {
  MENSAGENS_PARA_RESUMIR,
  resumirConversa,
} from "@/features/astro/server/resumir-conversa";
import { conferirTetoDiario } from "@/features/astro/server/teto-diario";
import { construirToolsDoApp } from "@/features/astro/server/tools-app";
import {
  LIMITE_TEXTO,
  textoDaMensagem,
} from "@/features/astro-consultor/server/mensagens";
import {
  falaDoVisitante,
  streamAstroConsultor,
} from "@/features/astro-consultor/server/orchestrator";
import {
  ASTRO_PRECOS_KEY,
  lerTabelaDePrecos,
} from "@/features/astro-consultor/server/preco";
import {
  ASTRO_CONFIG_KEY,
  lerConfig,
  resolverModelo,
} from "@/features/astro-consultor/server/provider";
import { auth } from "@/lib/auth";
import { emEstrelas } from "@/features/stars/lib/decimal";
import prisma from "@/lib/db";

/**
 * A conversa com o Astro, de dentro do nerp.
 *
 * Route handler, e não procedure oRPC, pelo mesmo motivo da rota do site: a
 * resposta é um stream. A guarda é outra — sessão do Better Auth e
 * organização ativa, como qualquer página logada — e as tools são as do
 * app, com `organizationId` em closure.
 *
 * A cobrança é em ★ da organização: sem saldo para um bloco de tokens, a
 * mensagem nem começa (402). O débito de verdade acontece no fim do stream,
 * quando os tokens são conhecidos.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SESSAO_HORAS = 24;

/**
 * Quantas mensagens o corpo pode trazer.
 *
 * É guarda de TAMANHO de requisição, não de conversa. O que o modelo enxerga
 * já é cortado em `janela()`, no orquestrador: uma conversa de duzentos turnos
 * custa o mesmo que uma de vinte. Estava em 60 e era baixo demais — a pessoa
 * batia nele no meio do trabalho, e cada nova tentativa acrescentava mais uma
 * mensagem ao histórico, então nenhuma passava. Era um beco sem saída.
 */
const MAX_MENSAGENS_NO_CORPO = 400;

const corpoSchema = z.object({
  messages: z.array(z.unknown()).min(1).max(MAX_MENSAGENS_NO_CORPO),
  sessionId: z.string().max(64).optional(),
});

function indisponivel(motivo: string) {
  return NextResponse.json(
    { erro: "astro_indisponivel", motivo },
    { status: 503 },
  );
}

export async function POST(request: NextRequest) {
  const sessaoAuth = await auth.api.getSession({ headers: request.headers });
  if (!sessaoAuth) {
    return NextResponse.json({ erro: "nao_autorizado" }, { status: 401 });
  }

  const org = await auth.api
    .getFullOrganization({ headers: request.headers })
    .catch(() => null);
  if (!org) {
    return NextResponse.json({ erro: "sem_organizacao" }, { status: 403 });
  }

  const membro = await prisma.member.findFirst({
    where: { organizationId: org.id, userId: sessaoAuth.user.id },
    select: { id: true },
  });
  if (!membro) {
    return NextResponse.json({ erro: "sem_organizacao" }, { status: 403 });
  }

  const corpoCru = await request.json().catch(() => null);
  const corpo = corpoSchema.safeParse(corpoCru);
  if (!corpo.success) {
    return NextResponse.json({ erro: "corpo_invalido" }, { status: 400 });
  }

  const mensagens = corpo.data.messages as UIMessage[];
  if (textoDaMensagem(mensagens.at(-1)).length > LIMITE_TEXTO) {
    return NextResponse.json({ erro: "mensagem_longa" }, { status: 413 });
  }

  // O histórico inteiro é postado pelo navegador a cada mensagem: um anexo
  // apontando para fora do prefixo desta organização seria o servidor lendo
  // arquivo alheio (ou qualquer URL da internet) a mando do cliente.
  const anexos = anexosDasMensagens(corpo.data.messages);
  const vereditoDosAnexos = conferirAnexos(anexos, org.id);
  if (!vereditoDosAnexos.ok) {
    return NextResponse.json(
      { erro: "anexo_invalido", motivo: vereditoDosAnexos.motivo },
      { status: 400 },
    );
  }

  // A mesma chave de configuração do site: ligar/desligar e o modelo valem
  // para os dois canais.
  const [configCrua, precosCrus] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { key: ASTRO_CONFIG_KEY } }),
    prisma.siteSetting.findUnique({ where: { key: ASTRO_PRECOS_KEY } }),
  ]);
  const tabelaPrecos = lerTabelaDePrecos(precosCrus?.value);
  const config = lerConfig(configCrua?.value);
  if (!config.ativo) return indisponivel("desligado");

  const modelo = resolverModelo(config.modelo);
  if (!modelo) return indisponivel("sem_chave");

  // A última trava da fatura, antes do saldo: o saldo só segura quando a
  // cobrança está ligada, e nada impede abrir cem conversas curtas num dia.
  const teto = await conferirTetoDiario(org.id, config.tetoMensagensDiaPorOrg);
  if (!teto.ok) {
    return NextResponse.json(
      {
        erro: "teto_diario",
        usadas: teto.usadas,
        teto: teto.teto,
        mensagem:
          "A sua empresa já falou bastante comigo hoje. Amanhã eu volto — ou fale com um administrador para aumentar o limite.",
      },
      { status: 429 },
    );
  }

  if (!(await podeConversar(org.id))) {
    const saldo = await prisma.organization.findUnique({
      where: { id: org.id },
      select: { starsBalance: true },
    });
    return NextResponse.json(
      {
        erro: "sem_saldo",
        saldo: emEstrelas(saldo?.starsBalance),
        mensagem: "Suas Stars acabaram. Compre mais para continuar a conversa.",
      },
      { status: 402 },
    );
  }

  const agora = new Date();
  // Escopada por organização E usuário: o id da sessão vem do navegador, e
  // sem isto um id adivinhado continuaria a conversa de outra pessoa.
  const sessao = corpo.data.sessionId
    ? await prisma.siteChatSession.findFirst({
        where: {
          id: corpo.data.sessionId,
          channel: "APP",
          organizationId: org.id,
          userId: sessaoAuth.user.id,
          expiresAt: { gt: agora },
        },
        select: { id: true, messageCount: true },
      })
    : null;

  /*
    Aqui NÃO há teto por sessão, e é de propósito.

    O teto de 30 mensagens é do canal do site, onde quem fala é visitante
    anônimo e a única trava contra abuso é a contagem. No canal logado existem
    duas travas que o site não tem: cada resposta é cobrada em ★ da própria
    organização, com pré-checagem de saldo, e há o teto diário por organização
    logo acima. Somar um limite por conversa a isso só criava um beco sem
    saída no meio do trabalho de quem está pagando pela conversa.
  */

  const sessaoAtual = sessao
    ? await prisma.siteChatSession.update({
        where: { id: sessao.id },
        data: { messageCount: { increment: 1 } },
        select: { id: true },
      })
    : await prisma.siteChatSession.create({
        data: {
          channel: "APP",
          organizationId: org.id,
          userId: sessaoAuth.user.id,
          userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
          messageCount: 1,
          expiresAt: new Date(agora.getTime() + SESSAO_HORAS * 60 * 60 * 1000),
        },
        select: { id: true },
      });

  const tools = construirToolsDoApp({
    organizationId: org.id,
    userId: sessaoAuth.user.id,
    sessaoId: sessaoAtual.id,
    tabelaPrecos,
    falaDoVisitante: falaDoVisitante(mensagens),
    modelo,
  });

  // O AI SDK confere a forma de cada mensagem antes de ela virar prompt: o
  // histórico inteiro vem do navegador, e parte malformada não deve chegar ao
  // conversor. O argumento de entrada de cada tool não é conferido aqui, e
  // nem precisa — quem o valida é o `inputSchema` dela, na execução.
  const validadas = await safeValidateUIMessages<UIMessage>({
    messages: corpo.data.messages,
  });
  if (!validadas.success) {
    return NextResponse.json({ erro: "corpo_invalido" }, { status: 400 });
  }

  // Os avisos abertos e o que ele guardou desta empresa. As duas leituras são
  // por `organizationId` e entram no prompt cortadas — o teto está em
  // `prompt.ts`, porque quem paga o tamanho é toda mensagem da conversa.
  const [avisosAbertos, memoria] = await Promise.all([
    prisma.astroAviso.findMany({
      where: { organizationId: org.id, lidoEm: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { titulo: true, corpo: true },
    }),
    prisma.astroMemoria.findMany({
      where: { organizationId: org.id },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: { chave: true, texto: true },
    }),
  ]);

  // Cada passo que volta com fontes é uma busca do provedor, cobrada no fim
  // junto com os tokens: uma escrita só, e nunca no meio do stream.
  let buscasNaWeb = 0;

  const resultado = await streamAstroConsultor({
    escopo: "app",
    sessaoId: sessaoAtual.id,
    tabelaPrecos,
    modelo,
    mensagens: validadas.data,
    organizacao: org.name,
    usuario: `${sessaoAuth.user.name} (${sessaoAuth.user.email})`,
    // Quem fala já é conhecido: vai como "visitante" para ele não perguntar.
    visitante: { nome: sessaoAuth.user.name, empresa: org.name },
    avisos: avisosAbertos,
    memoria,
    toolApproval: CONFIGURACAO_DE_APROVACAO,
    approvalSecret: segredoDeAprovacao(),
    tools,
    // Resolução média nas imagens: alta multiplica os tokens de visão por
    // anexo, e para ler rótulo, gôndola e nota fiscal a média resolve.
    ...(modelo.provedor === "google" && anexos.length > 0
      ? {
          providerOptions: {
            google: { mediaResolution: "MEDIA_RESOLUTION_MEDIUM" },
          },
        }
      : {}),
    aoBuscarNaWeb: () => {
      buscasNaWeb += 1;
    },
    // Uma linha por tool executada, com organização, sessão e duração. É o
    // que permite responder "por que a conversa demorou" e "quem chamou o
    // quê" sem ler a conversa de ninguém — nem o argumento, nem a resposta.
    aoTerminarTool: (evento) => {
      console.info("[astro] tool", {
        organizationId: org.id,
        sessaoId: sessaoAtual.id,
        tool: evento.tool,
        ms: evento.duracaoMs,
        falhou: evento.falhou,
      });
    },
    onFinish: async ({ tokensIn, tokensOut }) => {
      await prisma.siteChatSession.update({
        where: { id: sessaoAtual.id },
        data: {
          tokensIn: { increment: tokensIn },
          tokensOut: { increment: tokensOut },
        },
      });
      // Falha na cobrança não pode derrubar o stream que já foi entregue;
      // fica no log, e o pré-check da próxima mensagem segura o resto.
      try {
        await cobrarTokensDoAstro({
          organizationId: org.id,
          userId: sessaoAuth.user.id,
          tokensIn,
          tokensOut,
        });
        if (buscasNaWeb > 0) {
          await cobrarBuscasNaWeb({
            organizationId: org.id,
            userId: sessaoAuth.user.id,
            passos: buscasNaWeb,
          });
        }
      } catch (erro) {
        console.error("[astro] falha ao cobrar tokens", erro);
      }

      // O fecho da conversa longa, quando a organização ligou isso. É o único
      // uso de IA fora da conversa, e falhar aqui não pode estragar uma
      // resposta que já foi entregue.
      if (
        config.resumirConversas &&
        (sessao?.messageCount ?? 0) + 1 >= MENSAGENS_PARA_RESUMIR
      ) {
        try {
          await resumirConversa({
            organizationId: org.id,
            userId: sessaoAuth.user.id,
            sessaoId: sessaoAtual.id,
            modelo,
            mensagens: validadas.data,
          });
        } catch (erro) {
          console.error("[astro] falha ao resumir a conversa", erro);
        }
      }
    },
  });

  return resultado.toUIMessageStreamResponse({
    headers: { "x-astro-session": sessaoAtual.id },
  });
}
