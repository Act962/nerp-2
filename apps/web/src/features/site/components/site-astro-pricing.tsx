"use client";

import { CONSULTOR_TOOL_IDS, findCatalogTool } from "@nerp/site-content";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import type { AstroPricing } from "@/features/astro-consultor/server/preco";
import {
  useAstroPricing,
  useSaveAstroConfig,
  useSaveAstroPricing,
  useSimularPreco,
} from "../hooks/use-site-admin";
import { SitePageHeader } from "./site-page-header";

/**
 * A tabela de faixas do Astro.
 *
 * O consultor NUNCA inventa preço: ele chama uma ferramenta que faz a conta em
 * TypeScript sobre esta tabela e devolve a frase pronta. Enquanto o
 * interruptor estiver desligado, ou a lista de portes vazia, ele diz que o
 * valor sai do diagnóstico e encaminha para uma pessoa — que é o
 * comportamento correto, não uma falha.
 *
 * Os valores são digitados em REAIS e guardados em centavos. O botão
 * "Simular" roda a mesma função que o consultor usa, então o que aparece ali é
 * exatamente o que o cliente ouviria.
 */

/** Reais digitados → centavos. Aceita "1.890,50", "1890.5" e "1890". */
function paraCents(texto: string): number {
  const limpo = texto.trim().replace(/\./g, "").replace(",", ".");
  const numero = Number(limpo);
  return Number.isFinite(numero) && numero >= 0 ? Math.round(numero * 100) : 0;
}

function paraReais(cents: number): string {
  return cents === 0 ? "" : String(cents / 100).replace(".", ",");
}

function CampoReais({
  id,
  label,
  cents,
  onChange,
}: {
  id: string;
  label: string;
  cents: number;
  onChange: (cents: number) => void;
}) {
  const [texto, setTexto] = useState(paraReais(cents));
  useEffect(() => setTexto(paraReais(cents)), [cents]);

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        inputMode="decimal"
        placeholder="0,00"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => onChange(paraCents(texto))}
      />
    </Field>
  );
}

const PORTE_NOVO = {
  id: "",
  label: "",
  lojasAte: null as number | null,
  usuariosAte: null as number | null,
  baseMinCents: 0,
  baseMaxCents: 0,
};

