import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import type { Customer } from '@/data/types'
import { CustomerAvatar, StorageImage, useStorageUrl } from '@/components/StorageImage'
import { Phone, CreditCard, AlertTriangle, ExternalLink } from 'lucide-react'

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
    queryKey: ['customers', orgId],
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
    },
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
    },
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
    if (previewPhotoUrl && previewPhotoUrl.startsWith('blob:')) URL.revokeObjectURL(previewPhotoUrl)
    if (previewIdProofUrl && previewIdProofUrl.startsWith('blob:')) URL.revokeObjectURL(previewIdProofUrl)
    setForm({ name: '', phone: '', alt_phone: '', id_proof_number: '', notes: '', photoFile: null, idProofFile: null })
    setPreviewPhotoUrl(null); setPreviewIdProofUrl(null); setEditingId(null)
  }

  useEffect(() => { document.title = 'Customers | PawnTrack' }, [])

  // Create / Update mutations
  const saveCustomer = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('Organization not set')
      const { name, phone, alt_phone, id_proof_number, notes, photoFile, idProofFile } = form
      if (!validatePhone(phone)) throw new Error('Primary contact must be a valid 10-digit number')
      if (alt_phone && !validatePhone(alt_phone)) throw new Error('Alternate contact must be a valid 10-digit number')
      if (alt_phone && phone === alt_phone) throw new Error('Alternate contact cannot match primary contact')

      if (!editingId) {
        const customer = await provider.customers.create({
          name, phone, alt_phone: alt_phone || null, id_proof_number: id_proof_number || null,
          notes: notes || null, org_id: orgId, email: null, address: null,
          id_proof_url: null, profile_photo_url: null,
        })

        let profilePhotoUrl: string | null = null
        let idProofUrl: string | null = null

        if (photoFile) {
          try {
            profilePhotoUrl = await provider.storage.upload('customers', `${customer.id}/profile_photo.jpg`, photoFile, {
              upsert: true, contentType: photoFile.type || 'image/jpeg',
            })
          } catch (err: unknown) {
            console.error('Photo upload error:', err)
          }
        }
        if (idProofFile) {
          try {
            const ext = idProofFile.type === 'application/pdf' ? 'pdf' : 'jpg'
            idProofUrl = await provider.storage.upload('customers', `${customer.id}/id_proof.${ext}`, idProofFile, {
              upsert: true, contentType: idProofFile.type || 'image/jpeg',
            })
          } catch (err: unknown) {
            console.error('ID proof upload error:', err)
          }
        }

        if (profilePhotoUrl || idProofUrl) {
          await provider.customers.update(customer.id, {
            ...(profilePhotoUrl ? { profile_photo_url: profilePhotoUrl } : {}),
            ...(idProofUrl ? { id_proof_url: idProofUrl } : {}),
          })
        }
      } else {
        await provider.customers.update(editingId, {
          name, phone, alt_phone: alt_phone || null, id_proof_number: id_proof_number || null, notes: notes || null,
        })

        if (photoFile) {
          try {
            const photoUrl = await provider.storage.upload('customers', `${editingId}/profile_photo.jpg`, photoFile, {
              upsert: true, contentType: photoFile.type || 'image/jpeg',
            })
            await provider.customers.update(editingId, { profile_photo_url: photoUrl })
          } catch (err: unknown) {
            console.error('Photo upload error:', err)
          }
        }
        if (idProofFile) {
          try {
            const ext = idProofFile.type === 'application/pdf' ? 'pdf' : 'jpg'
            const idProofUrl = await provider.storage.upload('customers', `${editingId}/id_proof.${ext}`, idProofFile, {
              upsert: true, contentType: idProofFile.type || 'image/jpeg',
            })
            await provider.customers.update(editingId, { id_proof_url: idProofUrl })
          } catch (err: unknown) {
            console.error('ID proof upload error:', err)
          }
        }
      }
    },
    onSuccess: () => {
      toast({ title: editingId ? 'Customer updated' : 'Customer added' })
      setOpenForm(false)
      resetForm()
      qc.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message || 'Failed to save customer', variant: 'destructive' })
    },
  })

  const deleteCustomer = async (id: string) => {
    if (!confirm('Delete this customer and all linked records? This action cannot be undone.')) return
    try {
      await provider.customers.remove(id)
      toast({ title: 'Customer deleted' })
      qc.invalidateQueries({ queryKey: ['customers'] })
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['loans-detailed'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast({ title: 'Delete failed', description: msg, variant: 'destructive' })
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
  const openEdit = (c: Customer) => {
    setEditingId(c.id)
    setForm({
      name: c.name || '',
      phone: c.phone || '',
      alt_phone: c.alt_phone || '',
      id_proof_number: c.id_proof_number || '',
      notes: c.notes || '',
      photoFile: null,
      idProofFile: null,
    })
    setPreviewPhotoUrl(c.profile_photo_url || null)
    setPreviewIdProofUrl(c.id_proof_url || null)
    setOpenForm(true)
  }
  const openProfile = (c: Customer) => navigate(`/customers?profile=${c.id}${overdueParam ? '&overdue=true' : ''}`)

  const profileId = params.get('profile')
  const { data: profileLoans = [] } = useQuery({
    queryKey: ['customer-loans', profileId, orgId],
    enabled: !!profileId && !!orgId,
    queryFn: async () => {
      if (!orgId) return []
      const allLoans = await provider.loans.list(orgId)
      return allLoans.filter(l => l.customer_id === profileId)
    },
  })
  const profileCustomer = useMemo(() => customers.find(c => c.id === profileId), [customers, profileId])
  const { url: profileIdProofUrl } = useStorageUrl(profileCustomer?.id_proof_url, 'customers')

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={openCreate}>Add Customer</Button>
          <ExportButtons data={visibleCustomers as unknown as Record<string, unknown>[]} filename="customers" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search name / phone / ID proof"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-[260px]"
          />
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
          >
            <option value="recent">Most recent</option>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="borrowed-desc">Highest total borrowed</option>
            <option value="interest-desc">Highest interest paid</option>
          </select>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Customers ({visibleCustomers.length})
            {overdueParam && (
              <Badge variant="destructive" className="ml-2">
                Overdue Interest Filter Active
              </Badge>
            )}
          </CardTitle>
          {overdueParam && (
            <Button size="sm" variant="ghost" onClick={() => navigate('/customers')}>
              Clear Filter
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4 mb-4">
            <div className="col-span-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Input placeholder="Borrowed min (₹)" inputMode="numeric" value={borrowedMin} onChange={e => setBorrowedMin(e.target.value)} />
              <Input placeholder="Borrowed max (₹)" inputMode="numeric" value={borrowedMax} onChange={e => setBorrowedMax(e.target.value)} />
              <Input placeholder="Interest min (₹)" inputMode="numeric" value={interestMin} onChange={e => setInterestMin(e.target.value)} />
              <Input placeholder="Interest max (₹)" inputMode="numeric" value={interestMax} onChange={e => setInterestMax(e.target.value)} />
            </div>
          </div>

          <div className="space-y-3">
            {visibleCustomers.map(c => {
              const isDelinquent = overdueCustomerIds?.has(c.id)
              return (
                <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-4 hover:bg-accent/40 transition-colors">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <CustomerAvatar
                      photoPath={c.profile_photo_url}
                      name={c.name}
                      className="w-11 h-11 border shrink-0"
                      iconSize="w-5 h-5"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate text-base">{c.name}</span>
                        {isDelinquent && (
                          <Badge variant="destructive" className="text-xs flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Overdue
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {c.phone}{c.alt_phone ? ` · Alt: ${c.alt_phone}` : ''}
                        {c.id_proof_number ? ` · ID: ${c.id_proof_number}` : ''}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Total Borrowed: ₹{(totalBorrowedMap[c.id] || 0).toLocaleString('en-IN')} · Interest Paid: ₹{(totalInterestPaidMap[c.id] || 0).toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openProfile(c)}>Profile</Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(c)}>Edit</Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteCustomer(c.id)}>Delete</Button>
                  </div>
                </div>
              )
            })}
            {!customersLoading && visibleCustomers.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No customers found matching your criteria.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit Customer Modal */}
      <Dialog open={openForm} onOpenChange={(open) => { setOpenForm(open); if (!open) resetForm() }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Customer Details' : 'Add New Customer'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input placeholder="e.g. Rajesh Kumar" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Primary Phone (10 digits) *</Label>
              <Input inputMode="numeric" placeholder="9876543210" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value.replace(/[^0-9]/g, '').slice(0, 10) })} required />
            </div>
            <div className="space-y-2">
              <Label>Alternate Phone <span className="text-muted-foreground text-xs">(Optional)</span></Label>
              <Input inputMode="numeric" placeholder="10 digits" value={form.alt_phone} onChange={e => setForm({ ...form, alt_phone: e.target.value.replace(/[^0-9]/g, '').slice(0, 10) })} />
            </div>
            <div className="space-y-2">
              <Label>ID Proof Number <span className="text-muted-foreground text-xs">(Aadhaar/PAN)</span></Label>
              <Input placeholder="e.g. ABCDE1234F" value={form.id_proof_number} onChange={e => setForm({ ...form, id_proof_number: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Customer Photo (JPG/PNG)</Label>
              <Input ref={filePhotoRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => onPickPhoto(e.target.files?.[0])} />
              {previewPhotoUrl && (
                <div className="mt-2">
                  <img src={previewPhotoUrl} alt="Preview" className="h-20 w-20 rounded-md object-cover border" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>ID Proof Document (JPG/PNG/PDF)</Label>
              <Input ref={fileIdProofRef} type="file" accept="image/jpeg,image/png,application/pdf" onChange={e => onPickIdProof(e.target.files?.[0])} />
              {previewIdProofUrl && (
                <div className="text-xs text-muted-foreground mt-1 truncate">
                  Selected: {fileIdProofRef.current?.files?.[0]?.name || 'Document attached'}
                </div>
              )}
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Notes & Physical Address</Label>
              <Textarea rows={3} placeholder="Customer background, references, permanent address..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpenForm(false); resetForm() }}>Cancel</Button>
            <Button onClick={() => saveCustomer.mutate()} disabled={saveCustomer.isPending || !form.name.trim() || !form.phone}>
              {saveCustomer.isPending ? 'Saving...' : (editingId ? 'Update Customer' : 'Save Customer')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Customer Profile Modal */}
      <Dialog open={!!profileId} onOpenChange={(open) => { if (!open) { params.delete('profile'); navigate({ pathname: '/customers', search: params.toString() }) } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customer Profile & Loan Portfolio</DialogTitle>
          </DialogHeader>
          {profileCustomer ? (
            <div className="space-y-6">
              <div className="flex items-start gap-4 p-4 bg-muted/40 rounded-lg border">
                <StorageImage
                  bucket="customers"
                  path={profileCustomer.profile_photo_url}
                  alt={profileCustomer.name}
                  className="h-28 w-28 rounded-lg object-cover border shrink-0 bg-background"
                />
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="text-xl font-semibold">{profileCustomer.name}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Phone className="w-4 h-4" />
                    <span>Primary: {profileCustomer.phone}</span>
                    {profileCustomer.alt_phone && <span>· Alt: {profileCustomer.alt_phone}</span>}
                  </div>
                  {profileCustomer.address && (
                    <div className="text-sm text-muted-foreground">{profileCustomer.address}</div>
                  )}
                  {profileCustomer.id_proof_number && (
                    <div className="text-sm flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-muted-foreground" />
                      <span>ID: {profileCustomer.id_proof_number}</span>
                    </div>
                  )}
                  {profileCustomer.id_proof_url && profileIdProofUrl && (
                    <a
                      href={profileIdProofUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline font-medium mt-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> View Pledged ID Document
                    </a>
                  )}
                  {profileCustomer.notes && (
                    <div className="text-xs text-muted-foreground bg-background p-2 rounded border mt-2">
                      {profileCustomer.notes}
                    </div>
                  )}
                </div>
              </div>

              {/* Loan History Categorized */}
              <div className="grid gap-4 md:grid-cols-3">
                {/* Active Loans */}
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center justify-between">
                      Active Loans
                      <Badge variant="default" className="text-xs">
                        {profileLoans.filter(l => l.status === 'active').length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-2">
                    {profileLoans.filter(l => l.status === 'active').map(l => (
                      <div key={l.id} className="flex items-center justify-between rounded border p-2 text-xs">
                        <div>
                          <div className="font-semibold capitalize">{l.asset_type || 'Asset'}</div>
                          <div className="text-muted-foreground">₹{Number(l.loan_amount).toLocaleString('en-IN')}</div>
                        </div>
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => navigate(`/loans?loan=${l.id}`)}>
                          View
                        </Button>
                      </div>
                    ))}
                    {profileLoans.filter(l => l.status === 'active').length === 0 && (
                      <div className="text-xs text-muted-foreground py-2">No active loans.</div>
                    )}
                  </CardContent>
                </Card>

                {/* Overdue Loans */}
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-semibold text-destructive flex items-center justify-between">
                      Overdue Loans
                      <Badge variant="destructive" className="text-xs">
                        {profileLoans.filter(l => l.status === 'overdue').length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-2">
                    {profileLoans.filter(l => l.status === 'overdue').map(l => (
                      <div key={l.id} className="flex items-center justify-between rounded border border-destructive/40 bg-destructive/5 p-2 text-xs">
                        <div>
                          <div className="font-semibold capitalize text-destructive">{l.asset_type || 'Asset'}</div>
                          <div className="text-muted-foreground">₹{Number(l.loan_amount).toLocaleString('en-IN')}</div>
                        </div>
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => navigate(`/loans?loan=${l.id}`)}>
                          View
                        </Button>
                      </div>
                    ))}
                    {profileLoans.filter(l => l.status === 'overdue').length === 0 && (
                      <div className="text-xs text-muted-foreground py-2">No overdue loans.</div>
                    )}
                  </CardContent>
                </Card>

                {/* Closed Loans */}
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center justify-between">
                      Closed Loans
                      <Badge variant="secondary" className="text-xs">
                        {profileLoans.filter(l => l.status === 'closed').length}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 space-y-2">
                    {profileLoans.filter(l => l.status === 'closed').map(l => (
                      <div key={l.id} className="flex items-center justify-between rounded border p-2 text-xs">
                        <div>
                          <div className="font-semibold capitalize text-muted-foreground">{l.asset_type || 'Asset'}</div>
                          <div className="text-muted-foreground">₹{Number(l.loan_amount).toLocaleString('en-IN')}</div>
                        </div>
                        <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => navigate(`/loans?loan=${l.id}`)}>
                          View
                        </Button>
                      </div>
                    ))}
                    {profileLoans.filter(l => l.status === 'closed').length === 0 && (
                      <div className="text-xs text-muted-foreground py-2">No closed loans.</div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Financial Aggregate */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30 border">
                <div>
                  <div className="text-xs text-muted-foreground">Lifetime Total Borrowed</div>
                  <div className="text-lg font-bold text-primary">₹{(totalBorrowedMap[profileCustomer.id] || 0).toLocaleString('en-IN')}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Lifetime Interest Paid</div>
                  <div className="text-lg font-bold text-emerald-600">₹{(totalInterestPaidMap[profileCustomer.id] || 0).toLocaleString('en-IN')}</div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button onClick={() => navigate(`/loans?customer_id=${profileCustomer.id}`)}>
                  Originate New Loan for this Customer
                </Button>
                <Button variant="outline" onClick={async () => {
                  if (!orgId) return
                  await provider.notifications.create({
                    title: `Delinquency Notice: ${profileCustomer.name}`,
                    body: `Statement and payment notice generated for ${profileCustomer.name} (${profileCustomer.phone})`,
                    org_id: orgId,
                    loan_id: null,
                    sent_at: new Date().toISOString(),
                    read: false,
                  })
                  toast({ title: 'Reminder scheduled', description: `Reminder recorded for ${profileCustomer.name}` })
                }}>
                  Send Payment Reminder
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground py-6 text-center">Loading customer record...</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
