import "server-only";

import type { ToolSet } from "ai";
import { construirTools } from "@/features/astro-consultor/server/tools";
import { construirToolsDeAcaoDeCalendario } from "./tools/acoes-calendario";
import { construirToolsDeAcaoDeCampanha } from "./tools/acoes-campanha";
import { construirToolsDeAcaoDeCatalogo } from "./tools/acoes-catalogo";
import { construirToolsDeAcaoDeProdutos } from "./tools/acoes-produtos";
import type { ContextoToolsApp } from "./tools/_contexto";
import { construirToolsDeBuscaWeb } from "./tools/busca-web";
import { construirToolsDeCalendario } from "./tools/calendario";
import { construirToolsDeCatalogos } from "./tools/catalogos";
import { construirToolsDeClientes } from "./tools/clientes";
import { construirToolsDeEstoque } from "./tools/estoque";
import { construirToolsDeImagem } from "./tools/imagens";
import { construirToolsDeMemoria } from "./tools/memoria";
import { construirToolsDeOperacao } from "./tools/operacao";
import { construirToolsDePrevisao } from "./tools/previsao";
import { construirToolsDeStars } from "./tools/stars";
import { construirToolsDeSuporte } from "./tools/suporte";
import { construirToolsDeTrade } from "./tools/trade";
import { construirToolsDeVendas } from "./tools/vendas";
import { construirToolsDeWhatsapp } from "./tools/whatsapp";

/**
 * O que o Astro pode fazer dentro do nerp.
 *
 * As tools do site entram todas — é o mesmo Astro, com o mesmo conhecimento da
 * ÓRBITA, e um cliente que quer mais um módulo passa pelo mesmo caminho de
 * estimativa e formulário que um visitante. Por cima delas vêm as da operação,
 * um arquivo por domínio.
 *
 * TODAS as tools de operação carregam `organizationId` em closure, nunca como
 * argumento. Se o id da organização fosse parâmetro, bastaria uma mensagem bem
 * escrita para o modelo "consultar" a operação de outra empresa. É a ausência
 * do parâmetro, não uma regra do prompt, que segura isso — e é o que o teste
 * de isolamento verifica tool por tool.
 */

export type { ContextoToolsApp } from "./tools/_contexto";

export function construirToolsDoApp(contexto: ContextoToolsApp): ToolSet {
  const doSite = construirTools({
    sessaoId: contexto.sessaoId,
    tabelaPrecos: contexto.tabelaPrecos,
    falaDoVisitante: contexto.falaDoVisitante,
  });

  return {
    ...doSite,
    ...construirToolsDeOperacao(contexto),
    ...construirToolsDeVendas(contexto),
    ...construirToolsDePrevisao(contexto),
    ...construirToolsDeClientes(contexto),
    ...construirToolsDeEstoque(contexto),
    ...construirToolsDeCalendario(contexto),
    ...construirToolsDeTrade(contexto),
    ...construirToolsDeCatalogos(contexto),
    ...construirToolsDeWhatsapp(contexto),
    ...construirToolsDeStars(contexto),
    ...construirToolsDeSuporte(contexto),
    // Do provedor, e só quando é o Google: sem ele as duas saem vazias.
    ...construirToolsDeBuscaWeb(contexto),
    // Escrita: cada uma para o laço e espera o sim da pessoa no cartão da
    // conversa (`acoes/aprovacao.ts`).
    ...construirToolsDeAcaoDeCatalogo(contexto),
    ...construirToolsDeAcaoDeCampanha(contexto),
    ...construirToolsDeAcaoDeCalendario(contexto),
    ...construirToolsDeAcaoDeProdutos(contexto),
    ...construirToolsDeImagem(contexto),
    ...construirToolsDeMemoria(contexto),
  };
}
