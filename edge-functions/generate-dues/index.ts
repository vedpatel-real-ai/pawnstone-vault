// Supabase Edge Function: generate-dues
// Deno runtime
import 'https://deno.land/x/xhr@0.1.0/mod.ts'
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')

// Calculate simple monthly interest rounded to 2 decimals
function calcInterest(remaining: number, ratePercent: number) {
  const amt = remaining * (ratePercent / 100)
  return Math.round(amt * 100) / 100
}

async function sendEmail(to: string, subject: string, text: string) {
  if (!SENDGRID_API_KEY) return { ok: false, reason: 'No SENDGRID_API_KEY' }
  const payload = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: 'no-reply@pawntrack.app', name: 'PawnTrack' },
    subject,
    content: [{ type: 'text/plain', value: text }],
  }
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  return { ok: res.ok }
}

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    // Mark overdue dues
    const { error: overdueErr } = await supabase
      .from('dues')
      .update({ status: 'overdue' })
      .lt('due_date', new Date().toISOString().slice(0, 10))
      .eq('status', 'pending')
    if (overdueErr) console.error('Overdue update error', overdueErr)

    // Fetch active loans needing dues
    const today = new Date().toISOString().slice(0, 10)
    const { data: loans, error } = await supabase
      .from('loans')
      .select('id, org_id, customer_id, remaining_principal, interest_rate_percent, next_due_date, status')
      .eq('status', 'active')
      .lte('next_due_date', today)

    if (error) throw error

    for (const loan of loans || []) {
      const amount = calcInterest(Number(loan.remaining_principal), Number(loan.interest_rate_percent))
      // Idempotent insert of due
      const { error: dueErr } = await supabase.from('dues').insert({
        org_id: loan.org_id,
        loan_id: loan.id,
        due_date: loan.next_due_date,
        amount,
        due_type: 'interest',
        status: 'pending',
      })
      if (dueErr && !String(dueErr.message).includes('unique')) {
        console.error('Due insert error', dueErr)
      }

      // Schedule next month
      const next = new Date(loan.next_due_date)
      next.setMonth(next.getMonth() + 1)
      const nextDate = next.toISOString().slice(0, 10)
      const { error: updErr } = await supabase
        .from('loans')
        .update({ last_interest_calculated: today, next_due_date: nextDate })
        .eq('id', loan.id)
      if (updErr) console.error('Loan update error', updErr)

      // Notification + optional email
      const { data: customer } = await supabase
        .from('customers')
        .select('email, name')
        .eq('id', loan.customer_id)
        .single()

      const title = 'Monthly interest due generated'
      const body = `An interest due of ${amount.toFixed(2)} is due on ${loan.next_due_date}.`
      await supabase.from('notifications').insert({
        org_id: loan.org_id,
        loan_id: loan.id,
        title,
        body,
      })

      if (customer?.email) {
        await sendEmail(
          customer.email,
          'PawnTrack: Monthly interest due',
          `Hello ${customer.name || ''},\n\nYour monthly interest of $${amount.toFixed(2)} is due on ${loan.next_due_date}.\n\nThank you.\n`
        )
      }
    }

    return new Response(JSON.stringify({ processed: loans?.length || 0 }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('generate-dues error', e)
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 })
  }
})
