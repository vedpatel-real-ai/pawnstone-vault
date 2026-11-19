import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getProvider } from '@/data'
import type { Payment } from '@/data/types'

// Keep an opaque identifier for an unacknowledged collection across a tab reload.
export function usePaymentPosting() {
  const busy = useRef(false)
  const [posting, setPosting] = useState(false)
  const queries = useQueryClient()
  async function post(input: Omit<Payment,'id'|'created_at'|'request_id'>) {
    if (busy.current) throw Error('Collection already in progress')
    busy.current = true
    setPosting(true)
    try {
      const terms = JSON.stringify([input.org_id,input.loan_id,input.type,input.amount,input.notes])
      const hash = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(terms))
      const key = 'pawntrack-receipt-' + Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2,'0')).join('')
      const request_id = sessionStorage.getItem(key) ?? crypto.randomUUID()
      sessionStorage.setItem(key,request_id)
      const payment = await getProvider().payments.create({...input,request_id})
      sessionStorage.removeItem(key)
      await queries.invalidateQueries()
      return payment
    } finally {
      busy.current = false
      setPosting(false)
    }
  }
  return {post,posting}
}
