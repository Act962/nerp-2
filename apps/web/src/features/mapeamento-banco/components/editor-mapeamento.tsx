"use client";

import {
  AlertTriangleIcon,
  CircleCheckIcon,
  FlaskConicalIcon,
  PlusIcon,
  SaveIcon,
  SparklesIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { TabelaDaLista } from "../application/explorar-banco";
import type { ResumoDoTipo } from "../application/resolver-tipo";
import {
  ALVOS,
  CONVERSOES_POR_TIPO,
  type Conversao,
  ROTULO_DA_CONVERSAO,
  type TipoDoNerp,
  compatibilidade,
} from "../domain/alvos";
import { type TabelaRef, acharColuna } from "../domain/estrutura";
import {
  type ColunaRef,
  type ConfigDoTipo,
  type Filtro,
  type Modo,
  OPERADORES,
  type Operador,
  type Origem,
  ROTULO_DO_OPERADOR,
  validarOrigem,
} from "../domain/mapeamento";
import {
  useDescricaoDaTabela,
  useSalvarMapeamento,
  useSugerirMapeamento,
  useTestarMapeamento,
} from "../hooks/use-mapeamento-banco";
import { ICONE_DO_TIPO } from "./lista-tipos";
import { ResultadoTeste } from "./resultado-teste";
import { SeletorColuna } from "./seletor-coluna";
import { SeletorTabela } from "./seletor-tabela";

// Editor de UM tipo. É estado de editor, não formulário: a validação que
// importa é contra a estrutura real do banco (`validarOrigem`, a mesma regra
// do servidor), recalculada a cada mudança — RHF + zod não sabem que a coluna
// CODPROD existe na PCPEDI.

interface Rascunho {
  tabela: TabelaRef | null;
  juncao: { tabela: TabelaRef | null; de: string; para: string } | null;
  colunas: Record<string, ColunaRef>;
  conversoes: Record<string, Conversao>;
  filtros: Filtro[];
  janela: { coluna: ColunaRef; dias: number } | null;
}

const RASCUNHO_VAZIO: Rascunho = {
  tabela: null,
  juncao: null,
  colunas: {},
  conversoes: {},
  filtros: [],
  janela: null,
};

function deOrigem(origem: Origem | null | undefined): Rascunho {
  if (!origem) return RASCUNHO_VAZIO;
  return {
    tabela: origem.tabela,
    juncao: origem.juncao ?? null,
    colunas: origem.colunas,
    conversoes: origem.conversoes,
    filtros: origem.filtros,
    janela: origem.janela ?? null,
  };
}

function paraOrigem(rascunho: Rascunho): Origem | null {
  if (!rascunho.tabela) return null;
  const { juncao } = rascunho;
  return {
    tabela: rascunho.tabela,
    juncao:
      juncao?.tabela && juncao.de && juncao.para
        ? { tabela: juncao.tabela, de: juncao.de, para: juncao.para }
        : undefined,
    colunas: rascunho.colunas,
    conversoes: rascunho.conversoes,
    filtros: rascunho.filtros,
    janela: rascunho.janela ?? undefined,
  };
}

const SEM_CONVERSAO = "__sem_conversao__";

const ROTULO_DO_MODO: Record<Modo, string> = {
  auto: "Automático",
  manual: "Manual",
  desligado: "Desligado",
};

interface Props {
  tipo: TipoDoNerp;
  resumo: ResumoDoTipo | undefined;
  config: ConfigDoTipo | undefined;
  tabelas: TabelaDaLista[];
  onAbrirTabela: (tabela: TabelaRef) => void;
}

export function EditorMapeamento({
  tipo,
  resumo,
  config,
  tabelas,
  onAbrirTabela,
}: Props) {
  const alvo = ALVOS[tipo];
  const Icone = ICONE_DO_TIPO[tipo];
  const [modo, setModo] = useState<Modo>(config?.modo ?? "auto");
  const [rascunho, setRascunho] = useState<Rascunho>(() =>
    deOrigem(config?.modo === "manual" ? config.origem : resumo?.origem),
  );
  const [codigo, setCodigo] = useState("");

  const sugerir = useSugerirMapeamento();
  const testar = useTestarMapeamento();
  const salvar = useSalvarMapeamento();

  const manual = modo === "manual";
  const base = useDescricaoDaTabela(manual ? rascunho.tabela : null);
  const juncao = useDescricaoDaTabela(
    manual ? (rascunho.juncao?.tabela ?? null) : null,
  );

  const origem = paraOrigem(rascunho);
  const estruturaPronta =
    !!base.data && (!origem?.juncao || !!juncao.data || !!juncao.error);
  // Barato (só percorre colunas): recalcula a cada mudança do rascunho.
  const diagnostico =
    manual && origem && base.data && estruturaPronta
      ? validarOrigem(alvo, origem, {
          base: base.data,
          juncao: juncao.data ?? null,
        })
      : null;

  const configAtual: ConfigDoTipo | null =
    modo === "manual" ? (origem ? { modo, origem } : null) : { modo };
  const podeSalvar =
    configAtual !== null &&
    (modo !== "manual" ||
      (diagnostico !== null && diagnostico.erros.length === 0));

  const alterar = (mudanca: Partial<Rascunho>) =>
    setRascunho((atual) => ({ ...atual, ...mudanca }));

  const aplicarSugestao = () =>
    sugerir.mutate(
      { tipo },
      {
        onSuccess: (sugestao) => {
          if (!sugestao.origem) return;
          setModo("manual");
          setRascunho(deOrigem(sugestao.origem));
        },
      },
    );

  const colunaDe = (ref: ColunaRef | null | undefined) => {
    if (!ref) return null;
    const tabela = ref.de === "base" ? base.data : juncao.data;
    return tabela ? acharColuna(tabela, ref.nome) : null;
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex size-9 items-center justify-center rounded-md border bg-muted/40">
                <Icone className="size-4" />
              </div>
              <div>
                <h2 className="font-semibold">{alvo.rotulo}</h2>
                <p className="max-w-xl text-muted-foreground text-xs">
                  {alvo.descricao}
                </p>
              </div>
            </div>
            <div className="inline-flex rounded-md border p-0.5">
              {(Object.keys(ROTULO_DO_MODO) as Modo[]).map((opcao) => (
                <Button
                  key={opcao}
                  size="sm"
                  variant={modo === opcao ? "secondary" : "ghost"}
                  className="h-7 text-xs"
                  onClick={() => {
                    setModo(opcao);
                    testar.reset();
                    if (
                      opcao === "manual" &&
                      !rascunho.tabela &&
                      resumo?.origem
                    ) {
                      setRascunho(deOrigem(resumo.origem));
                    }
                  }}
                >
                  {ROTULO_DO_MODO[opcao]}
                </Button>
              ))}
            </div>
          </div>

          {modo === "auto" && (
            <PainelAutomatico
              resumo={resumo}
              onPersonalizar={() => {
                setModo("manual");
                setRascunho(deOrigem(resumo?.origem));
              }}
              onAbrirTabela={onAbrirTabela}
            />
          )}

          {modo === "desligado" && (
            <p className="rounded-md border bg-muted/30 p-4 text-muted-foreground text-sm">
              Desligado: o sync não lê {alvo.rotulo.toLowerCase()} deste banco.
            </p>
          )}

          {manual && (
            <>
              <Secao
                titulo="Tabela"
                acao={
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={aplicarSugestao}
                    disabled={sugerir.isPending}
                  >
                    <SparklesIcon />
                    Preencher pelo perfil
                  </Button>
                }
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <SeletorTabela
                      tabelas={tabelas}
                      valor={rascunho.tabela}
                      onEscolher={(tabela) =>
                        alterar({
                          tabela,
                          colunas: {},
                          conversoes: {},
                          filtros: [],
                          janela: null,
                        })
                      }
                    />
                  </div>
                  {rascunho.tabela && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-xs"
                      onClick={() =>
                        rascunho.tabela && onAbrirTabela(rascunho.tabela)
                      }
                    >
                      Ver dados
                    </Button>
                  )}
                </div>
                {sugerir.data && sugerir.data.recusados.length > 0 && (
                  <Recusados recusados={sugerir.data.recusados} />
                )}
                {sugerir.data && !sugerir.data.origem && (
                  <p className="text-destructive text-xs">
                    Nenhum perfil automático funciona neste banco.
                  </p>
                )}
                {base.error && (
                  <p className="text-destructive text-xs">
                    {base.error.message}
                  </p>
                )}
              </Secao>

              {rascunho.tabela && (
                <>
                  <Secao
                    titulo="Junção"
                    descricao="Quando um campo mora em outra tabela (ex.: a região está no cabeçalho do pedido, não no item)."
                  >
                    <label
                      htmlFor={`juncao-${tipo}`}
                      className="flex items-center gap-2 text-xs"
                    >
                      <Checkbox
                        id={`juncao-${tipo}`}
                        checked={rascunho.juncao !== null}
                        onCheckedChange={(marcado) =>
                          alterar({
                            juncao: marcado
                              ? { tabela: null, de: "", para: "" }
                              : null,
                            colunas: Object.fromEntries(
                              Object.entries(rascunho.colunas).filter(
                                ([, ref]) => marcado || ref.de === "base",
                              ),
                            ),
                          })
                        }
                      />
                      Juntar com outra tabela
                    </label>
                    {rascunho.juncao && (
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
                        <SeletorTabela
                          tabelas={tabelas}
                          valor={rascunho.juncao.tabela}
                          onEscolher={(tabela) =>
                            alterar({
                              juncao: {
                                tabela,
                                de: rascunho.juncao?.de ?? "",
                                para: "",
                              },
                            })
                          }
                          placeholder="Tabela da junção"
                        />
                        <span className="text-center text-muted-foreground text-xs">
                          onde
                        </span>
                        <SeletorColuna
                          base={base.data}
                          juncao={undefined}
                          valor={
                            rascunho.juncao.de
                              ? { de: "base", nome: rascunho.juncao.de }
                              : null
                          }
                          onEscolher={(ref) =>
                            rascunho.juncao &&
                            alterar({
                              juncao: {
                                ...rascunho.juncao,
                                de: ref?.nome ?? "",
                              },
                            })
                          }
                          placeholder="coluna daqui"
                        />
                        <span className="text-center text-muted-foreground text-xs">
                          =
                        </span>
                        <SeletorColuna
                          base={juncao.data}
                          juncao={undefined}
                          valor={
                            rascunho.juncao.para
                              ? { de: "base", nome: rascunho.juncao.para }
                              : null
                          }
                          onEscolher={(ref) =>
                            rascunho.juncao &&
                            alterar({
                              juncao: {
                                ...rascunho.juncao,
                                para: ref?.nome ?? "",
                              },
                            })
                          }
                          placeholder="coluna de lá"
                        />
                      </div>
                    )}
                  </Secao>

                  <Secao
                    titulo="Campos do NERP"
                    descricao="Para cada campo, a coluna de onde ele vem. Os marcados com * são obrigatórios."
                  >
                    <div className="flex flex-col divide-y rounded-md border">
                      {alvo.campos.map((campo) => {
                        const ref = rascunho.colunas[campo.chave] ?? null;
                        const coluna = colunaDe(ref);
                        const compat =
                          coluna && campo.tipo !== "booleano"
                            ? compatibilidade(campo.tipo, coluna.tipo)
                            : "ok";
                        return (
                          <div
                            key={campo.chave}
                            className="grid gap-2 p-3 sm:grid-cols-[minmax(0,14rem)_1fr] sm:items-center"
                          >
                            <div className="min-w-0">
                              <p className="font-medium text-xs">
                                {campo.rotulo}
                                {campo.obrigatorio && (
                                  <span className="text-destructive"> *</span>
                                )}
                                <span className="ml-1.5 font-normal text-[10px] text-muted-foreground uppercase">
                                  {campo.tipo}
                                </span>
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {campo.descricao}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <SeletorColuna
                                base={base.data}
                                juncao={juncao.data}
                                valor={ref}
                                onEscolher={(escolhida) => {
                                  const colunas = { ...rascunho.colunas };
                                  if (escolhida)
                                    colunas[campo.chave] = escolhida;
                                  else delete colunas[campo.chave];
                                  alterar({ colunas });
                                }}
                              />
                              {ref &&
                                CONVERSOES_POR_TIPO[campo.tipo].length > 0 && (
                                  <Select
                                    value={
                                      rascunho.conversoes[campo.chave] ??
                                      (campo.tipo === "booleano"
                                        ? ""
                                        : SEM_CONVERSAO)
                                    }
                                    onValueChange={(valor) => {
                                      const conversoes = {
                                        ...rascunho.conversoes,
                                      };
                                      if (valor === SEM_CONVERSAO) {
                                        delete conversoes[campo.chave];
                                      } else {
                                        conversoes[campo.chave] =
                                          valor as Conversao;
                                      }
                                      alterar({ conversoes });
                                    }}
                                  >
                                    <SelectTrigger
                                      size="sm"
                                      className="w-48 text-xs"
                                    >
                                      <SelectValue placeholder="Conversão" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {/* Booleano exige conversão; texto, não. */}
                                      {campo.tipo !== "booleano" && (
                                        <SelectItem
                                          value={SEM_CONVERSAO}
                                          className="text-muted-foreground text-xs"
                                        >
                                          Sem conversão
                                        </SelectItem>
                                      )}
                                      {CONVERSOES_POR_TIPO[campo.tipo].map(
                                        (conversao) => (
                                          <SelectItem
                                            key={conversao}
                                            value={conversao}
                                            className="text-xs"
                                          >
                                            {ROTULO_DA_CONVERSAO[conversao]}
                                          </SelectItem>
                                        ),
                                      )}
                                    </SelectContent>
                                  </Select>
                                )}
                              {compat === "aviso" && (
                                <AlertTriangleIcon
                                  className="size-4 shrink-0 text-amber-500"
                                  aria-label="Tipo diferente: a conversão pode falhar"
                                />
                              )}
                              {compat === "erro" && (
                                <XCircleIcon
                                  className="size-4 shrink-0 text-destructive"
                                  aria-label="Tipo incompatível"
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Secao>

                  <Secao
                    titulo="Filtros"
                    descricao="Só as linhas que interessam (ex.: pedido não cancelado)."
                    acao={
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={rascunho.filtros.length >= 8 || !base.data}
                        onClick={() => {
                          const primeira = base.data?.colunas[0];
                          if (!primeira) return;
                          alterar({
                            filtros: [
                              ...rascunho.filtros,
                              {
                                coluna: { de: "base", nome: primeira.nome },
                                operador: "igual",
                                valores: [""],
                              },
                            ],
                          });
                        }}
                      >
                        <PlusIcon />
                        Filtro
                      </Button>
                    }
                  >
                    {rascunho.filtros.length === 0 ? (
                      <p className="text-muted-foreground text-xs">
                        Sem filtro: lê todas as linhas da tabela.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {rascunho.filtros.map((filtro, indice) => (
                          <LinhaDoFiltro
                            key={indice}
                            filtro={filtro}
                            base={base.data}
                            juncao={juncao.data}
                            tipoDaColuna={
                              colunaDe(filtro.coluna)?.tipo ?? "texto"
                            }
                            onMudar={(novo) =>
                              alterar({
                                filtros: rascunho.filtros.map((atual, i) =>
                                  i === indice ? novo : atual,
                                ),
                              })
                            }
                            onRemover={() =>
                              alterar({
                                filtros: rascunho.filtros.filter(
                                  (_, i) => i !== indice,
                                ),
                              })
                            }
                          />
                        ))}
                      </div>
                    )}
                  </Secao>

                  <Secao
                    titulo="Janela de data"
                    descricao="Lê só os últimos dias. Obrigatória em tabela grande, numa coluna de data com índice."
                  >
                    <label
                      htmlFor={`janela-${tipo}`}
                      className="flex items-center gap-2 text-xs"
                    >
                      <Checkbox
                        id={`janela-${tipo}`}
                        checked={rascunho.janela !== null}
                        onCheckedChange={(marcado) => {
                          const primeiraData = base.data?.colunas.find(
                            (coluna) => coluna.tipo === "data",
                          );
                          alterar({
                            janela:
                              marcado && primeiraData
                                ? {
                                    coluna: {
                                      de: "base",
                                      nome: primeiraData.nome,
                                    },
                                    dias: 90,
                                  }
                                : null,
                          });
                        }}
                      />
                      Ler só os últimos dias
                    </label>
                    {rascunho.janela && (
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="w-56">
                          <SeletorColuna
                            base={base.data}
                            juncao={juncao.data}
                            valor={rascunho.janela.coluna}
                            tipos={["data"]}
                            permitirNenhuma={false}
                            onEscolher={(ref) =>
                              ref &&
                              rascunho.janela &&
                              alterar({
                                janela: { ...rascunho.janela, coluna: ref },
                              })
                            }
                          />
                        </div>
                        <span className="text-muted-foreground text-xs">
                          últimos
                        </span>
                        <Input
                          type="number"
                          min={1}
                          max={3650}
                          value={rascunho.janela.dias}
                          onChange={(evento) =>
                            rascunho.janela &&
                            alterar({
                              janela: {
                                ...rascunho.janela,
                                dias: Math.max(
                                  1,
                                  Math.min(
                                    3650,
                                    Number(evento.target.value) || 1,
                                  ),
                                ),
                              },
                            })
                          }
                          className="h-8 w-20 text-xs"
                        />
                        <span className="text-muted-foreground text-xs">
                          dias
                        </span>
                      </div>
                    )}
                  </Secao>

                  {diagnostico && <Diagnostico diagnostico={diagnostico} />}
                </>
              )}
            </>
          )}

          {testar.error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive text-xs">
              {testar.error.message}
            </p>
          )}
          {testar.data && <ResultadoTeste resultado={testar.data} />}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-background px-4 py-2">
        {modo !== "desligado" && (
          <>
            <Input
              value={codigo}
              onChange={(evento) => setCodigo(evento.target.value)}
              placeholder={`Código (opcional, ex.: ${tipo === "categoria" ? "12" : "108238"})`}
              className="h-8 w-56 font-mono text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!configAtual || testar.isPending}
              onClick={() =>
                configAtual &&
                testar.mutate({
                  tipo,
                  rascunho: configAtual,
                  codigo: codigo.trim() || null,
                })
              }
            >
              <FlaskConicalIcon />
              {testar.isPending ? "Testando…" : "Testar"}
            </Button>
          </>
        )}
        <Button
          size="sm"
          disabled={!podeSalvar || salvar.isPending}
          onClick={() =>
            configAtual && salvar.mutate({ tipo, config: configAtual })
          }
        >
          <SaveIcon />
          Salvar
        </Button>
      </div>
    </div>
  );
}

function Secao({
  titulo,
  descricao,
  acao,
  children,
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-medium text-sm">{titulo}</h3>
          {descricao && (
            <p className="text-muted-foreground text-xs">{descricao}</p>
          )}
        </div>
        {acao}
      </div>
      {children}
    </section>
  );
}

function Recusados({
  recusados,
}: {
  recusados: { perfil: string; motivo: string }[];
}) {
  return (
    <ul className="flex flex-col gap-1 rounded-md border bg-muted/30 p-3 text-xs">
      {recusados.map((recusado) => (
        <li key={recusado.perfil} className="flex gap-2">
          <XCircleIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <span>
            <span className="font-medium">{recusado.perfil}</span>
            <span className="text-muted-foreground"> — {recusado.motivo}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Diagnostico({
  diagnostico,
}: {
  diagnostico: { erros: string[]; avisos: string[] };
}) {
  if (diagnostico.erros.length === 0 && diagnostico.avisos.length === 0) {
    return (
      <p className="flex items-center gap-2 text-emerald-700 text-xs dark:text-emerald-400">
        <CircleCheckIcon className="size-4" />
        Mapeamento válido para a estrutura deste banco.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1 text-xs">
      {diagnostico.erros.map((erro) => (
        <p key={erro} className="flex gap-2 text-destructive">
          <XCircleIcon className="mt-0.5 size-3.5 shrink-0" />
          {erro}
        </p>
      ))}
      {diagnostico.avisos.map((aviso) => (
        <p
          key={aviso}
          className="flex gap-2 text-amber-700 dark:text-amber-400"
        >
          <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
          {aviso}
        </p>
      ))}
    </div>
  );
}

function PainelAutomatico({
  resumo,
  onPersonalizar,
  onAbrirTabela,
}: {
  resumo: ResumoDoTipo | undefined;
  onPersonalizar: () => void;
  onAbrirTabela: (tabela: TabelaRef) => void;
}) {
  if (!resumo) {
    return (
      <p className="text-muted-foreground text-sm">Verificando o banco…</p>
    );
  }
  const alvo = ALVOS[resumo.tipo];
  const origem = resumo.origem;

  return (
    <div className="flex flex-col gap-4">
      {resumo.perfil && origem ? (
        <div className="flex flex-col gap-3 rounded-md border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 font-medium text-sm">
              <CircleCheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
              {resumo.perfil.rotulo}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={onPersonalizar}
            >
              Personalizar a partir daqui
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 font-mono text-xs">
            <button
              type="button"
              className="rounded border px-2 py-0.5 hover:bg-accent"
              onClick={() => onAbrirTabela(origem.tabela)}
            >
              {origem.tabela.schema}.{origem.tabela.nome}
            </button>
            {origem.juncao && (
              <button
                type="button"
                className="rounded border px-2 py-0.5 hover:bg-accent"
                onClick={() =>
                  origem.juncao && onAbrirTabela(origem.juncao.tabela)
                }
              >
                + {origem.juncao.tabela.nome} ({origem.juncao.de} ={" "}
                {origem.juncao.para})
              </button>
            )}
            {origem.janela && (
              <span className="rounded border px-2 py-0.5 text-muted-foreground">
                últimos {origem.janela.dias} dias por{" "}
                {origem.janela.coluna.nome}
              </span>
            )}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            {alvo.campos
              .filter((campo) => origem.colunas[campo.chave])
              .map((campo) => {
                const ref = origem.colunas[campo.chave];
                return (
                  <div key={campo.chave} className="contents">
                    <dt className="text-muted-foreground">{campo.rotulo}</dt>
                    <dd className="font-mono">
                      {ref.de === "juncao" ? "j." : ""}
                      {ref.nome}
                      {origem.conversoes[campo.chave] && (
                        <span className="ml-2 font-sans text-muted-foreground">
                          (
                          {
                            ROTULO_DA_CONVERSAO[
                              origem.conversoes[campo.chave] as Conversao
                            ]
                          }
                          )
                        </span>
                      )}
                    </dd>
                  </div>
                );
              })}
          </dl>
        </div>
      ) : (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
          {resumo.diagnostico.erros.map((erro) => (
            <p key={erro} className="text-destructive">
              {erro}
            </p>
          ))}
        </div>
      )}
      {resumo.recusados.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="font-medium text-xs">Perfis que não servem aqui</p>
          <Recusados recusados={resumo.recusados} />
        </div>
      )}
      {resumo.diagnostico.avisos.length > 0 && (
        <Diagnostico
          diagnostico={{ erros: [], avisos: resumo.diagnostico.avisos }}
        />
      )}
    </div>
  );
}

function LinhaDoFiltro({
  filtro,
  base,
  juncao,
  tipoDaColuna,
  onMudar,
  onRemover,
}: {
  filtro: Filtro;
  base: Parameters<typeof SeletorColuna>[0]["base"];
  juncao: Parameters<typeof SeletorColuna>[0]["juncao"];
  tipoDaColuna: string;
  onMudar: (filtro: Filtro) => void;
  onRemover: () => void;
}) {
  const semValor =
    filtro.operador === "vazio" || filtro.operador === "preenchido";
  const converter = (texto: string): string | number =>
    tipoDaColuna === "numero" &&
    texto.trim() !== "" &&
    Number.isFinite(Number(texto))
      ? Number(texto)
      : texto;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-48">
        <SeletorColuna
          base={base}
          juncao={juncao}
          valor={filtro.coluna}
          permitirNenhuma={false}
          onEscolher={(ref) => ref && onMudar({ ...filtro, coluna: ref })}
        />
      </div>
      <Select
        value={filtro.operador}
        onValueChange={(valor) => {
          const operador = valor as Operador;
          const valores =
            operador === "vazio" || operador === "preenchido"
              ? []
              : filtro.valores.length
                ? filtro.valores.slice(0, operador === "em" ? undefined : 1)
                : [""];
          onMudar({ ...filtro, operador, valores });
        }}
      >
        <SelectTrigger size="sm" className="w-40 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPERADORES.map((operador) => (
            <SelectItem key={operador} value={operador} className="text-xs">
              {ROTULO_DO_OPERADOR[operador]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!semValor && (
        <Input
          value={filtro.valores.join(", ")}
          onChange={(evento) =>
            onMudar({
              ...filtro,
              valores:
                filtro.operador === "em"
                  ? evento.target.value
                      .split(",")
                      .map((parte) => converter(parte.trim()))
                  : [converter(evento.target.value)],
            })
          }
          placeholder={filtro.operador === "em" ? "A, B, C" : "valor"}
          className={cn("h-8 w-40 font-mono text-xs")}
        />
      )}
      <Button
        size="icon"
        variant="ghost"
        className="size-8"
        onClick={onRemover}
        aria-label="Remover filtro"
      >
        <Trash2Icon />
      </Button>
    </div>
  );
}
