"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type EstadoImpressora, ImpressoraBluetooth } from "../lib/ble-printer";
import { bluetoothDisponivel } from "../lib/web-bluetooth";

export type AjustesDaImpressora = {
  tamanhoDoBloco: number;
  pausaMs: number;
};

const CHAVE = "impressora-termica:ajustes";

export const AJUSTES_PADRAO: AjustesDaImpressora = {
  tamanhoDoBloco: 20,
  pausaMs: 30,
};

export function carregarAjustes(): AjustesDaImpressora {
  if (typeof window === "undefined") return AJUSTES_PADRAO;
  try {
    const salvo = window.localStorage.getItem(CHAVE);
    if (!salvo) return AJUSTES_PADRAO;
    const lido = JSON.parse(salvo) as Partial<AjustesDaImpressora>;
    return { ...AJUSTES_PADRAO, ...lido };
  } catch {
    return AJUSTES_PADRAO;
  }
}

export function salvarAjustes(ajustes: AjustesDaImpressora) {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(ajustes));
  } catch {
    // Navegador anônimo ou armazenamento bloqueado: os ajustes valem só
    // enquanto a aba viver, o que é aceitável para uma preferência de aparelho.
  }
}

export function useImpressora() {
  const [estado, setEstado] = useState<EstadoImpressora>("desconectada");
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const [nome, setNome] = useState<string | null>(null);
  const [ajustes, setAjustes] = useState<AjustesDaImpressora>(AJUSTES_PADRAO);
  const impressora = useRef<ImpressoraBluetooth | null>(null);

  useEffect(() => {
    if (!bluetoothDisponivel()) {
      setEstado("sem-suporte");
      return;
    }
    setAjustes(carregarAjustes());
  }, []);

  const obter = useCallback(() => {
    if (!impressora.current) {
      impressora.current = new ImpressoraBluetooth((novo, msg) => {
        setEstado(novo);
        setDetalhe(msg ?? null);
      }, carregarAjustes());
    }
    return impressora.current;
  }, []);

  const conectar = useCallback(async () => {
    const alvo = obter();
    await alvo.conectar();
    setNome(alvo.nome);
  }, [obter]);

  const desconectar = useCallback(() => {
    impressora.current?.desconectar();
    setNome(null);
  }, []);

  const imprimir = useCallback(
    async (bytes: Uint8Array) => {
      await obter().imprimir(bytes);
    },
    [obter],
  );

  const aplicarAjustes = useCallback((novos: AjustesDaImpressora) => {
    setAjustes(novos);
    salvarAjustes(novos);
    impressora.current?.ajustar(novos);
  }, []);

  return {
    estado,
    detalhe,
    nome,
    ajustes,
    aplicarAjustes,
    conectar,
    desconectar,
    imprimir,
    conectada: estado === "conectada",
  };
}
