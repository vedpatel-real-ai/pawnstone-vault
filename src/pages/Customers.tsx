import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/useAuth'
import { ExportButtons } from '@/components/ExportButtons'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { getProvider } from '@/data'

const TEN_DIGITS = /^\d{10}$/
function validatePhone(num: string) { return TEN_DIGITS.test(num.trim()) }

export default function Customers() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { orgId } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const provider = getProvider()
  const params = new URLSearchParams(location.search)
  const overdueParam = params.get('overdue') === 'true'

  // Base customers
  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => orgId ? provider.customers.list(orgId) : [],
    enabled: !!orgId,
  })

  // Overdue customer IDs
  const { data: overdueCustomerIds } = useQuery({
    queryKey: ['overdue-customer-ids', orgId],
    queryFn: async () => {
      if (!orgId) return new Set<string>()
      const allDues = await provider.dues.list(orgId)
      const overdueDues = allDues.filter(d => d.status === 'overdue' && d.due_type === 'interest')
      const loanIds = Array.from(new Set(overdueDues.map(d => d.loan_id).filter(Boolean)))
      if (loanIds.length === 0) return new Set<string>()
      const loans = await provider.loans.list(orgId)
      const matching = loans.filter(l => loanIds.includes(l.id))
      return new Set<string>(matching.map(l => l.customer_id))
    },
    enabled: !!orgId,
  })

  // Aggregations
  const { data: totalBorrowedMap = {} } = useQuery({
    queryKey: ['customers-total-borrowed', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      if (!orgId) return {}
      const loans = await provider.loans.list(orgId)
      const map: Record<string, number> = {}
      for (const l of loans) {
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
      if (!orgId) return {}
      const payments = await provider.payments.list(orgId)
      const loans = await provider.loans.list(orgId)
      const loanToCustomer = new Map(loans.map(l => [l.id, l.customer_id]))
      const map: Record<string, number> = {}
      for (const p of payments) {
        if (p.type !== 'interest') continue
        const cid = loanToCustomer.get(p.loan_id)
        if (!cid) continue
        map[cid] = (map[cid] || 0) + Number(p.amount || 0)
      }
      return map
    }
  })

  // Form state
  type FormState = {
    name: string; phone: string; alt_phone: string; id_proof_number: string; notes: string
    photoFile?: File | null; idProofFile?: File | null
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
    setPreviewPhotoUrl(null); setPreviewIdProofUrl(null); setEditingId(null)
  }

  useEffect(() => { document.title = 'Customers | PawnTrack' }, [])

  // Create / Update mutations
  const saveCustomer = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('Organization not set')
      const { name, phone, alt_phone, id_proof_number, notes, photoFile, idProofFile } = form
      if (!validatePhone(phone)) throw new Error('Primary contact must be 10 digits')
      if (alt_phone && !validatePhone(alt_phone)) throw new Error('Alternate contact must be 10 digits')
      if (alt_phone && phone === alt_phone) throw new Error('Alternate cannot match primary')

      if (!editingId) {
        const customer = await provider.customers.create({ name, phone, alt_phone, id_proof_number, notes, org_id: orgId, email: null, address: null, id_proof_url: null, profile_photo_url: null })
        // Upload media in demo and supabase modes
        if (photoFile) {
          try {
            const url = await provider.storage.upload('customers', `${customer.id}/profile_photo.jpg`, photoFile, { upsert: true, contentType: 'image/jpeg' })
            await provider.customers.update(customer.id, { profile_photo_url: url })
          } catch (err: any) {
            toast({ title: 'Upload error', description: err.message })
          }
        }
        if (idProofFile) {
          try {
            const ext = idProofFile.type === 'application/pdf' ? 'pdf' : 'jpg'
            const url = await provider.storage.upload('customers', `${customer.id}/id_proof.${ext}`, idProofFile, { upsert: true, contentType: idProofFile.type })
            await provider.customers.update(customer.id, { id_proof_url: url })
          } catch (err: any) {
            toast({ title: 'Upload error', description: err.message })
          }
        }
      } else {
        await provider.customers.update(editingId, { name, phone, alt_phone, id_proof_number, notes })
        if (photoFile) {
          try {
            const url = await provider.storage.upload('customers', `${editingId}/profile_photo.jpg`, photoFile, { upsert: true, contentType: 'image/jpeg' })
            await provider.customers.update(editingId, { profile_photo_url: url })
          } catch (err: any) {
            toast({ title: 'Upload error', description: err.message })
          }
        }
        if (idProofFile) {
          try {
            const ext = idProofFile.type === 'application/pdf' ? 'pdf' : 'jpg'
            const url = await provider.storage.upload('customers', `${editingId}/id_proof.${ext}`, idProofFile, { upsert: true, contentType: idProofFile.type })
            await provider.customers.update(editingId, { id_proof_url: url })
          } catch (err: any) {
            toast({ title: 'Upload error', description: err.message })
          }
        }
      }
    },
    onSuccess: () => {
      toast({ title: editingId ? 'Customer updated' : 'Customer added' })
      setOpenForm(false); resetForm()
      qc.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message || 'Failed to save', variant: 'destructive' })
    },
  })

  const deleteCustomer = async (id: string) => {
    if (!confirm('Delete this customer?')) return
    try {
      await provider.customers.remove(id)
      toast({ title: 'Customer deleted' })
      qc.invalidateQueries({ queryKey: ['customers'] })
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message })
    }
  }

  // Search / filter / sort
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'name-asc' | 'name-desc' | 'borrowed-desc' | 'interest-desc'>('recent')
  const [borrowedMin, setBorrowedMin] = useState('')
  const [borrowedMax, setBorrowedMax] = useState('')
  const [interestMin, setInterestMin] = useState('')
  const [interestMax, setInterestMax] = useState('')

  const visibleCustomers = useMemo(() => {
    let list = [...customers]
    if (overdueParam) {
      const set = overdueCustomerIds || new Set<string>()
      list = list.filter(c => set.has(c.id))
    }
    const q = search.trim().toLowerCase()
    if (q) {
      list = list.filter(c =>
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
    list = list.filter(c => {
      const tb = totalBorrowedMap[c.id] || 0
      const ti = totalInterestPaidMap[c.id] || 0
      return tb >= bMin && tb <= bMax && ti >= iMin && ti <= iMax
    })
    list.sort((a, b) => {
      if (sortBy === 'recent') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sortBy === 'name-asc') return (a.name || '').localeCompare(b.name || '')
      if (sortBy === 'name-desc') return (b.name || '').localeCompare(a.name || '')
      if (sortBy === 'borrowed-desc') return (totalBorrowedMap[b.id] || 0) - (totalBorrowedMap[a.id] || 0)
      if (sortBy === 'interest-desc') return (totalInterestPaidMap[b.id] || 0) - (totalInterestPaidMap[a.id] || 0)
      return 0
    })
    return list
  }, [customers, overdueParam, overdueCustomerIds, search, sortBy, borrowedMin, borrowedMax, interestMin, interestMax, totalBorrowedMap, totalInterestPaidMap])

  const onPickPhoto = (f?: File | null) => { if (!f) return; setForm(prev => ({ ...prev, photoFile: f })); setPreviewPhotoUrl(URL.createObjectURL(f)) }
  const onPickIdProof = (f?: File | null) => { if (!f) return; setForm(prev => ({ ...prev, idProofFile: f })); setPreviewIdProofUrl(URL.createObjectURL(f)) }
  const openCreate = () => { resetForm(); setOpenForm(true) }
  const openEdit = (c: any) => { setEditingId(c.id); setForm({ name: c.name || '', phone: c.phone || '', alt_phone: c.alt_phone || '', id_proof_number: c.id_proof_number || '', notes: c.notes || '', photoFile: null, idProofFile: null }); setPreviewPhotoUrl(null); setPreviewIdProofUrl(null); setOpenForm(true) }
  const openProfile = (c: any) => navigate(`/customers?profile=${c.id}${overdueParam ? '&overdue=true' : ''}`)

  const profileId = params.get('profile')
  const { data: profileLoans = [] } = useQuery({
    queryKey: ['customer-loans', profileId],
    enabled: !!profileId && !!orgId,
    queryFn: async () => {
      if (!orgId) return []
      const allLoans = await provider.loans.list(orgId)
      return allLoans.filter(l => l.customer_id === profileId)
    }
  })
  const profileCustomer = useMemo(() => customers.find(c => c.id === profileId), [customers, profileId])

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
            {visibleCustomers.map(c => (
              <div key={c.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="flex items-center gap-3">
                  <img src={c.profile_photo_url || '/placeholder.svg'} alt={`${c.name || 'Customer'} photo`} width={30} height={30} loading="lazy" className="h-[30px] w-[30px] rounded-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg' }} />
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
            {(!customersLoading && visibleCustomers.length === 0) && (
              <div className="text-sm text-muted-foreground">No customers found.</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit Modal */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingId ? 'Edit Customer' : 'Add Customer'}</DialogTitle></DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label>Full Name*</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Primary Contact Number*</Label><Input inputMode="numeric" placeholder="10 digits" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/[^0-9]/g, '') })} required /></div>
            <div className="space-y-2"><Label>Alternate Contact Number <span className="text-muted-foreground text-xs">(Optional)</span></Label><Input inputMode="numeric" placeholder="10 digits" value={form.alt_phone} onChange={e => setForm({ ...form, alt_phone: e.target.value.replace(/[^0-9]/g, '') })} /></div>
            <div className="space-y-2"><Label>ID Proof (Text)</Label><Input placeholder="e.g., Aadhaar number" value={form.id_proof_number} onChange={e => setForm({ ...form, id_proof_number: e.target.value })} /></div>
            <div className="space-y-2"><Label>Customer Photo (JPG/PNG, max 2MB)</Label><Input ref={filePhotoRef} type="file" accept="image/jpeg,image/png" onChange={e => onPickPhoto(e.target.files?.[0])} />{previewPhotoUrl && <img src={previewPhotoUrl} alt="Preview" className="h-24 w-24 rounded-md object-cover" />}</div>
            <div className="space-y-2"><Label>ID Proof File (JPG/PNG ≤2MB or PDF ≤5MB)</Label><Input ref={fileIdProofRef} type="file" accept="image/jpeg,image/png,application/pdf" onChange={e => onPickIdProof(e.target.files?.[0])} />{previewIdProofUrl && <div className="text-xs text-muted-foreground truncate">Selected: {fileIdProofRef.current?.files?.[0]?.name}</div>}</div>
            <div className="md:col-span-2 space-y-2"><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenForm(false)}>Cancel</Button>
            <Button onClick={() => saveCustomer.mutate()} disabled={saveCustomer.isPending}>
              {saveCustomer.isPending ? 'Saving...' : (editingId ? 'Update' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile Modal */}
      <Dialog open={!!profileId} onOpenChange={(o) => { if (!o) { params.delete('profile'); navigate({ pathname: '/customers', search: params.toString() }) } }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Customer Profile</DialogTitle></DialogHeader>
          {profileCustomer ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <img src={profileCustomer.profile_photo_url || '/placeholder.svg'} alt={`${profileCustomer.name} photo`} className="h-36 w-36 rounded-md object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.svg' }} />
                <div className="space-y-1">
                  <div className="text-lg font-semibold">{profileCustomer.name}</div>
                  <div className="text-sm text-muted-foreground">Primary: {profileCustomer.phone}</div>
                  {profileCustomer.alt_phone && <div className="text-sm text-muted-foreground">Alternate: {profileCustomer.alt_phone}</div>}
                  {profileCustomer.id_proof_number && <div className="text-sm">ID: {profileCustomer.id_proof_number}</div>}
                  {profileCustomer.id_proof_url && <a href={profileCustomer.id_proof_url} target="_blank" rel="noreferrer" className="text-sm underline">View ID Proof</a>}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle className="text-base">Active Loans</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {profileLoans.filter(l => l.status === 'active').map(l => (
                      <div key={l.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                        <div>#{l.id.slice(0, 8)} · ₹{Number(l.loan_amount).toLocaleString()}</div>
                        <Button variant="outline" onClick={() => navigate(`/loans?loan_id=${l.id}`)}>Open</Button>
                      </div>
                    ))}
                    {profileLoans.filter(l => l.status === 'active').length === 0 && <div className="text-sm text-muted-foreground">No active loans.</div>}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">Closed Loans</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {profileLoans.filter(l => l.status === 'closed').map(l => (
                      <div key={l.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                        <div>#{l.id.slice(0, 8)} · ₹{Number(l.loan_amount).toLocaleString()}</div>
                        <Button variant="outline" onClick={() => navigate(`/loans?loan_id=${l.id}`)}>Open</Button>
                      </div>
                    ))}
                    {profileLoans.filter(l => l.status === 'closed').length === 0 && <div className="text-sm text-muted-foreground">No closed loans.</div>}
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
                  if (!orgId) return
                  await provider.notifications.create({ title: 'Payment reminder', body: `Reminder for ${profileCustomer.name}`, org_id: orgId, loan_id: null, sent_at: new Date().toISOString(), read: false })
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
