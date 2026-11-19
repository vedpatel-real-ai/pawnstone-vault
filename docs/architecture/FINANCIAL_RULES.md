# Posting rules

A receipt belongs to one organization and one loan. Amounts must be positive rupees with at most two decimal places. Principal cannot exceed the current balance. Interest pays open interest invoices oldest first, up to their combined outstanding amount. Other fees appear separately in the ledger. A request identifier represents one immutable receipt intent. Reusing it with different terms fails.

The first monthly interest invoice is issued at origination. Its amount stays fixed after principal changes. Later invoices use the principal at the monthly assessment, rounded half up to paise. Before a payment changes principal, outstanding scheduled periods must be assessed. Each month uses the original start day, shortened to the month's last day when needed. No compounding or late penalties. The posting date is the current date in Asia/Kolkata. The ledger preserves legacy dates.

Principal can reach zero before interest is fully paid. The last collection closes the loan once principal and all issued collectible dues reach zero. Ordinary clients cannot delete loans or receipts, write balances, or reopen closed loans. Existing inconsistent records require reconciliation before upgrading.
