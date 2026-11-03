import { listarPedidosGestao } from "./pedidos/listar";
import { detalharPedidoGestao } from "./pedidos/detalhe";
import { decidirPedidoGestao } from "./pedidos/decidir";
import { faturarPedidoGestao } from "./pedidos/faturar";
import { cancelarPedidoGestao } from "./pedidos/cancelar";
import { listarVendedoresGestao } from "./vendedores/listar";
import { atualizarVendedorGestao } from "./vendedores/atualizar";
import { ajustarFlexGestao } from "./vendedores/ajustar-flex";
import { extratoFlexGestao } from "./vendedores/extrato-flex";
import { clientesParaCarteiraGestao } from "./carteiras/clientes";
import { cidadesGestao } from "./carteiras/cidades";
import { atribuirCarteiraGestao } from "./carteiras/atribuir";
import { removerDaCarteiraGestao } from "./carteiras/remover";
import { mapaAoVivoGestao } from "./mapa/ao-vivo";
import { trajetoGestao } from "./mapa/trajeto";
import { resumoDeVisitasGestao } from "./visitas/resumo";
import { listarAvisosGestao } from "./avisos/listar";
import { publicarAvisoGestao } from "./avisos/publicar";
import { encerrarAvisoGestao } from "./avisos/encerrar";
import { obterConfiguracaoGestao } from "./configuracao/obter";
import { salvarConfiguracaoGestao } from "./configuracao/salvar";
import { listarCondicoesGestao } from "./condicoes/listar";
import { salvarCondicaoGestao } from "./condicoes/salvar";

export const forcaVendasGestaoRoutes = {
  pedidos: {
    listar: listarPedidosGestao,
    detalhe: detalharPedidoGestao,
    decidir: decidirPedidoGestao,
    faturar: faturarPedidoGestao,
    cancelar: cancelarPedidoGestao,
  },
  vendedores: {
    listar: listarVendedoresGestao,
    atualizar: atualizarVendedorGestao,
    ajustarFlex: ajustarFlexGestao,
    extratoFlex: extratoFlexGestao,
  },
  carteiras: {
    clientes: clientesParaCarteiraGestao,
    cidades: cidadesGestao,
    atribuir: atribuirCarteiraGestao,
    remover: removerDaCarteiraGestao,
  },
  mapa: {
    aoVivo: mapaAoVivoGestao,
    trajeto: trajetoGestao,
  },
  visitas: {
    resumo: resumoDeVisitasGestao,
  },
  avisos: {
    listar: listarAvisosGestao,
    publicar: publicarAvisoGestao,
    encerrar: encerrarAvisoGestao,
  },
  configuracao: {
    obter: obterConfiguracaoGestao,
    salvar: salvarConfiguracaoGestao,
  },
  condicoes: {
    listar: listarCondicoesGestao,
    salvar: salvarCondicaoGestao,
  },
};
