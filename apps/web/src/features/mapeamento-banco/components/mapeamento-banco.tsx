"use client";

import { DatabaseIcon } from "lucide-react";
import { useState } from "react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import type { TipoDoNerp } from "../domain/alvos";
import type { TabelaRef } from "../domain/estrutura";
import {
  useEstadoDoMapeamento,
  useTabelasDoBanco,
} from "../hooks/use-mapeamento-banco";
import { CabecalhoConexao, type ModoDaPagina } from "./cabecalho-conexao";
import { DiagramaSchema } from "./diagrama/diagrama-schema";
import { EditorMapeamento } from "./editor-mapeamento";
import { ListaTabelas } from "./lista-tabelas";
import { ListaTipos } from "./lista-tipos";
import { PainelTabela } from "./painel-tabela";

// Página no molde do Supabase Studio: lista à esquerda (tabelas no Explorar,
// tipos do NERP no Mapear), conteúdo à direita. No celular a lista vira gaveta
// e o conteúdo ocupa a tela — um painel por vez.

export function MapeamentoBanco() {
  const ehCelular = useIsMobile();
  const [modo, setModo] = useState<ModoDaPagina>("explorar");
  const [tabela, setTabela] = useState<TabelaRef | null>(null);
  const [tipo, setTipo] = useState<TipoDoNerp>("produto");
  const [gavetaAberta, setGavetaAberta] = useState(false);

  const tabelas = useTabelasDoBanco();
  const estado = useEstadoDoMapeamento();

  const abrirTabela = (ref: TabelaRef) => {
    setModo("explorar");
    setTabela(ref);
    setGavetaAberta(false);
  };

  const lista =
    modo === "explorar" ? (
      <ListaTabelas
        tabelas={tabelas.data?.tabelas ?? []}
        carregando={tabelas.isLoading}
        erro={tabelas.error?.message ?? null}
        selecionada={tabela}
        onSelecionar={abrirTabela}
      />
    ) : (
      <ListaTipos
        tipos={estado.data?.tipos}
        carregando={estado.isLoading}
        erro={estado.error?.message ?? null}
        selecionado={tipo}
        onSelecionar={(escolhido) => {
          setTipo(escolhido);
          setGavetaAberta(false);
        }}
      />
    );

  const conteudo =
    modo === "explorar" ? (
      tabela ? (
        <PainelTabela tabela={tabela} onAbrirTabela={abrirTabela} />
      ) : (
        <Empty className="h-full">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <DatabaseIcon />
            </EmptyMedia>
            <EmptyTitle>Escolha uma tabela</EmptyTitle>
            <EmptyDescription>
              Veja as colunas, uma amostra dos dados e como ela se liga às
              outras. Para dizer ao NERP de onde vem cada dado, use Mapear.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )
    ) : (
      <EditorMapeamento
        // Trocar de tipo recomeça o editor do zero, com o que está salvo.
        key={`${tipo}-${estado.dataUpdatedAt}`}
        tipo={tipo}
        resumo={estado.data?.tipos.find((resumo) => resumo.tipo === tipo)}
        config={estado.data?.mapeamento.tipos[tipo]}
        tabelas={tabelas.data?.tabelas ?? []}
        onAbrirTabela={abrirTabela}
      />
    );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <CabecalhoConexao
        modo={modo}
        onModo={setModo}
        onAbrirLista={() => setGavetaAberta(true)}
      />
      <div className="min-h-0 flex-1">
        {modo === "diagrama" ? (
          // O diagrama ocupa a largura toda, como no Supabase: a lista de
          // tabelas vira o "Ir para tabela" da barra dele.
          <DiagramaSchema onAbrirTabela={abrirTabela} />
        ) : ehCelular ? (
          <>
            <Sheet open={gavetaAberta} onOpenChange={setGavetaAberta}>
              <SheetContent side="left" className="w-[85vw] max-w-sm gap-0 p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>
                    {modo === "explorar" ? "Tabelas" : "Tipos do NERP"}
                  </SheetTitle>
                  <SheetDescription>Escolha o que abrir.</SheetDescription>
                </SheetHeader>
                {lista}
              </SheetContent>
            </Sheet>
            <div className="h-full min-w-0">{conteudo}</div>
          </>
        ) : (
          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel defaultSize={300} minSize={220} maxSize={520}>
              {lista}
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel minSize={360}>
              <div className="h-full min-w-0">{conteudo}</div>
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>
    </div>
  );
}
