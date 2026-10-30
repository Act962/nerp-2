import "server-only";

import {
  CadastroFiscalIncompletoError,
  type Destinatario,
  ErroFiscal,
  type ModeloDocumento,
  type MontadorDeNota,
  type VendaParaNota,
} from "@nerp/fiscal";
import prisma from "@/lib/db";
import { montarNotaDaVenda } from "../montar-nota";

/**
 * Lê a venda (filtrando por organização), os produtos e a config fiscal e
 * delega a tradução para `montarNotaDaVenda`. Cadastro incompleto vira
 * `CadastroFiscalIncompletoError` com a lista do que corrigir.
 */
export class MontadorDeNotaPrisma implements MontadorDeNota {
  async montar(input: {
    organizationId: string;
    saleId: string;
    modelo: ModeloDocumento;
    destinatario?: Destinatario | null;
  }): Promise<VendaParaNota | null> {
    const venda = await prisma.sale.findFirst({
      where: { id: input.saleId, organizationId: input.organizationId },
      select: {
        status: true,
        total: true,
        shipping: true,
        paymentMethod: true,
        payments: { select: { method: true, amount: true } },
        customer: { select: { name: true, document: true } },
        items: {
          select: {
            productName: true,
            quantity: true,
            unitPrice: true,
            product: {
              select: {
                id: true,
                sku: true,
                barcode: true,
                unit: true,
                ncm: true,
                cest: true,
                cfop: true,
                origem: true,
                cstIcms: true,
                cstPis: true,
                cstCofins: true,
                cClassTrib: true,
                cstIbsCbs: true,
              },
            },
          },
        },
      },
    });
    if (!venda) return null;
    if (venda.status === "CANCELLED")
      throw new ErroFiscal(
        "VENDA_CANCELADA",
        "Venda cancelada não emite nota fiscal",
      );

    const config = await prisma.fiscalConfig.findUnique({
      where: { organizationId: input.organizationId },
    });

    const r = montarNotaDaVenda(
      {
        total: Number(venda.total),
        shipping: Number(venda.shipping),
        paymentMethod: venda.paymentMethod,
        pagamentos: venda.payments.map((p) => ({
          method: p.method,
          amount: Number(p.amount),
        })),
        cliente: venda.customer,
        itens: venda.items.map((i) => ({
          productName: i.productName,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          produto: i.product,
        })),
      },
      config && {
        environment: config.environment,
        cnpj: config.cnpj,
        ie: config.ie,
        legalName: config.legalName,
        tradeName: config.tradeName,
        taxRegime: config.taxRegime,
        ufFiscal: config.ufFiscal,
        cityCode: config.cityCode,
        cityName: config.cityName,
        address: config.address,
        addressNumber: config.addressNumber,
        complement: config.complement,
        neighborhood: config.neighborhood,
        zipCode: config.zipCode,
        fiscalPhone: config.fiscalPhone,
        nfceSerie: config.nfceSerie,
        padroes: {
          cfop: config.defaultCfop,
          cstIcms: config.defaultCstIcms,
          cstPis: config.defaultCstPis,
          cstCofins: config.defaultCstCofins,
        },
      },
      input.destinatario,
    );
    if (!r.ok) throw new CadastroFiscalIncompletoError(r.pendencias);
    return { nota: r.nota, serie: r.serie };
  }
}
