/** Total shown in shop detail coin row (unit price × buy quantity). */
export function shopDetailCoinRowTotal(unitPrice: number, quantity: number): number {
  const qty = Math.max(1, Math.floor(quantity));
  return unitPrice * qty;
}
