// Database amounts have two decimal places and rates have three. Round half up once.
export function calculateMonthlyInterest(principal: number, rate: number): number {
  const paise = BigInt(Math.round(principal * 100))
  const thousandths = BigInt(Math.round(rate * 1000))
  return Number((paise * thousandths + 50000n) / 100000n) / 100
}
