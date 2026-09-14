/**
 * Como escrever a identificação do pedido na tela.
 *
 * `KitchenOrder.tableNumber` é texto livre e mudou de natureza ao longo do
 * tempo: começou como só o número ("18"), passou a receber rótulo pronto do
 * salão ("Mesa 3") e do cardápio ("Pedido #42 · João"). As telas prefixavam
 * "Mesa " sem olhar, e o resultado era "Mesa Mesa 3" e "Mesa Pedido #42".
 *
 * A regra: só número ganha o prefixo; texto que já se identifica passa direto.
 */
export function rotuloDaMesa(tableNumber: string): string {
  const texto = tableNumber.trim();
  if (!texto) return "Mesa";
  return /^\d+$/.test(texto) ? `Mesa ${texto}` : texto;
}
