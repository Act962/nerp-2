// Código de vendedor que não corresponde a uma pessoa. No Winthor o CODUSUR 7 é
// "CHECK-OUT BOMBONIERE" (venda de balcão) e sozinho fatura mais que o dobro do
// maior vendedor humano — rankeá-lo junto distorce qualquer comparação.
//
// Fonte única: usado pelo parser da planilha de metas e pelos conectores de ERP,
// que precisam classificar o mesmo código do mesmo jeito.
export const SELLER_BUCKET_KEYWORDS = ["TREINAMENTO", "CHECK-OUT", "CHECKOUT"];

export function isSellerBucketName(name: string): boolean {
  const upper = name.toUpperCase();
  return SELLER_BUCKET_KEYWORDS.some((keyword) => upper.includes(keyword));
}
