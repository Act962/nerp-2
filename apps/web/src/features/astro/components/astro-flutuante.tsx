"use client";

import {
  AstroWidget,
  type AvisoDoAstro,
  type FalhaDoAstro,
} from "@nerp/astro-widget";
import { useEffect, useMemo, useState } from "react";
import { useJornadaStore } from "@/features/jornadas/hooks/use-jornada-store";
import { useJornadas } from "@/features/jornadas/hooks/use-jornadas";
import { FerramentasDoAstro } from "@/features/jornadas/components/ferramentas-do-astro";
import { ListaDeJornadas } from "@/features/jornadas/components/lista-de-jornadas";
import { MelhoriasDialog } from "@/features/jornadas/components/melhorias-dialog";
import { ROTULO_DA_ACAO } from "@/features/astro/server/acoes/aprovacao";
import { subirAnexoDoAstro } from "@/features/astro/lib/anexar";
import {
  useAvisos,
  useMarcarAvisoFalado,
  useMarcarAvisoLido,
} from "@/features/astro/hooks/use-avisos";
import {
  MAX_ANEXOS_POR_MENSAGEM,
  TIPOS_DE_ANEXO_ACEITOS,
} from "@/features/astro/server/anexos";
import { Recarregar } from "@/features/stars/components/recarregar";
import { useInvalidarSaldo } from "@/features/stars/hooks/use-stars";
import { useCurrentMember } from "@/features/members/hooks/use-members";
import { hasFullAccess, isModuleVisible } from "@/lib/permissions";

/** O site institucional, para os cartões de solução abrirem a página certa. */
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://orbitatec.com.br";

const SUGESTOES = [
  {
    texto: "Como foram minhas vendas nos últimos 7 dias?",
    envio: "Como foram minhas vendas nos últimos 7 dias?",
  },
  {
    texto: "Quantos produtos, clientes e fornecedores eu tenho?",
    envio: "Quantos produtos, clientes e fornecedores eu tenho?",
  },
  {
    texto: "O que da ÓRBITA eu ainda não uso?",
    envio:
      "Quais ferramentas da ÓRBITA eu ainda não uso e poderiam ajudar a minha operação?",
  },
];

const AVISO_JORNADAS = "jornadas-pendentes";

/**
 * O aviso das jornadas não é uma linha do banco: ele se deriva do progresso.
 * "Falado" e "lido" valem para a aba — o mascote lembra uma vez por sessão, e
 * "Já vi" cala até a próxima.
 */
const CHAVE_AVISO_JORNADAS = "nerp:astro:aviso-jornadas";

function lerMarcaDoAviso(): { falado: boolean; lido: boolean } {
  try {
    const valor = sessionStorage.getItem(CHAVE_AVISO_JORNADAS);
    return { falado: valor !== null, lido: valor === "lido" };
  } catch {
    return { falado: false, lido: false };
  }
}

function gravarMarcaDoAviso(valor: "falado" | "lido"): void {
  try {
    sessionStorage.setItem(CHAVE_AVISO_JORNADAS, valor);
  } catch {}
}

/**
 * O Astro dentro do nerp: o mesmo widget do site, montado uma vez no leiaute
 * logado. O que muda é o destino (a rota autenticada, que cobra ★) e o que
 * acontece quando as ★ acabam — o 402 vira o botão de compra.
 */
