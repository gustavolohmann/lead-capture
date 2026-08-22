export function formatBRL(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 'R$ 0,00';
  return amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function formatMonthlyEstimate(dailyBudget) {
  const amount = Number(dailyBudget);
  if (!Number.isFinite(amount) || amount <= 0) return formatBRL(0);
  return formatBRL(amount * 30);
}
