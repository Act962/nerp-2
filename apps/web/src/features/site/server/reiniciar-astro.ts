import "server-only";

import { generateText } from "ai";

import { podeConversar } from "@/features/astro/server/cobranca";
import { modeloDoNivel, NIVEIS } from "@/features/astro/server/modelos";
import { conferirTetoDiario } from "@/features/astro/server/teto-diario";
import {
  ASTRO_CONFIG_KEY,
  lerConfig,
  resolverModelo,
} from "@/features/astro-consultor/server/provider";
import { emEstrelas } from "@/features/stars/lib/decimal";
import prisma from "@/lib/db";

/**
 * Por que o Astro de uma empresa não responde — e o que dá para reiniciar.
 *
 * O diagnóstico repete as MESMAS travas da rota, na mesma ordem, chamando as
 * mesmas funções: `conferirTetoDiario` e `podeConversar`. Reimplementar a
 * regra aqui daria um painel que diz "está tudo bem" enquanto a rota recusa —
 * que é pior que não ter painel nenhum.
 *
 * **O que este arquivo NÃO consegue reiniciar:** a conversa em si. O histórico
 * mora no `sessionStorage` da aba de quem está falando (ver
 * `packages/astro-widget`), e o navegador reenvia tudo a cada mensagem. Nenhum
 * botão de servidor apaga isso — quem apaga é o "Recomeçar" do próprio widget.
 * A tela diz isso em voz alta, porque um admin que acha que resolveu e não
 * resolveu é o pior resultado possível.
 */

const DIA_MS = 24 * 60 * 60 * 1000;

export type MotivoDoBloqueio =
  | "ok"
  | "desligado"
  | "sem_chave"
  | "teto_diario"
  | "sem_saldo";

export type DiagnosticoDoAstro = {
  motivo: MotivoDoBloqueio;
  saldo: number;
  /** Mensagens somadas nas últimas 24 h — o que o teto conta. */
  mensagensNoDia: number;
  tetoPorOrg: number;
  sessoesAbertas: number;
  memorias: number;
  ultimaConversa: string | null;
};

