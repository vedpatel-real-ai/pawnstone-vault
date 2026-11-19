import { createClient } from 'npm:@supabase/supabase-js@2.112.3'
import { deliverClaimed } from './mail.ts'
import { duesHandler } from './handler.ts'

Deno.serve(duesHandler({
  secret: Deno.env.get('DUES_SCHEDULER_SECRET'),
  url: Deno.env.get('SUPABASE_URL'),
  serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
}, async (url, key) => {
  const client = createClient(url, key, { auth: { persistSession: false } })
  const { data, error } = await client.rpc('generate_scheduled_dues')
  if (error) throw error
  const token = Deno.env.get('SENDGRID_API_KEY')
  const sender = Deno.env.get('DUES_FROM_EMAIL')
  if (token && sender) {
    const { data: claims, error: claimError } = await client.rpc('claim_due_mail')
    if (claimError) throw claimError
    await deliverClaimed(claims, async notice => {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST', signal: AbortSignal.timeout(5000),
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: { email: sender }, personalizations: [{ to: [{ email: notice.recipient }] }],
          subject: 'PawnTrack monthly interest', content: [{ type: 'text/plain', value: notice.message }] }),
      })
      return response.ok
    }, async (id,state) => {
      const { error } = await client.from('notifications').update({mail_state:state}).eq('id',id).eq('mail_state','claimed').select('id').single()
      if (error) throw error
    })
  }
  return { generated: data }
}))
