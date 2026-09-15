"use client";

import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { passoAtual, rotaDoPasso } from "../engine/maquina";
import { useJornadaStore } from "../hooks/use-jornada-store";
import {
  useAvancarJornada,
  useConcluirJornada,
  useJornadas,
} from "../hooks/use-jornadas";
import {
  abrirGatilho,
  acharAlvo,
  ATRIBUTO,
  containerDoAlvo,
  esperarAlvo,
  revelarAlvo,
} from "../lib/alvo";
import { casaRota } from "../lib/rota";
import { BalaoDaJornada } from "./balao-da-jornada";

interface Caixa {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Espaço entre o alvo e o balão. */
const FOLGA = 10;

/**
 * O motor da jornada guiada, montado uma vez no leiaute logado.
 *
 * Ele nunca clica por ninguém. Destaca o alvo, explica, e espera — a pessoa é
 * quem faz. Um tour que executa sozinho entrega a tarefa e não ensina o
 * caminho, que é justamente o que faria o chamado voltar na semana seguinte.
 */
export function JornadaRunner() {
  const [montado, setMontado] = useState(false);
  const pathname = usePathname();
  const { estado, jornada, despachar, hidratar } = useJornadaStore();
  const { data } = useJornadas();
  const avancarNoServidor = useAvancarJornada();
  const concluir = useConcluirJornada();
  const { setOpen, setOpenMobile, isMobile } = useSidebar();

  const [alvo, setAlvo] = useState<HTMLElement | null>(null);
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  // Só depois de montar: o `sessionStorage` não existe no servidor, e decidir
  // no primeiro render daria marcação diferente entre servidor e navegador.
  useEffect(() => {
    setMontado(true);
    hidratar();
  }, [hidratar]);

  /*
    Trocar de empresa encerra a jornada.

    O `queryClient.clear()` do seletor de organização não alcança o zustand nem
    o sessionStorage, então sem esta conferência a jornada continuaria correndo
    com o menu, as permissões e o saldo de outra operação.
  */
  useEffect(() => {
    if (!("sessao" in estado) || !data) return;
    if (estado.sessao.organizationId !== data.organizationId) {
      despachar({ tipo: "FECHAR" });
    }
  }, [estado, data, despachar]);

  // A rota mudou: pode ser o passo de navegar que se cumpriu, ou a pessoa
  // saindo da tela do passo.
  useEffect(() => {
    if (estado.fase === "ociosa" || estado.fase === "concluida") return;
    despachar({ tipo: "ROTA_MUDOU", pathname, agora: Date.now() });
  }, [pathname, estado.fase, despachar]);

  /*
    A sidebar entra por REFERÊNCIA, não pela lista de dependências.

    O efeito abaixo espera o alvo por até oito segundos e reinicia — abortando
    a espera — toda vez que uma dependência troca de identidade. Com as funções
    da sidebar na lista, qualquer re-render do leiaute matava a espera antes de
    ela terminar: o passo cujo alvo não existia ficava presto para sempre, sem
    destaque e sem o aviso de que o alvo não foi achado.
  */
  const sidebarRef = useRef({ setOpen, setOpenMobile, isMobile });
  useEffect(() => {
    sidebarRef.current = { setOpen, setOpenMobile, isMobile };
  }, [setOpen, setOpenMobile, isMobile]);

  const fase = estado.fase;
  const passoIndice = "sessao" in estado ? estado.sessao.passo : -1;
  const jornadaId = "sessao" in estado ? estado.sessao.jornadaId : null;

  /*
    Procurar o alvo do passo.

    Abre a sidebar quando o alvo mora nela, e clica no grupo antes quando o
    alvo é um sub-item: o `Collapsible` fechado não monta os filhos, então
    procurar ali seria procurar o que ainda não existe.
  */
  useEffect(() => {
    if (fase !== "procurandoAlvo" || !jornada || !jornadaId) return;

    const passo = jornada.passos[passoIndice];
    if (!passo) return;

    // Passo de navegar não tem alvo: ele espera a rota, não o DOM.
    if (passo.tipo === "navegar") {
      setAlvo(null);
      setCaixa(null);
      despachar({ tipo: "ALVO_ENCONTRADO", agora: Date.now() });
      return;
    }

    if (!casaRota(rotaDoPasso(jornada, passoIndice), pathname)) {
      despachar({ tipo: "ALVO_NAO_ENCONTRADO", motivo: "foraDaRota" });
      return;
    }

    const abortar = new AbortController();

    const procurar = async () => {
      if (passo.precisaDaSidebar) {
        const sidebar = sidebarRef.current;
        if (sidebar.isMobile) sidebar.setOpenMobile(true);
        else sidebar.setOpen(true);
      }
      if (passo.abrirAntes && !acharAlvo(passo.alvo ?? "")) {
        const gatilho = acharAlvo(passo.abrirAntes);
        if (gatilho) abrirGatilho(gatilho);
      }

      const encontrado = passo.alvo
        ? await esperarAlvo(passo.alvo, { signal: abortar.signal })
        : null;
      if (abortar.signal.aborted) return;

      if (!encontrado) {
        despachar({ tipo: "ALVO_NAO_ENCONTRADO", motivo: "timeout" });
        return;
      }

      revelarAlvo(encontrado);
      setAlvo(encontrado);
      setContainer(containerDoAlvo(encontrado));
      despachar({ tipo: "ALVO_ENCONTRADO", agora: Date.now() });
    };

    void procurar();
    return () => abortar.abort();
    // Só o que IDENTIFICA o passo entra aqui. Qualquer coisa a mais reinicia a
    // espera pelo alvo, e o passo nunca conclui nem desiste.
  }, [fase, jornadaId, passoIndice, jornada, pathname, despachar]);

  /*
    O clique e a digitação da PESSOA, ouvidos na fase de captura.

    Captura porque o alvo costuma sumir logo em seguida — o botão abre um
    diálogo, o link navega e o React desmonta a árvore. Na fase de bolha o
    evento chegaria depois disso.

    E sem `preventDefault` em nenhuma hipótese: o clique precisa fazer o
    trabalho de verdade, senão a jornada vira encenação.
  */
  useEffect(() => {
    if (estado.fase !== "mostrando") return;

    const aoClicar = (evento: MouseEvent) => {
      const alcancado = (evento.target as Element | null)?.closest<HTMLElement>(
        `[${ATRIBUTO}]`,
      );
      const chave = alcancado?.dataset.jornada;
      if (!chave) return;
      despachar({ tipo: "CLIQUE_NO_ALVO", chave, agora: Date.now() });
    };

    const aoDigitar = (evento: Event) => {
      const campo = (evento.target as Element | null)?.closest<HTMLElement>(
        `[${ATRIBUTO}]`,
      );
      const chave = campo?.dataset.jornada;
      if (!chave) return;
      const valor = (evento.target as HTMLInputElement | null)?.value ?? "";
      despachar({ tipo: "DIGITOU", chave, valor, agora: Date.now() });
    };

    document.addEventListener("click", aoClicar, true);
    document.addEventListener("input", aoDigitar, true);
    return () => {
      document.removeEventListener("click", aoClicar, true);
      document.removeEventListener("input", aoDigitar, true);
    };
  }, [estado.fase, despachar]);

  /*
    Onde desenhar o anel e o balão.

    As coordenadas são relativas ao container, não à janela: dentro de um
    diálogo do Radix há `transform`, que passa a ser o bloco de referência de
    tudo o que é posicionado ali dentro.
  */
  const medir = useCallback(() => {
    if (!alvo || !container) return;
    const doAlvo = alvo.getBoundingClientRect();
    const doContainer =
      container === document.body
        ? { top: -window.scrollY, left: -window.scrollX }
        : container.getBoundingClientRect();
    setCaixa({
      top: doAlvo.top - doContainer.top,
      left: doAlvo.left - doContainer.left,
      width: doAlvo.width,
      height: doAlvo.height,
    });
  }, [alvo, container]);

  useLayoutEffect(() => {
    if (!alvo) {
      setCaixa(null);
      return;
    }
    medir();

    const observador = new ResizeObserver(medir);
    observador.observe(alvo);
    // `scroll` em captura: o conteúdo rola dentro do `<main>` e da grade do
    // PDV, e um ouvinte só na janela não vê nenhum dos dois.
    window.addEventListener("scroll", medir, true);
    window.addEventListener("resize", medir);
    return () => {
      observador.disconnect();
      window.removeEventListener("scroll", medir, true);
      window.removeEventListener("resize", medir);
    };
  }, [alvo, medir]);

  /*
    As mutations entram por REFERÊNCIA, pelo mesmo motivo da sidebar: o objeto
    que `useMutation` devolve troca de identidade a cada mudança de estado
    dela, e na lista de dependências isso reexecuta o efeito no meio da própria
    chamada que ele disparou.
  */
  const mutationsRef = useRef({ avancarNoServidor, concluir });
  useEffect(() => {
    mutationsRef.current = { avancarNoServidor, concluir };
  }, [avancarNoServidor, concluir]);

  // Guarda o passo no servidor, para quem fecha a aba voltar de onde parou.
  const ultimoGravado = useRef<string>("");
  useEffect(() => {
    if (estado.fase !== "mostrando") return;
    const { jornadaId, passo, apressos } = estado.sessao;
    const marca = `${jornadaId}:${passo}`;
    if (ultimoGravado.current === marca) return;
    ultimoGravado.current = marca;
    mutationsRef.current.avancarNoServidor.mutate({
      jornadaId,
      passo,
      apressos,
    });
  }, [estado]);

  // O fecho: conclui no servidor e conta o que aconteceu com as ★.
  const concluindoRef = useRef<string>("");
  useEffect(() => {
    if (estado.fase !== "concluindo") return;
    const { jornadaId, apressos, tempos } = estado.sessao;
    if (concluindoRef.current === jornadaId) return;
    concluindoRef.current = jornadaId;

    mutationsRef.current.concluir.mutate(
      { jornadaId, apressos, tempos },
      {
        onSuccess: (resultado) => {
          concluindoRef.current = "";
          despachar({
            tipo: "CONCLUIDA",
            starsCreditadas: resultado.starsCreditadas,
            resgatadaPor: resultado.resgatadaPor,
            motivo: resultado.motivo,
          });
        },
        onError: () => {
          concluindoRef.current = "";
          despachar({ tipo: "FALHOU_CONCLUIR" });
        },
      },
    );
  }, [estado, despachar]);

  // O cartão final some sozinho — é comemoração, não instrução.
  useEffect(() => {
    if (estado.fase !== "concluida") return;
    const relogio = setTimeout(() => despachar({ tipo: "FECHAR" }), 8000);
    return () => clearTimeout(relogio);
  }, [estado.fase, despachar]);

  if (!montado || estado.fase === "ociosa") return null;

  const fechar = () => despachar({ tipo: "FECHAR" });

  if (estado.fase === "concluida") {
    return createPortal(
      <div
        className="jornada-balao"
        style={{
          position: "fixed",
          right: "1rem",
          bottom: "calc(var(--o-astro-espaco, 5rem) + 0.75rem)",
          left: "auto",
          top: "auto",
        }}
      >
        <p className="font-semibold">Jornada concluída!</p>
        <p className="mt-1 text-muted-foreground">{textoDoFecho(estado)}</p>
        <div className="mt-3 flex justify-end">
          <Button type="button" size="sm" onClick={fechar}>
            Fechar
          </Button>
        </div>
      </div>,
      document.body,
    );
  }

  if (estado.fase === "alvoAusente") {
    const passo = jornada ? passoAtual(jornada, estado.sessao) : null;
    const destino = jornada
      ? rotaDoPasso(jornada, estado.sessao.passo)
      : undefined;
    return createPortal(
      <div
        className="jornada-balao"
        style={{
          position: "fixed",
          right: "1rem",
          bottom: "calc(var(--o-astro-espaco, 5rem) + 0.75rem)",
          left: "auto",
          top: "auto",
        }}
      >
        <p className="font-semibold">Não achei esta parte da tela</p>
        <p className="mt-1 text-muted-foreground">
          {`${passo?.titulo ?? "O próximo passo"} acontece em ${destino ?? "outra tela"}.`}
        </p>
        <div className="mt-3 flex justify-end gap-1.5">
          <Button type="button" variant="ghost" size="sm" onClick={fechar}>
            Fechar instrução
          </Button>
          {destino && (
            <Button type="button" size="sm" asChild>
              <a href={destino}>Ir para a tela</a>
            </Button>
          )}
        </div>
      </div>,
      document.body,
    );
  }

  if (estado.fase !== "mostrando" || !jornada || !container) return null;

  const passo = passoAtual(jornada, estado.sessao);
  if (!passo) return null;

  // Passo de navegar não aponta para nada: a tira fica no rodapé.
  const semAlvo = passo.tipo === "navegar" || !caixa;
  const posicaoDoBalao = semAlvo
    ? {
        position: "fixed" as const,
        right: "1rem",
        bottom: "calc(var(--o-astro-espaco, 5rem) + 0.75rem)",
      }
    : posicionarBalao(caixa);

  return createPortal(
    <>
      {caixa && !semAlvo && (
        <div
          className="jornada-anel"
          style={{
            top: caixa.top - 4,
            left: caixa.left - 4,
            width: caixa.width + 8,
            height: caixa.height + 8,
          }}
        />
      )}
      <div className="jornada-balao" style={posicaoDoBalao}>
        <BalaoDaJornada
          passo={passo}
          indice={estado.sessao.passo}
          total={jornada.passos.length}
          falaDePressa={estado.falaDePressa}
          podeAvancar={passo.tipo === "ler"}
          aoAvancar={() => despachar({ tipo: "PROXIMO", agora: Date.now() })}
          aoFechar={fechar}
        />
      </div>
    </>,
    container,
  );
}

/** Largura a partir da qual o balão flutua ao lado do alvo. */
const LARGURA_DO_BALAO_FLUTUANTE = 768;

/**
 * Abaixo do alvo; acima quando não cabe embaixo.
 *
 * Numa tela estreita devolve nada: o balão vira a tira do rodapé, e quem
 * manda nela é o CSS. Escrever posição aqui obrigaria a folha de estilo a
 * brigar com estilo embutido, que ela não ganha.
 */
function posicionarBalao(caixa: Caixa) {
  if (window.innerWidth < LARGURA_DO_BALAO_FLUTUANTE) return undefined;
  const cabeEmbaixo =
    caixa.top + caixa.height + FOLGA + 190 < window.innerHeight;
  return {
    top: cabeEmbaixo
      ? caixa.top + caixa.height + FOLGA
      : Math.max(FOLGA, caixa.top - FOLGA - 190),
    left: Math.max(FOLGA, Math.min(caixa.left, window.innerWidth - 340)),
  };
}

function textoDoFecho(estado: {
  starsCreditadas: number;
  resgatadaPor: string | null;
  motivo: string;
}): string {
  if (estado.motivo === "creditada") {
    return `+${estado.starsCreditadas} ★ para a sua empresa. Bom trabalho!`;
  }
  if (estado.motivo === "ja_resgatada") {
    return estado.resgatadaPor
      ? `${estado.resgatadaPor} já tinha garantido as ★ desta jornada para a empresa — mas o que você aprendeu é seu.`
      : "As ★ desta jornada já tinham sido resgatadas na sua empresa.";
  }
  if (estado.motivo === "ja_concluida") {
    return "Você já tinha feito esta jornada. Repetir para relembrar é sempre válido.";
  }
  if (estado.motivo === "org_nao_elegivel") {
    return "Esta conta ainda não recebe ★ por jornada. Vincule uma conta de verdade para começar a ganhar.";
  }
  return "Esta jornada não está valendo ★ no momento.";
}
