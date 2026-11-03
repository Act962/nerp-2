import { dadosDaInicioFv } from "./inicio/dados";
import { listarCarteiraFv } from "./clientes/listar";
import { detalharClienteFv } from "./clientes/detalhe";
import { conversaDoClienteFv } from "./clientes/conversa";
import { buscarProdutosFv } from "./produtos/buscar";
import { detalharProdutoFv } from "./produtos/detalhe";
import { listarCondicoesFv } from "./pedidos/condicoes";
import { simularPedidoFv } from "./pedidos/simular";
import { enviarPedidoFv } from "./pedidos/enviar";
import { listarPedidosFv } from "./pedidos/listar";
import { detalharPedidoFv } from "./pedidos/detalhe";
import { cancelarPedidoFv } from "./pedidos/cancelar";
import { enviarOrcamentoFv } from "./pedidos/enviar-orcamento";
import { decidirPedidoFv } from "./pedidos/decidir";
import { titulosDaCarteiraFv } from "./consultas/titulos";
import { extratoFlexFv } from "./consultas/extrato-flex";
import { roteiroDoDiaFv } from "./rota/dia";
import { adicionarAoRoteiroFv } from "./rota/adicionar";
import { removerDoRoteiroFv } from "./rota/remover";
import { reordenarRoteiroFv } from "./rota/reordenar";
import { otimizarRoteiroFv } from "./rota/otimizar";
import { visitaAbertaFv } from "./visitas/aberta";
import { fazerCheckinFv } from "./visitas/checkin";
import { fazerCheckoutFv } from "./visitas/checkout";
import { estadoDaJornadaFv } from "./jornada/estado";
import { iniciarJornadaFv } from "./jornada/iniciar";
import { encerrarJornadaFv } from "./jornada/encerrar";
import { registrarLocalizacaoFv } from "./localizacao/registrar";
import { listarAvisosFv } from "./avisos/listar";
import { marcarAvisoFv } from "./avisos/marcar";
import { listarConversasFv } from "./mensagens/conversas";
import { abrirConversaFv } from "./mensagens/abrir";
import { naoLidasFv } from "./mensagens/nao-lidas";

export const forcaVendasRoutes = {
  inicio: {
    dados: dadosDaInicioFv,
  },
  clientes: {
    listar: listarCarteiraFv,
    detalhe: detalharClienteFv,
    conversa: conversaDoClienteFv,
  },
  produtos: {
    buscar: buscarProdutosFv,
    detalhe: detalharProdutoFv,
  },
  pedidos: {
    condicoes: listarCondicoesFv,
    simular: simularPedidoFv,
    enviar: enviarPedidoFv,
    listar: listarPedidosFv,
    detalhe: detalharPedidoFv,
    cancelar: cancelarPedidoFv,
    enviarOrcamento: enviarOrcamentoFv,
    decidir: decidirPedidoFv,
  },
  consultas: {
    titulos: titulosDaCarteiraFv,
    extratoFlex: extratoFlexFv,
  },
  rota: {
    dia: roteiroDoDiaFv,
    adicionar: adicionarAoRoteiroFv,
    remover: removerDoRoteiroFv,
    reordenar: reordenarRoteiroFv,
    otimizar: otimizarRoteiroFv,
  },
  visitas: {
    aberta: visitaAbertaFv,
    checkin: fazerCheckinFv,
    checkout: fazerCheckoutFv,
  },
  jornada: {
    estado: estadoDaJornadaFv,
    iniciar: iniciarJornadaFv,
    encerrar: encerrarJornadaFv,
  },
  localizacao: {
    registrar: registrarLocalizacaoFv,
  },
  avisos: {
    listar: listarAvisosFv,
    marcar: marcarAvisoFv,
  },
  mensagens: {
    conversas: listarConversasFv,
    abrir: abrirConversaFv,
    naoLidas: naoLidasFv,
  },
};
