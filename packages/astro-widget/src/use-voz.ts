"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Falar com o Astro.
 *
 * Reconhecimento de voz do próprio navegador (Web Speech API), o mesmo
 * caminho do NASAEX-WEY: sem biblioteca, sem áudio subindo para lugar nenhum,
 * sem custo por minuto. O navegador transcreve e devolve texto.
 *
 * O texto vai para o CAMPO, não direto para o envio. Reconhecimento em
 * português erra nome de produto e número com frequência, e mandar sozinho
 * transformaria cada engano numa pergunta paga — e, num cartão de aprovação,
 * numa ação que a pessoa não pediu.
 *
 * Sem suporte no navegador (Firefox, e o Safari mais antigo), `suportado` vem
 * `false` e quem chama não desenha o botão: botão que não faz nada é pior que
 * botão que não existe.
 */

export type EstadoDaVoz = "parado" | "ouvindo" | "processando";

type ReconhecimentoLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((evento: EventoDeFala) => void) | null;
};

type EventoDeFala = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type JanelaComVoz = Window & {
  SpeechRecognition?: new () => ReconhecimentoLike;
  webkitSpeechRecognition?: new () => ReconhecimentoLike;
};

function construtorDeVoz(): (new () => ReconhecimentoLike) | null {
  if (typeof window === "undefined") return null;
  const janela = window as JanelaComVoz;
  return janela.SpeechRecognition ?? janela.webkitSpeechRecognition ?? null;
}

export function useVoz(aoTranscrever: (texto: string) => void) {
  const [estado, setEstado] = useState<EstadoDaVoz>("parado");
  const estadoRef = useRef<EstadoDaVoz>("parado");
  const sessaoRef = useRef<ReconhecimentoLike | null>(null);

  const mudar = useCallback((novo: EstadoDaVoz) => {
    estadoRef.current = novo;
    setEstado(novo);
  }, []);

  const suportado = construtorDeVoz() !== null;

  const alternar = useCallback(() => {
    const Reconhecimento = construtorDeVoz();
    if (!Reconhecimento) return;

    // Clicar de novo enquanto ouve é o jeito de parar — o mesmo botão.
    if (estadoRef.current === "ouvindo") {
      sessaoRef.current?.stop();
      return;
    }

    const sessao = new Reconhecimento();
    sessao.lang = "pt-BR";
    sessao.interimResults = false;
    sessao.maxAlternatives = 1;
    sessao.continuous = false;

    sessao.onstart = () => mudar("ouvindo");
    sessao.onerror = () => mudar("parado");
    sessao.onend = () => {
      // `onresult` já cuidou do estado quando houve transcrição; aqui só
      // sobra o caso de terminar sem ouvir nada.
      if (estadoRef.current === "ouvindo") mudar("parado");
    };
    sessao.onresult = (evento) => {
      const transcrito = evento.results[0]?.[0]?.transcript ?? "";
      mudar("processando");
      if (transcrito.trim()) aoTranscrever(transcrito.trim());
      // Um respiro antes de voltar ao normal: sem ele o botão pisca e a
      // pessoa não vê que foi ouvida.
      setTimeout(() => mudar("parado"), 400);
    };

    sessaoRef.current = sessao;
    sessao.start();
  }, [aoTranscrever, mudar]);

  return { estado, alternar, suportado };
}