export function SiteAstroPricing() {
  const { pricing, config, isLoading } = useAstroPricing();
  const salvar = useSaveAstroPricing();
  const salvarConfig = useSaveAstroConfig();
  const simular = useSimularPreco();

  const [rascunho, setRascunho] = useState<AstroPricing | null>(null);
  const [simulacao, setSimulacao] = useState({
    lojas: 3,
    usuarios: 12,
    toolIds: [] as string[],
  });

  useEffect(() => {
    if (pricing && !rascunho) setRascunho(pricing);
  }, [pricing, rascunho]);

  if (isLoading || !rascunho || !config) {
    return (
      <>
        <SitePageHeader title="Faixas do Astro" />
        <Skeleton className="h-64" />
      </>
    );
  }

  const alterar = (mudanca: Partial<AstroPricing>) =>
    setRascunho({ ...rascunho, ...mudanca });

  return (
    <>
      <SitePageHeader
        title="Faixas do Astro"
        description="A estimativa que o consultor apresenta no site. Ele não calcula nada: a conta é feita aqui e ele repete a frase pronta. Com a tabela desligada, ele encaminha para o time em vez de arriscar um número."
        actions={
          <Button
            onClick={() => salvar.mutate({ pricing: rascunho })}
            disabled={salvar.isPending}
          >
            {salvar.isPending ? "Salvando…" : "Salvar faixas"}
          </Button>
        }
      />

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">O consultor</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Astro ligado no site</p>
                <p className="text-sm text-muted-foreground">
                  Desligado, o botão do site vira o contato por WhatsApp.
                </p>
              </div>
              <Switch
                checked={config.ativo}
                onCheckedChange={(ativo) =>
                  salvarConfig.mutate({ config: { ...config, ativo } })
                }
              />
            </div>

            <Field>
              <FieldLabel htmlFor="teto-dia">
                Teto de mensagens por dia
              </FieldLabel>
              <Input
                id="teto-dia"
                type="number"
                min={0}
                defaultValue={config.tetoMensagensDia}
                onBlur={(e) =>
                  salvarConfig.mutate({
                    config: {
                      ...config,
                      tetoMensagensDia: Number(e.target.value) || 0,
                    },
                  })
                }
              />
              <FieldDescription>
                No site inteiro, somando todo mundo. Zero significa sem teto —
                mas é esta trava que segura a conta se algo escapar dos limites
                por visitante.
              </FieldDescription>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estimativa</CardTitle>
            <p className="text-sm text-muted-foreground">
              Enquanto estiver desligada, nenhum valor sai na conversa.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium">Falar de valores</p>
              <Switch
                checked={rascunho.ativo}
                onCheckedChange={(ativo) => alterar({ ativo })}
              />
            </div>

            <Field>
              <FieldLabel htmlFor="disclaimer">Ressalva</FieldLabel>
              <Input
                id="disclaimer"
                value={rascunho.disclaimer}
                onChange={(e) => alterar({ disclaimer: e.target.value })}
              />
              <FieldDescription>
                O Astro repete esta frase toda vez que fala um número.
              </FieldDescription>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Portes</CardTitle>
            <p className="text-sm text-muted-foreground">
              Do menor para o maior — o Astro usa o primeiro que couber. Deixe
              os limites do último em branco para ele ser o teto da lista.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {rascunho.portes.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Sem porte cadastrado, o Astro não fala valor nenhum.
              </p>
            )}

            {rascunho.portes.map((porte, indice) => (
              <div
                key={`${porte.id}-${indice}`}
                className="grid gap-3 rounded-lg border p-3 md:grid-cols-6"
              >
                <Field className="md:col-span-2">
                  <FieldLabel htmlFor={`porte-label-${indice}`}>
                    Nome
                  </FieldLabel>
                  <Input
                    id={`porte-label-${indice}`}
                    placeholder="Até 2 lojas"
                    value={porte.label}
                    onChange={(e) => {
                      const portes = [...rascunho.portes];
                      const label = e.target.value;
                      portes[indice] = {
                        ...porte,
                        label,
                        id:
                          porte.id || label.toLowerCase().replace(/\W+/g, "-"),
                      };
                      alterar({ portes });
                    }}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor={`porte-lojas-${indice}`}>
                    Até N lojas
                  </FieldLabel>
                  <Input
                    id={`porte-lojas-${indice}`}
                    type="number"
                    min={0}
                    placeholder="sem limite"
                    value={porte.lojasAte ?? ""}
                    onChange={(e) => {
                      const portes = [...rascunho.portes];
                      portes[indice] = {
                        ...porte,
                        lojasAte: e.target.value
                          ? Number(e.target.value)
                          : null,
                      };
                      alterar({ portes });
                    }}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor={`porte-users-${indice}`}>
                    Até N usuários
                  </FieldLabel>
                  <Input
                    id={`porte-users-${indice}`}
                    type="number"
                    min={0}
                    placeholder="sem limite"
                    value={porte.usuariosAte ?? ""}
                    onChange={(e) => {
                      const portes = [...rascunho.portes];
                      portes[indice] = {
                        ...porte,
                        usuariosAte: e.target.value
                          ? Number(e.target.value)
                          : null,
                      };
                      alterar({ portes });
                    }}
                  />
                </Field>

                <CampoReais
                  id={`porte-min-${indice}`}
                  label="De (R$/mês)"
                  cents={porte.baseMinCents}
                  onChange={(baseMinCents) => {
                    const portes = [...rascunho.portes];
                    portes[indice] = { ...porte, baseMinCents };
                    alterar({ portes });
                  }}
                />

                <div className="flex items-end gap-2">
                  <CampoReais
                    id={`porte-max-${indice}`}
                    label="Até (R$/mês)"
                    cents={porte.baseMaxCents}
                    onChange={(baseMaxCents) => {
                      const portes = [...rascunho.portes];
                      portes[indice] = { ...porte, baseMaxCents };
                      alterar({ portes });
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover ${porte.label || "porte"}`}
                    onClick={() =>
                      alterar({
                        portes: rascunho.portes.filter((_, i) => i !== indice),
                      })
                    }
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              className="self-start"
              onClick={() =>
                alterar({ portes: [...rascunho.portes, { ...PORTE_NOVO }] })
              }
            >
              <Plus className="size-4" /> Adicionar porte
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acréscimo por módulo</CardTitle>
            <p className="text-sm text-muted-foreground">
              Somado ao porte quando a ferramenta entra no escopo. O que não
              estiver aqui não acrescenta nada.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {rascunho.modulos.map((modulo, indice) => (
              <div
                key={`${modulo.toolId}-${indice}`}
                className="grid items-end gap-3 rounded-lg border p-3 md:grid-cols-4"
              >
                <Field>
                  <FieldLabel htmlFor={`mod-${indice}`}>Ferramenta</FieldLabel>
                  <select
                    id={`mod-${indice}`}
                    className="h-9 rounded-md border bg-transparent px-3 text-sm"
                    value={modulo.toolId}
                    onChange={(e) => {
                      const modulos = [...rascunho.modulos];
                      modulos[indice] = { ...modulo, toolId: e.target.value };
                      alterar({ modulos });
                    }}
                  >
                    <option value="">selecione</option>
                    {CONSULTOR_TOOL_IDS.map((id) => (
                      <option key={id} value={id}>
                        {findCatalogTool(id)?.name ?? id}
                      </option>
                    ))}
                  </select>
                </Field>

                <CampoReais
                  id={`mod-min-${indice}`}
                  label="De (R$/mês)"
                  cents={modulo.minCents}
                  onChange={(minCents) => {
                    const modulos = [...rascunho.modulos];
                    modulos[indice] = { ...modulo, minCents };
                    alterar({ modulos });
                  }}
                />

                <CampoReais
                  id={`mod-max-${indice}`}
                  label="Até (R$/mês)"
                  cents={modulo.maxCents}
                  onChange={(maxCents) => {
                    const modulos = [...rascunho.modulos];
                    modulos[indice] = { ...modulo, maxCents };
                    alterar({ modulos });
                  }}
                />

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remover módulo"
                  onClick={() =>
                    alterar({
                      modulos: rascunho.modulos.filter((_, i) => i !== indice),
                    })
                  }
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}

            <Button
              variant="outline"
              className="self-start"
              onClick={() =>
                alterar({
                  modulos: [
                    ...rascunho.modulos,
                    { toolId: "", minCents: 0, maxCents: 0 },
                  ],
                })
              }
            >
              <Plus className="size-4" /> Adicionar módulo
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ajustes e limites</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <CampoReais
              id="loja-min"
              label="Loja adicional — de (R$/mês)"
              cents={rascunho.porLojaAdicional.minCents}
              onChange={(minCents) =>
                alterar({
                  porLojaAdicional: {
                    ...rascunho.porLojaAdicional,
                    minCents,
                  },
                })
              }
            />
            <CampoReais
              id="loja-max"
              label="Loja adicional — até (R$/mês)"
              cents={rascunho.porLojaAdicional.maxCents}
              onChange={(maxCents) =>
                alterar({
                  porLojaAdicional: {
                    ...rascunho.porLojaAdicional,
                    maxCents,
                  },
                })
              }
            />

            <CampoReais
              id="teto-min"
              label="Nunca abaixo de (R$/mês)"
              cents={rascunho.teto.minCents}
              onChange={(minCents) =>
                alterar({ teto: { ...rascunho.teto, minCents } })
              }
            />
            <CampoReais
              id="teto-max"
              label="Nunca acima de (R$/mês)"
              cents={rascunho.teto.maxCents}
              onChange={(maxCents) =>
                alterar({ teto: { ...rascunho.teto, maxCents } })
              }
            />
            <p className="text-sm text-muted-foreground md:col-span-2">
              A janela é a rede de segurança: nenhuma combinação de porte,
              módulos e lojas sai dela. Deixe o teto em zero para não aplicar.
            </p>

            <CampoReais
              id="setup-min"
              label="Implantação — de (R$)"
              cents={rascunho.setup.minCents}
              onChange={(minCents) =>
                alterar({ setup: { ...rascunho.setup, minCents } })
              }
            />
            <CampoReais
              id="setup-max"
              label="Implantação — até (R$)"
              cents={rascunho.setup.maxCents}
              onChange={(maxCents) =>
                alterar({ setup: { ...rascunho.setup, maxCents } })
              }
            />
            <Field className="md:col-span-2">
              <FieldLabel htmlFor="setup-texto">
                Observação da implantação
              </FieldLabel>
              <Input
                id="setup-texto"
                placeholder="pago uma vez"
                value={rascunho.setup.texto}
                onChange={(e) =>
                  alterar({
                    setup: { ...rascunho.setup, texto: e.target.value },
                  })
                }
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Simular</CardTitle>
            <p className="text-sm text-muted-foreground">
              Roda a mesma conta que o consultor faz, sobre o que está na tela —
              antes de salvar e antes de ligar.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="sim-lojas">Lojas</FieldLabel>
                <Input
                  id="sim-lojas"
                  type="number"
                  min={0}
                  value={simulacao.lojas}
                  onChange={(e) =>
                    setSimulacao({
                      ...simulacao,
                      lojas: Number(e.target.value) || 0,
                    })
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="sim-users">Usuários</FieldLabel>
                <Input
                  id="sim-users"
                  type="number"
                  min={0}
                  value={simulacao.usuarios}
                  onChange={(e) =>
                    setSimulacao({
                      ...simulacao,
                      usuarios: Number(e.target.value) || 0,
                    })
                  }
                />
              </Field>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() =>
                    simular.mutate({ pricing: rascunho, ...simulacao })
                  }
                  disabled={simular.isPending}
                >
                  {simular.isPending ? "Calculando…" : "Simular"}
                </Button>
              </div>
            </div>

            <Field>
              <FieldLabel>Módulos no escopo</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {rascunho.modulos
                  .filter((m) => m.toolId)
                  .map((m) => {
                    const marcado = simulacao.toolIds.includes(m.toolId);
                    return (
                      <Button
                        key={m.toolId}
                        type="button"
                        size="sm"
                        variant={marcado ? "default" : "outline"}
                        onClick={() =>
                          setSimulacao({
                            ...simulacao,
                            toolIds: marcado
                              ? simulacao.toolIds.filter(
                                  (id) => id !== m.toolId,
                                )
                              : [...simulacao.toolIds, m.toolId],
                          })
                        }
                      >
                        {findCatalogTool(m.toolId)?.name ?? m.toolId}
                      </Button>
                    );
                  })}
                {rascunho.modulos.filter((m) => m.toolId).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhum módulo com acréscimo cadastrado.
                  </p>
                )}
              </div>
            </Field>

            {simular.data && (
              <div className="rounded-lg border bg-muted/40 p-4">
                {simular.data.disponivel ? (
                  <>
                    <p className="text-lg font-semibold">
                      {simular.data.faixa}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Porte: {simular.data.porte}
                      {simular.data.setup
                        ? ` · Implantação: ${simular.data.setup}`
                        : ""}
                    </p>
                    <ul className="mt-2 flex flex-col gap-0.5 text-xs text-muted-foreground">
                      {simular.data.memoria.map((linha) => (
                        <li key={linha}>{linha}</li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-sm">
                    O Astro não falaria valor nenhum aqui
                    {simular.data.motivo === "sem_tabela"
                      ? " — a estimativa está desligada ou sem portes."
                      : " — nenhum porte comporta essa operação."}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
