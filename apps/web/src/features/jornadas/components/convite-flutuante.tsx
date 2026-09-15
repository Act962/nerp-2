"use client";

import { AstroMark } from "@nerp/astro-widget";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useCurrentMember } from "@/features/members/hooks/use-members";
import { isModuleVisible } from "@/lib/permissions";
import { jornadasQueComecamEm } from "../catalogo";
import { useJornadaStore } from "../hooks/use-jornada-store";
import { useJornadas } from "../hooks/use-jornadas";
import { ConviteDialog } from "./convite-dialog";

/** Dispensar vale só para esta aba: o disco continua ali, o convite é que não se reabre. */
const CHAVE_DISPENSADO = "nerp:jornada:convite-dispensado";

function jaDispensou(id: string): boolean {
  try {
    return sessionStorage.getItem(`${CHAVE_DISPENSADO}:${id}`) === "1";
  } catch {
    return false;
  }
}

function dispensar(id: string): void {
  try {
    sessionStorage.setItem(`${CHAVE_DISPENSADO}:${id}`, "1");
  } catch {}
}

/**
 * O convite do Astro na tela que a pessoa ainda não aprendeu.
 *
 * Um segundo disco ao lado do widget, com a mesma cara do mascote — quem já
 * conhece o Astro reconhece de longe que é ele chamando. Some quando a jornada
 * daquela tela já foi feita, e some enquanto outra jornada está em andamento:
 * dois convites ao mesmo tempo é onde um tour vira pop-up.
 */
export function ConviteFlutuante() {
  const [montado, setMontado] = useState(false);
  const [aberto, setAberto] = useState(false);
  const pathname = usePathname();
  const { data } = useJornadas();
  const { member } = useCurrentMember();
  const fase = useJornadaStore((estado) => estado.estado.fase);

  useEffect(() => setMontado(true), []);

  const candidata = useMemo(() => {
    if (!data) return null;
    const daTela = jornadasQueComecamEm(pathname).map((j) => j.id);
    if (daTela.length === 0) return null;

    return (
      data.jornadas.find((jornada) => {
        if (!daTela.includes(jornada.id)) return false;
        if (!jornada.ativa) return false;
        if (jornada.meuProgresso?.concluidaEm) return false;
        // Módulo escondido é preferência de quem usa: quem tirou a tela do
        // menu não quer ser lembrado dela a cada visita.
        return isModuleVisible(jornada.modulo, {
          orgDisabledModules: member?.orgDisabledModules,
          userHiddenModules: member?.hiddenModules,
        });
      }) ?? null
    );
  }, [data, pathname, member]);

  // Abre sozinho na primeira vez que a pessoa cai numa tela com jornada — mas
  // uma vez por aba. O disco fica, para quem dispensou e mudou de ideia.
  useEffect(() => {
    if (!candidata || fase !== "ociosa") return;
    if (jaDispensou(candidata.id)) return;
    dispensar(candidata.id);
    setAberto(true);
  }, [candidata, fase]);

  if (!montado || !candidata || !data) return null;
  if (fase !== "ociosa") return null;

  return (
    <>
      <button
        type="button"
        className="jornada-convite"
        onClick={() => setAberto(true)}
        aria-label={`O Astro pode te ensinar esta tela: ${candidata.titulo}`}
        title={`Aprender: ${candidata.titulo}`}
      >
        <AstroMark className="size-full" />
      </button>

      <ConviteDialog
        jornada={candidata}
        organizationId={data.organizationId}
        aberto={aberto}
        aoFechar={() => setAberto(false)}
      />
    </>
  );
}
