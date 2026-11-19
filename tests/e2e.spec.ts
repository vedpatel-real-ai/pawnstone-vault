import { test, expect } from '@playwright/test'

test.describe('PawnTrack Vault Demo Mode End-to-End Suite', () => {
  test('Complete Demo Workflow: Login -> Dashboard KPIs -> Customer CRUD -> Loan Origination -> Payment -> Reset', async ({ page }) => {
    // 1. Open app and reach login page
    await page.goto('/login')
    await expect(page).toHaveTitle(/PawnTrack/i)

    // 2. Click "Use Demo Account"
    const demoBtn = page.getByRole('button', { name: /use demo account/i })
    await expect(demoBtn).toBeVisible()
    await demoBtn.click()

    // 3. Verify redirection to Dashboard and presence of live KPIs
    await page.waitForURL('**/dashboard')
    await expect(page.getByRole('heading', { name: 'Vault Operations Dashboard' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Active Loans' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Overdue Loans' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pledged Collateral' })).toBeVisible()

    // Verify presence of Operational Alerts
    await expect(page.getByRole('heading', { name: /Delinquency Watch/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Interest Due This Week/i })).toBeVisible()

    const collected = page.getByRole('link',{name:/Collected \(Month\)/}).locator('.text-2xl')
    await expect(collected).toContainText('₹')
    const before = Number((await collected.innerText()).replace(/[₹,]/g,''))
    // 4. Test Dashboard Drill-down to Loans
    const activeLoansCard = page.getByRole('heading', { name: 'Active Loans' }).locator('..').locator('..')
    await activeLoansCard.click()
    await page.waitForURL('**/loans?status=active')
    await expect(page.getByRole('heading', { name: 'Loans Portfolio' })).toBeVisible()

    // 5. Navigate to Customers page and create a new customer
    await page.getByRole('link', { name: 'Customers' }).click()
    await page.waitForURL('**/customers')
    await expect(page.getByRole('heading', { name: /Customers/i })).toBeVisible()

    const addCustomerBtn = page.getByRole('button', { name: 'Add Customer' }).first()
    await addCustomerBtn.click()

    // Fill in customer modal form
    const uniquePhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`
    await page.getByPlaceholder('e.g. Rajesh Kumar').fill('E2E Automated Test Customer')
    await page.getByPlaceholder('9876543210').fill(uniquePhone)
    await page.getByPlaceholder('e.g. ABCDE1234F').fill('E2ETEST9988')
    await page.getByRole('button', { name: 'Save Customer' }).click()

    // Verify new customer appears in directory
    await expect(page.getByText('E2E Automated Test Customer')).toBeVisible()

    // 6. Navigate to Loans page and originate a new loan
    await page.getByRole('link', { name: 'Loans' }).click()
    await page.waitForURL('**/loans')

    const originateBtn = page.getByRole('button', { name: /Originate Loan/i })
    await originateBtn.click()

    // Select customer via customer picker modal
    await page.getByRole('button', { name: /Select Borrower from CRM/i }).click()
    await page.getByPlaceholder('Search by name, contact, or ID proof...').fill('E2E Automated')
    await page.getByRole('button', { name: 'Select' }).first().click()

    // Fill in loan details
    await page.getByPlaceholder('250000').fill('150000')
    await page.getByPlaceholder('375000').fill('225000')
    await page.getByPlaceholder(/Detailed description of collateral/i).fill('22k Solid Gold Kada with BIS Hallmark (30g)')

    // Submit loan form
    const createLoanSubmit = page.getByRole('button', { name: 'Originate Loan' }).last()
    await createLoanSubmit.click()

    await expect(page.getByRole('dialog')).toHaveCount(0)
    // Verify loan was created in portfolio
    await expect(page.getByText('E2E Automated Test Customer').first()).toBeVisible()
    await expect(page.getByText('22k Solid Gold Kada with BIS Hallmark (30g)')).toBeVisible()

    // 7. Record a payment on a loan
    const recordPaymentBtn = page.getByText('22k Solid Gold Kada with BIS Hallmark (30g)').locator('xpath=ancestor::*[.//button[normalize-space()="Record Payment"]][1]').getByRole('button',{name:'Record Payment'})
    await recordPaymentBtn.click()

    const confirmPaymentBtn = page.getByRole('button', { name: 'Confirm Payment' })
    await expect(confirmPaymentBtn).toBeVisible()
    const dialog = page.getByRole('dialog')
    await dialog.locator('input[type=number]').fill('1')
    await confirmPaymentBtn.click()

    // 8. Navigate to Payments page and verify payment log
    await page.getByRole('link', { name: 'Payments' }).click()
    await page.waitForURL('**/payments')
    await expect(page.getByRole('heading', { name: /Payment Ledger/i })).toBeVisible()

    const option = page.locator('select').first().getByRole('option').filter({hasText:'E2E Automated Test Customer'})
    const loanId = await option.getAttribute('value')
    await page.locator('select').first().selectOption(loanId!)
    await page.locator('select').nth(1).selectOption('principal')
    await page.getByPlaceholder('Payment amount').fill('10000')
    await page.getByRole('button',{name:'Record Payment',exact:true}).click()
    await expect(option).toContainText('1,40,000')
    const month = await page.evaluate(() => {
      const now = new Date()
      return new Date(now.getFullYear(),now.getMonth()+1,1,12).toISOString().slice(0,7)
    })
    await page.goto('/payments?dueMonth=' + month)
    const due = page.getByText(/E2E Automated Test Customer · Due/).locator('../..')
    await expect(due).toContainText('₹2,999')
    await expect(due).toContainText('Collected ₹1')
    await page.getByRole('link',{name:'Dashboard',exact:true}).click()
    await expect(collected).toHaveText('₹' + (before + 1).toLocaleString('en-IN'))

    // 9. Navigate to Collateral Inventory and verify asset listing
    await page.getByRole('link', { name: 'Assets' }).click()
    await page.waitForURL('**/assets')
    await expect(page.getByRole('heading', { name: /Vault Assets Register/i })).toBeVisible()

    // 10. Test Reset Demo Data action
    const resetDemoBtn = page.getByRole('button', { name: 'Reset Demo' })
    await expect(resetDemoBtn).toBeVisible()
    await resetDemoBtn.click()

    const confirmResetBtn = page.getByRole('button', { name: 'Reset Demo Data' })
    await expect(confirmResetBtn).toBeVisible()
    await confirmResetBtn.click()

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard')
    await expect(page.getByRole('heading', { name: 'Vault Operations Dashboard' })).toBeVisible()
  })
})
