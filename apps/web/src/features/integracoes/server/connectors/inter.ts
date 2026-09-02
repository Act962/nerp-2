import "server-only";
import z from "zod";
import type { Capacidade } from "../../catalog/types";
import { sanitizarErro } from "../credentials";
import { mtlsRequest } from "./http-mtls";
import type {
  DateRange,
  FinancialConnector,
  MovimentoDTO,
  SaldoDTO,
  TesteConexao,
} from "./types";

// ---------------------------------------------------------------------------
// Constantes da API do Inter — ÚNICO ponto do conector que depende do provedor.
//
// ATENÇÃO: host, rotas e nome do scope vieram da documentação pública, mas o
// portal do Inter é uma SPA que não abre para leitura automatizada, então NÃO
// foram verificados contra uma conta real. Ficam isolados aqui de propósito: se
// algum estiver errado, o conserto é neste bloco, sem tocar no resto. Conferir
// no primeiro cliente com credencial de verdade.
// ---------------------------------------------------------------------------
const HOST = "https://cdpj.partners.bancointer.com.br";
const ROTA_TOKEN = "/oauth/v2/token";
const ROTA_EXTRATO = "/banking/v2/extrato";
const ROTA_SALDO = "/banking/v2/saldo";
const SCOPE = "extrato.read";

export type InterConfig = {
  clientId: string;
  clientSecret: string;
  contaCorrente: string;
  /** PEM do certificado da integração. */
  cert: string;
  /** PEM da chave privada — o par do certificado acima. */
  key: string;
};

const tokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().optional(),
});

const extratoSchema = z.object({
  transacoes: z
    .array(
      z.object({
        dataEntrada: z.string(),
        tipoTransacao: z.string().optional(),
        tipoOperacao: z.enum(["C", "D"]),
        valor: z.union([z.string(), z.number()]),
        titulo: z.string().optional(),
        descricao: z.string().optional(),
      }),
    )
    .default([]),
});

const saldoSchema = z.object({
  disponivel: z.union([z.string(), z.number()]),
});

/** Reais (string ou number) → centavos inteiros. */
function paraCentavos(valor: string | number): number {
  const numero = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(numero) ? Math.round(numero * 100) : 0;
}

function dia(data: Date): string {
  return data.toISOString().slice(0, 10);
}

export function createInterConnector(config: InterConfig): FinancialConnector {
  const material = { cert: config.cert, key: config.key };
  const segredos = [config.clientSecret, config.clientId];

  // O token vale ~1h; o conector vive por uma requisição, então guardar em
  // memória basta e evita um POST extra a cada chamada.
  let tokenEmCache: string | null = null;

  async function obterToken(): Promise<string> {
    if (tokenEmCache) return tokenEmCache;

    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      scope: SCOPE,
      grant_type: "client_credentials",
    }).toString();

    const resposta = await mtlsRequest({
      url: `${HOST}${ROTA_TOKEN}`,
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      material,
    });

    if (resposta.status !== 200) {
      throw new Error(
        resposta.status === 400 || resposta.status === 401
          ? "Client ID ou Client Secret recusados pelo Inter."
          : `O Inter respondeu ${resposta.status} ao pedir o token.`,
      );
    }

    tokenEmCache = tokenSchema.parse(JSON.parse(resposta.body)).access_token;
    return tokenEmCache;
  }

  async function chamar(
    rota: string,
    query?: URLSearchParams,
  ): Promise<string> {
    const token = await obterToken();
    const url = `${HOST}${rota}${query ? `?${query}` : ""}`;
    const resposta = await mtlsRequest({
      url,
      headers: {
        authorization: `Bearer ${token}`,
        "x-conta-corrente": config.contaCorrente,
        accept: "application/json",
      },
      material,
    });

    if (resposta.status === 403) {
      throw new Error(
        "O Inter negou o acesso. Confira se a integração tem a permissão de consultar extrato e saldo.",
      );
    }
    if (resposta.status !== 200) {
      throw new Error(`O Inter respondeu ${resposta.status}.`);
    }
    return resposta.body;
  }

  const capacidades: Capacidade[] = ["extrato", "saldo"];

  return {
    capacidades,

    async testarConexao(): Promise<TesteConexao> {
      try {
        // Saldo em vez de só o token: o token prova as credenciais, mas não
        // prova que o número da conta corrente informado é o certo.
        const saldo = saldoSchema.parse(JSON.parse(await chamar(ROTA_SALDO)));
        const reais = (paraCentavos(saldo.disponivel) / 100).toLocaleString(
          "pt-BR",
          { style: "currency", currency: "BRL" },
        );
        return {
          ok: true,
          mensagem: `Conexão OK — saldo disponível ${reais}.`,
        };
      } catch (error) {
        // Credencial errada é resultado esperado, não exceção.
        return {
          ok: false,
          mensagem: sanitizarErro((error as Error).message, segredos),
        };
      }
    },

    async buscarExtrato(range: DateRange): Promise<MovimentoDTO[]> {
      const query = new URLSearchParams({
        dataInicio: dia(range.from),
        dataFim: dia(range.to),
      });
      const { transacoes } = extratoSchema.parse(
        JSON.parse(await chamar(ROTA_EXTRATO, query)),
      );

      return transacoes.map((t) => {
        const centavos = paraCentavos(t.valor);
        return {
          idExterno: null,
          data: t.dataEntrada.slice(0, 10),
          descricao: t.titulo ?? t.descricao ?? t.tipoTransacao ?? "Lançamento",
          // O Inter manda o valor sempre positivo e o sentido em `tipoOperacao`.
          valorCentavos: t.tipoOperacao === "D" ? -centavos : centavos,
          documento: null,
          tipo: t.tipoOperacao === "D" ? "DEBITO" : "CREDITO",
        };
      });
    },

    async buscarSaldo(): Promise<SaldoDTO> {
      const saldo = saldoSchema.parse(JSON.parse(await chamar(ROTA_SALDO)));
      return {
        valorCentavos: paraCentavos(saldo.disponivel),
        lidoEm: new Date().toISOString(),
      };
    },
  };
}
