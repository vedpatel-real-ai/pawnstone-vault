// Test setup intentionally accepts no database URL or hosted credentials.
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

export const url = 'http://127.0.0.1:56421'
const status = execFileSync(process.env.PAWNTRACK_CLI || 'supabase', ['status', '-o', 'env'], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] })
const env = Object.fromEntries([...status.matchAll(/^(\w+)="([^"]*)"$/gm)].map(m => [m[1],m[2]]))
if (env.API_URL !== url) throw Error('Expected the isolated PawnTrack loopback stack')
const options = { auth: { persistSession: false, autoRefreshToken: false } }
export const publicKey = env.ANON_KEY
export const admin = createClient(url, env.SERVICE_ROLE_KEY, options)
export const guest = createClient(url, env.ANON_KEY, options)
export function ok(result) {
  if (result.error) throw new Error(result.error.message)
  return result.data
}
export async function actor() {
  const email = `fixture-${randomUUID()}@example.invalid`
  const password = randomUUID()
  ok(await admin.auth.admin.createUser({ email, password, email_confirm: true }))
  const client = createClient(url, env.ANON_KEY, options)
  const { user } = ok(await client.auth.signInWithPassword({ email, password }))
  const memberships = await Promise.all([1,2].map(async () => ok(await client.rpc('create_org_for_current_user'))))
  if (memberships[0] !== memberships[1]) throw Error('Provisioning returned two organizations')
  const org = memberships[0]
  const customer = ok(await client.from('customers').insert({name:'Synthetic customer',org_id:org}).select().single())
  return { client, user, org, customer, email, password }
}
export async function originate(actor, overrides = {}) {
  return ok(await actor.client.from('loans').insert({
    customer_id:actor.customer.id, org_id:actor.org, status:'active', asset_description:'Synthetic ring',
    loan_amount:1000,remaining_principal:1000,interest_rate_percent:2,start_date:'2024-01-31',
    next_due_date:'2024-02-29', ...overrides,
  }).select().single())
}