export function AstroFlutuante() {
  const invalidarSaldo = useInvalidarSaldo();
  const { data: avisos } = useAvisos();
  const marcarLido = useMarcarAvisoLido();
  const marcarFalado = useMarcarAvisoFalado();
  const { member } = useCurrentMember();
  const podeComprar = hasFullAccess(member?.role);
  const [jornadasAbertas, setJornadasAbertas] = useState(false);
  const [melhoriasAbertas, setMelhoriasAbertas] = useState(false);
  const { data: jornadas } = useJornadas();
  const fase = useJornadaStore((estado) => estado.estado.fase);
  const [marcaDoAviso, setMarcaDoAviso] = useState({
    falado: true,
    lido: true,
  });

  // Só depois de montar: sessionStorage não existe no servidor.
  useEffect(() => setMarcaDoAviso(lerMarcaDoAviso()), []);

  const pendentes = useMemo(
    () =>
      (jornadas?.jornadas ?? []).filter(
        (jornada) =>
          jornada.ativa &&
          !jornada.meuProgresso?.concluidaEm &&
          // Quem tirou o módulo do menu não quer ser lembrado dele.
          isModuleVisible(jornada.modulo, {
            orgDisabledModules: member?.orgDisabledModules,
            userHiddenModules: member?.hiddenModules,
          }),
      ).length,
    [jornadas, member],
  );

  const todosOsAvisos = useMemo(() => {
    const doServidor: AvisoDoAstro[] = avisos?.avisos ?? [];
    // Com uma jornada em andamento o convite para outra só atrapalha.
    if (pendentes === 0 || fase !== "ociosa") return doServidor;
    const aviso: AvisoDoAstro = {
      id: AVISO_JORNADAS,
      severidade: "baixa",
      titulo:
        pendentes === 1
          ? "Você tem 1 jornada não concluída, inicie agora"
          : `Você tem ${pendentes} jornadas não concluídas, inicie agora`,
      corpo:
        "Eu te ensino cada tela passo a passo, e você ganha ★ para a empresa ao concluir.",
      lido: marcaDoAviso.lido,
      falado: marcaDoAviso.falado,
      acao: {
        rotulo: "Iniciar agora",
        executar: () => setJornadasAbertas(true),
      },
    };
    return [...doServidor, aviso];
  }, [avisos, pendentes, fase, marcaDoAviso]);

  const marcarAviso = (id: string, marca: "falado" | "lido") => {
    if (id !== AVISO_JORNADAS) {
      if (marca === "lido") marcarLido.mutate({ id });
      else marcarFalado.mutate({ id });
      return;
    }
    gravarMarcaDoAviso(marca);
    setMarcaDoAviso((atual) => ({
      falado: true,
      lido: atual.lido || marca === "lido",
    }));
  };

  const aoFalhar = (falha: FalhaDoAstro) => {
    if (falha.status !== 402) return null;
    const corpo = (falha.corpo ?? {}) as { saldo?: number };
    return (
      <div className="o-astro-cta">
        <p className="o-astro-cta__linha">
          Suas Stars acabaram ({corpo.saldo ?? 0} ★). Eu preciso de saldo para
          responder.
        </p>
        {podeComprar ? (
          <>
            <Recarregar voltarPara="/dashboard" size="sm" />
            {/*
              A outra saída. A recarga resolve hoje; o plano resolve todo mês —
              e quem bate no fim do saldo com frequência está pagando mais caro
              do que precisa. Oferecer só o avulso seria vender o pior dos dois
              negócios justamente a quem já mostrou que usa.
            */}
            <a className="o-astro-cta__linha" href="/configuracoes/planos">
              ou <strong>adquira um plano</strong> e ganhe ★ todo mês
            </a>
          </>
        ) : (
          <p className="o-astro-cta__linha">
            Peça a um administrador para comprar Stars ou escolher um plano.
          </p>
        )}
      </div>
    );
  };

  return (
    <>
      <AstroWidget
        api="/api/astro/chat"
        abertura="O que você quer saber da sua operação?"
        sugestoes={SUGESTOES}
        baseDosLinks={SITE}
        linksEmNovaAba
        nota="O Astro é uma inteligência artificial e pode errar. Cada resposta consome Stars da organização."
        acoes={ROTULO_DA_ACAO}
        avisos={todosOsAvisos}
        aoFalarAviso={(id) => marcarAviso(id, "falado")}
        aoLerAviso={(id) => marcarAviso(id, "lido")}
        enviarArquivo={subirAnexoDoAstro}
        tiposDeArquivo={TIPOS_DE_ANEXO_ACEITOS}
        maxArquivos={MAX_ANEXOS_POR_MENSAGEM}
        aoFalhar={aoFalhar}
        onResposta={invalidarSaldo}
        ferramentas={({ fechar }) => (
          <FerramentasDoAstro
            fechar={fechar}
            aoAbrirJornadas={() => setJornadasAbertas(true)}
            aoAbrirMelhorias={() => setMelhoriasAbertas(true)}
          />
        )}
      />

      <ListaDeJornadas
        aberto={jornadasAbertas}
        aoFechar={() => setJornadasAbertas(false)}
      />
      <MelhoriasDialog
        aberto={melhoriasAbertas}
        aoFechar={() => setMelhoriasAbertas(false)}
      />
    </>
  );
}
