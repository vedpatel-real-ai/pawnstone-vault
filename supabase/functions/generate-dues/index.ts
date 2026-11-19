import { createClient } from 'npm:@supabase/supabase-js@2.112.3'
import { duesHandler } from './handler.ts'

Deno.serve(duesHandler({
  secret: Deno.env.get('DUES_SCHEDULER_SECRET'),
  url: Deno.env.get('SUPABASE_URL'),
  serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
}, async (url, key) => {
  const client = createClient(url, key, { auth: { persistSession: false } })
  const { data, error } = await client.rpc('generate_scheduled_dues')
  if (error) throw error
  return { generated: data }
}))
