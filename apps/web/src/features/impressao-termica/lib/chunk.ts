/**
 * Parte os bytes em pedaços do tamanho do MTU.
 *
 * O Web Bluetooth não expõe o MTU negociado, então o transporte chuta baixo
 * (20 bytes = ATT padrão de 23 menos 3 de cabeçalho) e deixa o usuário subir.
 * Mandar mais do que a impressora aguenta não dá erro: o buffer dela transborda
 * em silêncio e o cupom sai picotado, faltando pedaços no meio.
 */
export function chunkBytes(bytes: Uint8Array, size: number): Uint8Array[] {
  if (size <= 0) throw new Error("Tamanho de bloco precisa ser positivo");

  const pedacos: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += size) {
    pedacos.push(bytes.slice(i, i + size));
  }
  return pedacos;
}
