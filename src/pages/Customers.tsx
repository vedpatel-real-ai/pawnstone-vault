import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/useAuth'
import { ExportButtons } from '@/components/ExportButtons'
import { enqueue } from '@/lib/offlineQueue'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

// Helpers
const TEN_DIGITS = /^\d{10}$/

function validatePhone(num: string) {
  return TEN_DIGITS.test(num.trim())
}

async function cropImageToSquare(file: File, outputType: 'image/jpeg' | 'image/png' = 'image/jpeg'): Promise<File> {
  const img = document.createElement('img')
  const url = URL.createObjectURL(file)
  img.src = url
  await new Promise((res, rej) => { img.onload = () => res(null); img.onerror = rej })
  const size = Math.min(img.naturalWidth, img.naturalHeight)
  const sx = Math.floor((img.naturalWidth - size) / 2)
  const sy = Math.floor((img.naturalHeight - size) / 2)
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size)
  const blob: Blob = await new Promise((resolve) => canvas.toBlob(b => resolve(b as Blob), outputType, 0.9))
  URL.revokeObjectURL(url)
  return new File([blob], file.name.replace(/\.(png|jpg|jpeg)$/i, outputType === 'image/png' ? '.png' : '.jpg'), { type: outputType })
}

export default function Customers() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { orgId } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const params = new URLSearchParams(location.search)
  const overdueParam = params.get('overdue') === 'true'

  // Base customers
  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => (await supabase.from('customers').select('*').order('created_at', { ascending: false })).data || []
  })

  // Overdue customer ids (keep existing behavior)
  const { data: overdueCustomerIds } = useQuery({
    queryKey: ['overdue-customer-ids', orgId],
    queryFn: async () => {
      if (!orgId) return new Set<string>()
      const { data: overdueDues } = await supabase
        .from('dues')
        .select('loan_id')
        .eq('org_id', orgId)
        .eq('status', 'overdue')
        .eq('due_type', 'interest')
      const loanIds = Array.from(new Set((overdueDues || []).map((d: any) => d.loan_id).filter(Boolean)))
      if (loanIds.length === 0) return new Set<string>()
      const { data: loans } = await supabase
        .from('loans')
        .select('id, customer_id')
        .in('id', loanIds)
      return new Set<string>((loans || []).map((l: any) => l.customer_id))
    },
    enabled: !!orgId,
  })

  // Aggregations for filters/sorting
  const { data: totalBorrowedMap = {} } = useQuery({
    queryKey: ['customers-total-borrowed', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data: loans } = await supabase.from('loans').select('customer_id, loan_amount')
      const map: Record<string, number> = {}
      for (const l of loans || []) {
        if (!l.customer_id) continue
        map[l.customer_id] = (map[l.customer_id] || 0) + Number(l.loan_amount || 0)
      }
      return map
    }
  })

  const { data: totalInterestPaidMap = {} } = useQuery({
    queryKey: ['customers-total-interest-paid', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data: payments } = await supabase
        .from('payments')
        .select('amount, loan_id, type')
        .eq('type', 'interest')

      const { data: loans } = await supabase
        .from('loans')
        .select('id, customer_id')

      const loanToCustomer = new Map((loans || []).map((l: any) => [l.id, l.customer_id]))
      const map: Record<string, number> = {}
      for (const p of payments || []) {
        const cid = loanToCustomer.get(p.loan_id)
        if (!cid) continue
        map[cid] = (map[cid] || 0) + Number(p.amount || 0)
      }
      return map
    }
  })

  // Realtime: refresh on changes
  useEffect(() => {
    const channel = supabase
      .channel('customers-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => qc.invalidateQueries({ queryKey: ['customers'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, () => {
        qc.invalidateQueries({ queryKey: ['customers-total-borrowed', orgId] })
        qc.invalidateQueries({ queryKey: ['overdue-customer-ids', orgId] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => qc.invalidateQueries({ queryKey: ['customers-total-interest-paid', orgId] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dues' }, () => qc.invalidateQueries({ queryKey: ['overdue-customer-ids', orgId] }))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [qc, orgId])

  // Form state
  type FormState = {
    name: string
    phone: string
    alt_phone: string
    id_proof_number: string
    notes: string
    photoFile?: File | null
    idProofFile?: File | null
  }
  const [openForm, setOpenForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>({ name: '', phone: '', alt_phone: '', id_proof_number: '', notes: '', photoFile: null, idProofFile: null })
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null)
  const [previewIdProofUrl, setPreviewIdProofUrl] = useState<string | null>(null)
  const filePhotoRef = useRef<HTMLInputElement>(null)
  const fileIdProofRef = useRef<HTMLInputElement>(null)

  const resetForm = () => {
    setForm({ name: '', phone: '', alt_phone: '', id_proof_number: '', notes: '', photoFile: null, idProofFile: null })
    setPreviewPhotoUrl(null)
    setPreviewIdProofUrl(null)
    setEditingId(null)
  }

  useEffect(() => { document.title = 'Customers | PawnTrack' }, [])

  // Upload helpers
  async function uploadCustomerMedia(customerId: string, photo?: File | null, idProof?: File | null) {
    let profile_photo_url: string | undefined
    let id_proof_url: string | undefined

    // Photo: jpeg/png only, max 2MB, crop square
    if (photo) {
      if (!/^image\/(jpeg|png)$/.test(photo.type)) throw new Error('Photo must be JPG or PNG')
      if (photo.size > 2 * 1024 * 1024) throw new Error('Photo exceeds 2MB')
      const cropped = await cropImageToSquare(photo, 'image/jpeg')
      const path = `${customerId}/profile_photo.jpg`
      const { error: upErr } = await supabase.storage.from('customers').upload(path, cropped, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' })
      if (upErr) throw upErr
      const { data: signed } = await supabase.storage.from('customers').createSignedUrl(path, 600)
      profile_photo_url = signed?.signedUrl
    }

    // ID proof file (optional): jpg/png up to 2MB OR pdf up to 5MB
    if (idProof) {
      const isPdf = idProof.type === 'application/pdf'
      const isImg = /^image\/(jpeg|png)$/.test(idProof.type)
      if (!isPdf && !isImg) throw new Error('ID proof must be JPG/PNG/PDF')
      if (isPdf && idProof.size > 5 * 1024 * 1024) throw new Error('PDF exceeds 5MB')
      if (isImg && idProof.size > 2 * 1024 * 1024) throw new Error('Image exceeds 2MB')
      const finalFile = isImg ? idProof : idProof
      const ext = isPdf ? 'pdf' : (/png$/i.test(finalFile.type) ? 'png' : 'jpg')
      const path = `${customerId}/id_proof.${ext}`
      const { error: upErr } = await supabase.storage.from('customers').upload(path, finalFile, { upsert: true, contentType: finalFile.type, cacheControl: '3600' })
      if (upErr) throw upErr
      const { data: signed } = await supabase.storage.from('customers').createSignedUrl(path, 600)
      id_proof_url = signed?.signedUrl
    }

    return { profile_photo_url, id_proof_url }
  }

  // Create / Update mutations
  const saveCustomer = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('Organization not set')
      const { name, phone, alt_phone, id_proof_number, notes, photoFile, idProofFile } = form

      if (!validatePhone(phone)) throw new Error('Primary contact must be 10 digits')
      if (alt_phone && !validatePhone(alt_phone)) throw new Error('Alternate contact must be 10 digits')
      if (alt_phone && phone === alt_phone) throw new Error('Alternate cannot match primary')

      if (!editingId) {
        // 1) Create minimal row to get id
        const payload: any = { name, phone, alt_phone, id_proof_number, notes, org_id: orgId }
        const { data, error } = await supabase.from('customers').insert(payload).select('id').single()
        if (error) throw error
        const id = data!.id as string

        // 2) Upload media (if any)
        try {
          const { profile_photo_url, id_proof_url } = await uploadCustomerMedia(id, photoFile!, idProofFile!)
          if (profile_photo_url || id_proof_url) {
            await supabase.from('customers').update({ profile_photo_url, id_proof_url }).eq('id', id)
          }
        } catch (err: any) {
          // keep the created customer; just notify upload failure
          toast({ title: 'Upload error', description: err.message || 'Failed to upload files' })
        }
      } else {
        // Update row first
        const baseUpdate: any = { name, phone, alt_phone, id_proof_number, notes }
        const { error: upErr } = await supabase.from('customers').update(baseUpdate).eq('id', editingId)
        if (upErr) throw upErr
        // Then media if selected
        try {
          const { profile_photo_url, id_proof_url } = await uploadCustomerMedia(editingId, photoFile!, idProofFile!)
          const mediaUpdate: any = {}
          if (profile_photo_url) mediaUpdate.profile_photo_url = profile_photo_url
          if (id_proof_url) mediaUpdate.id_proof_url = id_proof_url
          if (Object.keys(mediaUpdate).length) await supabase.from('customers').update(mediaUpdate).eq('id', editingId)
        } catch (err: any) {
          toast({ title: 'Upload error', description: err.message || 'Failed to upload files' })
        }
      }
    },
    onSuccess: () => {
      toast({ title: editingId ? 'Customer updated' : 'Customer added' })
      setOpenForm(false)
      resetForm()
      qc.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: async (err: any) => {
      const payload = { ...form, org_id: orgId }
      await enqueue({ id: crypto.randomUUID(), type: 'create_customer', payload })
      toast({ title: 'Offline', description: 'Saved locally. Will sync when online.' })
    },
  })

  const deleteCustomer = async (id: string) => {
    if (!confirm('Delete this customer?')) return
    const { error } = await supabase.from('customers').delete().eq('id', id)
    if (error) { toast({ title: 'Delete failed', description: error.message }); return }
    toast({ title: 'Customer deleted' })
    qc.invalidateQueries({ queryKey: ['customers'] })
  }

  // Search / filter / sort
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'name-asc' | 'name-desc' | 'borrowed-desc' | 'interest-desc'>('recent')
  const [borrowedMin, setBorrowedMin] = useState<string>('')
  const [borrowedMax, setBorrowedMax] = useState<string>('')
  const [interestMin, setInterestMin] = useState<string>('')
  const [interestMax, setInterestMax] = useState<string>('')

  const visibleCustomers = useMemo(() => {
    let list: any[] = customers
    if (overdueParam) {
      const set = overdueCustomerIds || new Set<string>()
      list = list.filter((c: any) => set.has(c.id))
    }

    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter((c: any) =>
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        (c.alt_phone || '').includes(q) ||
        (c.id_proof_number || '').toLowerCase().includes(q)
      )
    }

    const bMin = borrowedMin ? Number(borrowedMin) : -Infinity
    const bMax = borrowedMax ? Number(borrowedMax) : Infinity
    const iMin = interestMin ? Number(interestMin) : -Infinity
    const iMax = interestMax ? Number(interestMax) : Infinity

    list = list.filter((c: any) => {
      const tb = totalBorrowedMap[c.id] || 0
      const ti = totalInterestPaidMap[c.id] || 0
      return tb >= bMin && tb <= bMax && ti >= iMin && ti <= iMax
    })

    list = [...list].sort((a, b) => {
      if (sortBy === 'recent') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sortBy === 'name-asc') return (a.name || '').localeCompare(b.name || '')
      if (sortBy === 'name-desc') return (b.name || '').localeCompare(a.name || '')
      if (sortBy === 'borrowed-desc') return (totalBorrowedMap[b.id] || 0) - (totalBorrowedMap[a.id] || 0)
      if (sortBy === 'interest-desc') return (totalInterestPaidMap[b.id] || 0) - (totalInterestPaidMap[a.id] || 0)
      return 0
    })

    return list
  }, [customers, overdueParam, overdueCustomerIds, search, sortBy, borrowedMin, borrowedMax, interestMin, interestMax, totalBorrowedMap, totalInterestPaidMap])

  // Handlers
  const onPickPhoto = (f?: File | null) => {
    if (!f) return
    setForm(prev => ({ ...prev, photoFile: f }))
    setPreviewPhotoUrl(URL.createObjectURL(f))
  }
  const onPickIdProof = (f?: File | null) => {
    if (!f) return
    setForm(prev => ({ ...prev, idProofFile: f }))
    setPreviewIdProofUrl(URL.createObjectURL(f))
  }

  const openCreate = () => { resetForm(); setOpenForm(true) }
  const openEdit = (c: any) => {
    setEditingId(c.id)
    setForm({ name: c.name || '', phone: c.phone || '', alt_phone: c.alt_phone || '', id_proof_number: c.id_proof_number || '', notes: c.notes || '', photoFile: null, idProofFile: null })
    setPreviewPhotoUrl(null)
    setPreviewIdProofUrl(null)
    setOpenForm(true)
  }

  const openProfile = (c: any) => {
    navigate(`/customers?profile=${c.id}${overdueParam ? '&overdue=true' : ''}`)
  }

  const profileId = params.get('profile')
  const { data: profileLoans = [] } = useQuery({
    queryKey: ['customer-loans', profileId],
    enabled: !!profileId,
    queryFn: async () => (await supabase.from('loans').select('*').eq('customer_id', profileId)).data || []
  })

  const profileCustomer = useMemo(() => customers.find((c: any) => c.id === profileId), [customers, profileId])

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={openCreate}>Add Customer</Button>
          <ExportButtons data={visibleCustomers || []} filename="customers" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Search name / phone / alt / ID proof" value={search} onChange={e => setSearch(e.target.value)} className="w-[240px]" />
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
            <option value="recent">Most recent</option>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="borrowed-desc">Highest total borrowed</option>
            <option value="interest-desc">Highest interest paid</option>
          </select>
        </div>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Customers{overdueParam ? ' — Overdue interest' : ''}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="col-span-2 grid grid-cols-2 gap-2">
              <Input placeholder="Borrowed min" inputMode="numeric" value={borrowedMin} onChange={e => setBorrowedMin(e.target.value)} />
              <Input placeholder="Borrowed max" inputMode="numeric" value={borrowedMax} onChange={e => setBorrowedMax(e.target.value)} />
              <Input placeholder="Interest min" inputMode="numeric" value={interestMin} onChange={e => setInterestMin(e.target.value)} />
              <Input placeholder="Interest max" inputMode="numeric" value={interestMax} onChange={e => setInterestMax(e.target.value)} />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {(visibleCustomers || []).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="flex items-center gap-3">
                  <img
                    src={c.profile_photo_url || '/placeholder.svg'}
                    alt={`${c.name || 'Customer'} photo`}
                    width={30}
                    height={30}
                    loading="lazy"
                    className="h-[30px] w-[30px] rounded-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg' }}
                  />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-sm text-muted-foreground truncate">{c.phone}{c.alt_phone ? ` · Alt: ${c.alt_phone}` : ''}</div>
                    <div className="text-xs text-muted-foreground truncate">Borrowed: ₹{(totalBorrowedMap[c.id] || 0).toLocaleString()} · Interest paid: ₹{(totalInterestPaidMap[c.id] || 0).toLocaleString()}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => openProfile(c)}>Profile</Button>
                  <Button variant="outline" onClick={() => openEdit(c)}>Edit</Button>
                  <Button variant="destructive" onClick={() => deleteCustomer(c.id)}>Delete</Button>
                </div>
              </div>
            ))}
            {(!customersLoading && (visibleCustomers || []).length === 0) && (
              <div className="text-sm text-muted-foreground">No customers found.</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Full Name*</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Primary Contact Number*</Label>
              <Input inputMode="numeric" pattern="\\d{10}" placeholder="10 digits" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/[^0-9]/g, '') })} required />
            </div>
            <div className="space-y-2">
              <Label>Alternate Contact Number <span className="text-muted-foreground text-xs">(Optional — used if primary is unreachable)</span></Label>
              <Input inputMode="numeric" pattern="\\d{10}" placeholder="10 digits" value={form.alt_phone} onChange={e => setForm({ ...form, alt_phone: e.target.value.replace(/[^0-9]/g, '') })} />
            </div>
            <div className="space-y-2">
              <Label>ID Proof (Text)</Label>
              <Input placeholder="e.g., Aadhaar number" value={form.id_proof_number} onChange={e => setForm({ ...form, id_proof_number: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Customer Photo (JPG/PNG, max 2MB)</Label>
              <Input ref={filePhotoRef} type="file" accept="image/jpeg,image/png" onChange={e => onPickPhoto(e.target.files?.[0])} />
              {previewPhotoUrl && (
                <img src={previewPhotoUrl} alt="Preview" className="h-24 w-24 rounded-md object-cover" />
              )}
            </div>
            <div className="space-y-2">
              <Label>ID Proof File (JPG/PNG ≤2MB or PDF ≤5MB)</Label>
              <Input ref={fileIdProofRef} type="file" accept="image/jpeg,image/png,application/pdf" onChange={e => onPickIdProof(e.target.files?.[0])} />
              {previewIdProofUrl && (
                <div className="text-xs text-muted-foreground truncate">Selected: {fileIdProofRef.current?.files?.[0]?.name}</div>
              )}
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Notes</Label>
              <Textarea rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpenForm(false); }}>Cancel</Button>
            <Button onClick={() => saveCustomer.mutate()} disabled={saveCustomer.isPending}>
              {saveCustomer.isPending ? 'Saving...' : (editingId ? 'Update' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile Modal */}
      <Dialog open={!!profileId} onOpenChange={(o) => { if (!o) { params.delete('profile'); navigate({ pathname: '/customers', search: params.toString() }) } }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Customer Profile</DialogTitle>
          </DialogHeader>
          {profileCustomer ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <img src={profileCustomer.profile_photo_url || '/placeholder.svg'} alt={`${profileCustomer.name} photo`} className="h-36 w-36 rounded-md object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg' }} />
                <div className="space-y-1">
                  <div className="text-lg font-semibold">{profileCustomer.name}</div>
                  <div className="text-sm text-muted-foreground">Primary: {profileCustomer.phone}</div>
                  {profileCustomer.alt_phone && <div className="text-sm text-muted-foreground">Alternate: {profileCustomer.alt_phone}</div>}
                  {profileCustomer.id_proof_number && <div className="text-sm">ID: {profileCustomer.id_proof_number}</div>}
                  {profileCustomer.id_proof_url && (
                    <a href={profileCustomer.id_proof_url} target="_blank" rel="noreferrer" className="text-sm underline">View ID Proof</a>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle className="text-base">Active Loans</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {profileLoans.filter((l: any) => l.status === 'active').map((l: any) => (
                      <div key={l.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                        <div>#{l.id.slice(0, 8)} · ₹{Number(l.loan_amount).toLocaleString()}</div>
                        <Button variant="outline" onClick={() => navigate(`/loans?loan_id=${l.id}`)}>Open</Button>
                      </div>
                    ))}
                    {profileLoans.filter((l: any) => l.status === 'active').length === 0 && (
                      <div className="text-sm text-muted-foreground">No active loans.</div>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">Closed Loans</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {profileLoans.filter((l: any) => l.status === 'closed').map((l: any) => (
                      <div key={l.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                        <div>#{l.id.slice(0, 8)} · ₹{Number(l.loan_amount).toLocaleString()}</div>
                        <Button variant="outline" onClick={() => navigate(`/loans?loan_id=${l.id}`)}>Open</Button>
                      </div>
                    ))}
                    {profileLoans.filter((l: any) => l.status === 'closed').length === 0 && (
                      <div className="text-sm text-muted-foreground">No closed loans.</div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader><CardTitle className="text-base">Financial Summary</CardTitle></CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Total borrowed: ₹{(totalBorrowedMap[profileCustomer.id] || 0).toLocaleString()} · Interest paid: ₹{(totalInterestPaidMap[profileCustomer.id] || 0).toLocaleString()}
                </CardContent>
              </Card>

              <div className="flex items-center gap-2">
                <Button onClick={() => navigate(`/loans?customer_id=${profileCustomer.id}`)}>Add Loan for this Customer</Button>
                <Button variant="outline" onClick={async () => {
                  await supabase.from('notifications').insert({ title: 'Payment reminder', body: `Reminder for ${profileCustomer.name}`, org_id: orgId })
                  toast({ title: 'Reminder scheduled (in-app)' })
                }}>Send Reminder</Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Loading profile…</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
