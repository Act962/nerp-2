import "server-only";
import {
  AsaasError,
  type AsaasBillingType,
  type AsaasEnv,
  createCharge,
  dueDatePlus,
  findOrCreateCustomer,
  getCharge,
  getPixQrCode,
} from "@/lib/asaas";
import { sanitizarErro } from "@/features/integracoes/server/credentials";
import { estadoDoAsaas } from "../lib/estado-da-cobranca";
import type {
  CobrancaCriada,
  EstadoDaCobranca,
  MetodoDeCobranca,
  NovaCobranca,
  ProvedorDePagamento,
} from "../lib/porta";

const COBRANCA_DO_ASAAS: Record<MetodoDeCobranca, AsaasBillingType> = {
  PIX: "PIX",
  BOLETO: "BOLETO",
  CREDITO: "CREDIT_CARD",
};

/**
 * Prazo do PIX do pedido.
 *
 * Um dia, não trinta: PIX de comida não é boleto. O cliente paga em minutos ou
 * desiste, e cobrança viva por um mês seria dinheiro entrando depois que a
 * cozinha já fechou.
 */
const DIAS_DE_VENCIMENTO = 1;

/**
 * O Asaas falando a língua do domínio.
 *
 * Toda mensagem de erro passa por `sanitizarErro` antes de sair: o provedor
 * ecoa o cabeçalho de autenticação em parte das respostas de erro, e esse texto
 * vai para toast e para o banco.
 */
export function criarProvedorAsaas({
  apiKey,
  environment,
}: {
  apiKey: string;
  environment: AsaasEnv;
}): ProvedorDePagamento {
  const limpar = (erro: unknown): Error => {
    const mensagem =
      erro instanceof Error ? erro.message : "Falha ao falar com o Asaas";
    const status = erro instanceof AsaasError ? erro.status : undefined;
    return new Error(
      sanitizarErro(status ? `${mensagem} (${status})` : mensagem, [apiKey]),
    );
  };

  return {
    nome: "asaas",

    async criarCobranca(entrada: NovaCobranca): Promise<CobrancaCriada> {
      try {
        const cliente = await findOrCreateCustomer(
          apiKey,
          environment,
          entrada.pagador.email,
          entrada.pagador.nome,
          entrada.pagador.documento,
        );

        const cobranca = await createCharge(apiKey, environment, {
          customerId: cliente.id,
          billingType: COBRANCA_DO_ASAAS[entrada.metodo],
          value: entrada.valor,
          dueDate: dueDatePlus(DIAS_DE_VENCIMENTO),
          description: entrada.descricao,
          externalReference: entrada.referencia,
          callbackSuccessUrl: entrada.urlDeRetorno,
        });

        // O QR é uma segunda chamada. Falhar aqui não invalida a cobrança — o
        // cliente ainda pode pagar pela página do provedor —, então o erro não
        // derruba o pedido.
        let pixPayload: string | null = null;
        let pixQrImage: string | null = null;
        let expiraEm: Date | null = null;

        if (entrada.metodo === "PIX") {
          try {
            const qr = await getPixQrCode(apiKey, environment, cobranca.id);
            pixPayload = qr.payload;
            pixQrImage = qr.encodedImage;
            expiraEm = qr.expirationDate ? new Date(qr.expirationDate) : null;
          } catch (erro) {
            console.error(
              "[asaas] cobrança criada, QR falhou:",
              limpar(erro).message,
            );
          }
        }

        return {
          externalId: cobranca.id,
          estado: estadoDoAsaas(cobranca.status),
          pixPayload,
          pixQrImage,
          urlDePagamento: cobranca.invoiceUrl ?? null,
          expiraEm,
        };
      } catch (erro) {
        throw limpar(erro);
      }
    },

    async consultarCobranca(externalId: string): Promise<EstadoDaCobranca> {
      try {
        const cobranca = await getCharge(apiKey, environment, externalId);
        return estadoDoAsaas(cobranca.status);
      } catch (erro) {
        throw limpar(erro);
      }
    },
  };
}
