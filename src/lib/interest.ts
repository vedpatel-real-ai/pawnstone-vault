export function calculateMonthlyInterest(remainingPrincipal: number, interestPercent: number): number {
  // Simple monthly interest: principal * (rate% / 100)
  const raw = remainingPrincipal * (interestPercent / 100);
  return Math.round(raw * 100) / 100;
}
