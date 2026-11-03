"use client";

import { CheckIcon, MinusIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResultadoDoTeste } from "../application/mapear";
import { ALVOS } from "../domain/alvos";
import { textoDaCelula } from "./formatar";

/**
 * O que o NERP receberia: as linhas já com os nomes do NERP, a coluna "No NERP"
 * dizendo se o código bate com o cadastro e os problemas de cada linha.
 */
export function ResultadoTeste({ resultado }: { resultado: ResultadoDoTeste }) {
  const alvo = ALVOS[resultado.tipo.tipo];
  const { diagnostico, status } = resultado.tipo;

  if (status !== "pronto") {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
        <p className="font-medium text-destructive">
          O teste não rodou: o mapeamento ainda não está pronto.
        </p>
        <ul className="mt-1 list-disc pl-4 text-destructive">
          {diagnostico.erros.map((erro) => (
            <li key={erro}>{erro}</li>
          ))}
        </ul>
      </div>
    );
  }

  const campos = alvo.campos.filter((campo) =>
    resultado.linhas.some((linha) => campo.chave in linha.valores),
  );
  const comErro = resultado.linhas.filter((linha) => linha.erros.length > 0);
  const noNerp = resultado.linhas.filter((linha) => linha.existeNoNerp).length;
  const conferivel = resultado.linhas.some(
    (linha) => linha.existeNoNerp !== null,
  );

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-xs">
        {resultado.linhas.length} linha(s) em {resultado.tempoMs} ms
        {conferivel && ` · ${noNerp} com código já cadastrado no NERP`}
        {comErro.length > 0 && ` · ${comErro.length} com problema`}
      </p>
      {diagnostico.avisos.length > 0 && (
        <ul className="list-disc pl-4 text-[11px] text-amber-700 dark:text-amber-400">
          {diagnostico.avisos.map((aviso) => (
            <li key={aviso}>{aviso}</li>
          ))}
        </ul>
      )}
      {resultado.linhas.length === 0 ? (
        <p className="rounded-md border p-3 text-muted-foreground text-xs">
          Nenhuma linha. Sem código, o teste olha só os últimos dias da janela —
          informe um código para procurar um item específico.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-max min-w-full border-collapse font-mono text-xs">
            <thead className="bg-muted/40">
              <tr>
                {campos.map((campo) => (
                  <th
                    key={campo.chave}
                    className="border-b px-2 py-1.5 text-left font-medium font-sans text-muted-foreground"
                  >
                    {campo.rotulo}
                  </th>
                ))}
                {conferivel && (
                  <th className="border-b px-2 py-1.5 text-left font-medium font-sans text-muted-foreground">
                    No NERP
                  </th>
                )}
                <th className="border-b px-2 py-1.5 text-left font-medium font-sans text-muted-foreground">
                  Problemas
                </th>
              </tr>
            </thead>
            <tbody>
              {resultado.linhas.map((linha, indice) => (
                <tr
                  key={indice}
                  className={cn(linha.erros.length > 0 && "bg-destructive/5")}
                >
                  {campos.map((campo) => (
                    <td
                      key={campo.chave}
                      className={cn(
                        "whitespace-nowrap border-b px-2 py-1",
                        campo.tipo === "numero" && "text-right tabular-nums",
                        linha.valores[campo.chave] === null &&
                          "text-muted-foreground/60 italic",
                      )}
                    >
                      {textoDaCelula(linha.valores[campo.chave] ?? null)}
                    </td>
                  ))}
                  {conferivel && (
                    <td className="border-b px-2 py-1">
                      {linha.existeNoNerp === null ? (
                        <MinusIcon className="size-3.5 text-muted-foreground" />
                      ) : linha.existeNoNerp ? (
                        <CheckIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <XIcon className="size-3.5 text-muted-foreground" />
                      )}
                    </td>
                  )}
                  <td className="whitespace-nowrap border-b px-2 py-1 font-sans text-destructive">
                    {linha.erros.join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