export async function diagnosticarAstro(
  organizationId: string,
  agora = new Date(),
): Promise<DiagnosticoDoAstro> {
  const desde = new Date(agora.getTime() - DIA_MS);

  const linhaDeConfig = await prisma.siteSetting.findUnique({
    where: { key: ASTRO_CONFIG_KEY },
  });
  const config = lerConfig(linhaDeConfig?.value);

  const [org, mensagens, sessoesAbertas, memorias, ultima] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { starsBalance: true },
    }),
    prisma.siteChatSession.aggregate({
      where: { organizationId, channel: "APP", createdAt: { gte: desde } },
      _sum: { messageCount: true },
    }),
    prisma.siteChatSession.count({
      where: { organizationId, channel: "APP", expiresAt: { gt: agora } },
    }),
    prisma.astroMemoria.count({ where: { organizationId } }),
    prisma.siteChatSession.findFirst({
      where: { organizationId, channel: "APP" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  const base = {
    saldo: emEstrelas(org?.starsBalance),
    mensagensNoDia: mensagens._sum.messageCount ?? 0,
    tetoPorOrg: config.tetoMensagensDiaPorOrg,
    sessoesAbertas,
    memorias,
    ultimaConversa: ultima?.createdAt.toISOString() ?? null,
  };

  // A ordem é a da rota: desligado vem antes de chave, que vem antes de teto,
  // que vem antes de saldo. Mostrar o segundo motivo enquanto o primeiro
  // barraria mandaria o suporte consertar a coisa errada.
  if (!config.ativo) return { ...base, motivo: "desligado" };
  if (!resolverModelo(config.modelo || undefined)) {
    return { ...base, motivo: "sem_chave" };
  }

  const teto = await conferirTetoDiario(
    organizationId,
    config.tetoMensagensDiaPorOrg,
    agora,
  );
  if (!teto.ok) return { ...base, motivo: "teto_diario" };

  if (!(await podeConversar(organizationId))) {
    return { ...base, motivo: "sem_saldo" };
  }

  return { ...base, motivo: "ok" };
}

export type ResultadoDoReinicio = {
  sessoesEncerradas: number;
  contadorZerado: number;
  memoriasApagadas: number;
};

/**
 * Reinicia o que é reiniciável do lado do servidor.
 *
 * As sessões são **expiradas**, não apagadas: elas são o livro-caixa do custo
 * com o provedor — é delas que a aba Stars soma tokens e modelo. Apagar para
 * "limpar" faria o gasto do mês encolher sozinho, que é a pior forma de
 * perder dinheiro: sem erro nenhum na tela.
 *
 * Zerar o contador do teto é opcional e separado porque é o único efeito que
 * mexe num número já contado. `messageCount` só alimenta o teto diário; os
 * tokens, que são o custo, ficam intactos.
 */
export async function reiniciarAstroDaOrg(entrada: {
  organizationId: string;
  liberarTeto: boolean;
  apagarMemoria: boolean;
  agora?: Date;
}): Promise<ResultadoDoReinicio> {
  const agora = entrada.agora ?? new Date();
  const desde = new Date(agora.getTime() - DIA_MS);

  const encerradas = await prisma.siteChatSession.updateMany({
    where: {
      organizationId: entrada.organizationId,
      channel: "APP",
      expiresAt: { gt: agora },
    },
    data: { expiresAt: agora },
  });

  const zeradas = entrada.liberarTeto
    ? await prisma.siteChatSession.updateMany({
        where: {
          organizationId: entrada.organizationId,
          channel: "APP",
          createdAt: { gte: desde },
        },
        data: { messageCount: 0 },
      })
    : { count: 0 };

  const memorias = entrada.apagarMemoria
    ? await prisma.astroMemoria.deleteMany({
        where: { organizationId: entrada.organizationId },
      })
    : { count: 0 };

  return {
    sessoesEncerradas: encerradas.count,
    contadorZerado: zeradas.count,
    memoriasApagadas: memorias.count,
  };
}

export type TesteDeUmModelo = {
  nivel: string;
  modelo: string;
  ok: boolean;
  /** A mensagem do provedor, quando falhou. Nunca inclui a chave. */
  erro: string | null;
};

/**
 * Bate na porta do provedor, um modelo por nível de dificuldade.
 *
 * Testa os modelos que a ROTA escolhe (`MODELO_DO_NIVEL`), e não o padrão do
 * consultor. A diferença não é detalhe: `ASTRO_CONSULTOR_MODEL` no ambiente
 * aponta para a OpenAI, então um teste do "modelo configurado" respondia por
 * um provedor que o Astro da organização nem usa — e dizia que estava tudo bem
 * enquanto a Google recusava tudo.
 *
 * Um por nível porque a falha pode ser parcial: foi exatamente o que
 * aconteceu — perguntas leves iam para um modelo e as pesadas para outro, e só
 * um lado quebrou. Um teste só teria escondido metade do problema.
 *
 * Não roda sozinho ao abrir a tela: são chamadas pagas, disparadas no botão.
 * O prompt é o menor possível, e 16 tokens de saída é o mínimo que a OpenAI
 * aceita — abaixo disso ela recusa a requisição por validação, o que pareceria
 * um provedor fora do ar.
 */
export async function testarProvedor(): Promise<TesteDeUmModelo[]> {
  const linha = await prisma.siteSetting.findUnique({
    where: { key: ASTRO_CONFIG_KEY },
  });
  const config = lerConfig(linha?.value);

  // Com modelo fixado à mão, é ele que atende os três níveis — testar os
  // outros mediria algo que não está em uso.
  const alvos =
    config.modeloFixo && config.modelo
      ? [{ nivel: "fixo", id: config.modelo }]
      : NIVEIS.map((nivel) => ({ nivel, id: modeloDoNivel(nivel).id }));

  return Promise.all(
    alvos.map(async ({ nivel, id }) => {
      const resolvido = resolverModelo(id);
      if (!resolvido) {
        return {
          nivel,
          modelo: id,
          ok: false,
          erro: "Nenhuma chave de IA configurada no ambiente.",
        };
      }
      try {
        await generateText({
          model: resolvido.modelo,
          prompt: "ok",
          maxOutputTokens: 16,
        });
        return { nivel, modelo: resolvido.nome, ok: true, erro: null };
      } catch (erro) {
        const texto = erro instanceof Error ? erro.message : String(erro);
        return {
          nivel,
          modelo: resolvido.nome,
          ok: false,
          erro: texto.slice(0, 300),
        };
      }
    }),
  );
}
