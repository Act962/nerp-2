"use client";

import { AstroWidget, type FalhaDoAstro } from "@nerp/astro-widget";
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
import { hasFullAccess } from "@/lib/permissions";

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
    <AstroWidget
      api="/api/astro/chat"
      abertura="O que você quer saber da sua operação?"
      sugestoes={SUGESTOES}
      baseDosLinks={SITE}
      linksEmNovaAba
      nota="O Astro é uma inteligência artificial e pode errar. Cada resposta consome Stars da organização."
      acoes={ROTULO_DA_ACAO}
      avisos={avisos?.avisos}
      aoFalarAviso={(id) => marcarFalado.mutate({ id })}
      aoLerAviso={(id) => marcarLido.mutate({ id })}
      enviarArquivo={subirAnexoDoAstro}
      tiposDeArquivo={TIPOS_DE_ANEXO_ACEITOS}
      maxArquivos={MAX_ANEXOS_POR_MENSAGEM}
      aoFalhar={aoFalhar}
      onResposta={invalidarSaldo}
    />
  );
}
