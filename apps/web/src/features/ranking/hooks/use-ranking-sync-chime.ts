"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useErpSyncStatus } from "@/features/erp-sync/hooks/use-erp-sync";
import { orpc } from "@/lib/orpc";

// Áudio que o gestor gravou para anunciar "o pódio mudou". Fica em public/ para
// ser servido estático; trocar o arquivo troca o som.
const SYNC_CHIME_SRC = "/sounds/ranking-sync.mp3";

// Um único elemento reaproveitado entre disparos — evita criar um Audio novo a
// cada troca e deixa o browser cachear o arquivo depois da primeira vez.
let chimeAudio: HTMLAudioElement | null = null;

function playSyncChime(volume: number) {
  if (typeof window === "undefined") return;
  try {
    if (!chimeAudio) chimeAudio = new Audio(SYNC_CHIME_SRC);
    chimeAudio.volume = Math.max(Math.min(volume, 1), 0);
    chimeAudio.currentTime = 0;
    // Autoplay pode ser bloqueado sem gesto do usuário (aba recém-aberta que
    // nunca foi clicada) — engolimos o erro para não quebrar a tela.
    chimeAudio.play().catch(() => {});
  } catch {
    // Ambiente sem suporte a Audio — ignora.
  }
}

interface UseRankingSyncTop3ChimeOptions {
  /**
   * IDs do top 3 do ranking, em ordem (posição 1, 2, 3). `null` enquanto não há
   * dados suficientes. É a chave que comparamos antes × depois do sync.
   */
  top3Ids: string[] | null;
  /**
   * `dataUpdatedAt` da query do ranking. Serve de relógio: só comparamos o top 3
   * depois que uma busca nova de fato aterrissou pós-sync.
   */
  rankingUpdatedAt: number;
  /** Volume 0–1 (preferência do ranking). */
  volume?: number;
  /** Liga/desliga o alerta (mute global do ranking). */
  enabled?: boolean;
}

// Toca o áudio SÓ quando um sync do ERP termina E o top 3 do ranking mudou de
// posição. Tanto o cron automático quanto o clique em "Sincronizar agora"
// avançam o `lastSyncAt` do status — é esse avanço que arma a comparação.
//
// Fluxo: ao detectar o sync, guardamos o top 3 atual (pré-sync) e forçamos o
// ranking a rebuscar; quando os dados novos chegam (`rankingUpdatedAt` muda),
// comparamos o top 3 novo com o guardado. Diferente → toca. Não dispara no
// primeiro carregamento nem em troca de período/filtro — só num sync real.
export function useRankingSyncTop3Chime({
  top3Ids,
  rankingUpdatedAt,
  volume = 0.6,
  enabled = true,
}: UseRankingSyncTop3ChimeOptions) {
  const queryClient = useQueryClient();
  const statusQuery = useErpSyncStatus();
  const status = statusQuery.data;
  // `undefined` = ainda sem linha de base (sem ERP ou status carregando);
  // `null` = configurado mas nunca sincronizou.
  const lastSyncAt = status?.configured ? status.lastSyncAt : undefined;

  const top3Key = top3Ids && top3Ids.length > 0 ? top3Ids.join(">") : null;

  // Espelham o valor corrente pra os efeitos lerem sem virar dependência (evita
  // rearmar/recomparar por troca de volume/enabled).
  const top3Ref = useRef<string | null>(top3Key);
  const enabledRef = useRef(enabled);
  const volumeRef = useRef(volume);
  const syncBaselineRef = useRef<string | null | undefined>(undefined);
  const pendingRef = useRef<{ before: string | null; armedAt: number } | null>(
    null,
  );

  useEffect(() => {
    enabledRef.current = enabled;
    volumeRef.current = volume;
  }, [enabled, volume]);

  // Arma a comparação quando um sync novo termina. Este efeito precisa capturar
  // o top 3 ANTES de atualizarmos `top3Ref` (efeito abaixo), então fica antes.
  useEffect(() => {
    if (lastSyncAt === undefined) return;
    const previous = syncBaselineRef.current;
    syncBaselineRef.current = lastSyncAt;
    if (previous === undefined) return; // 1ª leitura só fixa a linha de base
    if (!enabledRef.current) return; // mudo: baseline avança, mas não arma
    if (lastSyncAt !== null && lastSyncAt !== previous) {
      pendingRef.current = {
        before: top3Ref.current,
        armedAt: rankingUpdatedAt,
      };
      // O cron automático não invalida o cache do cliente; forçamos o ranking a
      // rebuscar para termos os números novos (e um `rankingUpdatedAt` novo que
      // dispara a comparação abaixo).
      queryClient.invalidateQueries({ queryKey: orpc.ranking.key() });
    }
  }, [lastSyncAt, rankingUpdatedAt, queryClient]);

  // Mantém o top 3 corrente pra próxima comparação (depois do efeito de arme).
  useEffect(() => {
    top3Ref.current = top3Key;
  }, [top3Key]);

  // Quando uma busca nova do ranking aterrissa depois do sync, compara o top 3.
  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    // Ainda é o dado pré-sync — espera a busca disparada pelo arme aterrissar.
    if (rankingUpdatedAt === pending.armedAt) return;
    pendingRef.current = null;
    if (!enabledRef.current) return;
    if (
      pending.before !== null &&
      top3Key !== null &&
      top3Key !== pending.before
    ) {
      playSyncChime(volumeRef.current);
    }
  }, [rankingUpdatedAt, top3Key]);
}
