export function comparableBuyPrice(buyPrice: number, marketPrice: number): number {
  if (!Number.isFinite(buyPrice) || !Number.isFinite(marketPrice) || buyPrice <= 0 || marketPrice <= 0) {
    return buyPrice;
  }
  const ratio = marketPrice / buyPrice;
  if (ratio >= 100 && ratio <= 10_000) return buyPrice * 1000;
  if (ratio <= 0.01 && ratio >= 0.0001) return buyPrice / 1000;
  return buyPrice;
}

export function calculatePnlPct(buyPrice: number, marketPrice: number): number {
  const normalizedBuy = comparableBuyPrice(buyPrice, marketPrice);
  if (!Number.isFinite(normalizedBuy) || normalizedBuy <= 0) return NaN;
  return ((marketPrice - normalizedBuy) / normalizedBuy) * 100;
}
