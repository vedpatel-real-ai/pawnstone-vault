// Posting and monthly assessment use a single civil calendar across shops and browsers.
export function businessDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)
}
