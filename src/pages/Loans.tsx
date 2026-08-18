import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/useAuth'
import { format, addMonths, isAfter, parseISO } from 'date-fns'
import { ExportButtons } from '@/components/ExportButtons'
import { CustomerPickerModal } from '@/components/CustomerPickerModal'
import { AssetImageUpload, AssetUploadItem } from '@/components/AssetImageUpload'
import { CustomerAvatar, StorageImage } from '@/components/StorageImage'
import { Search, Plus, Eye, Edit, Trash2, DollarSign, X, Phone, AlertTriangle, Calendar, CreditCard, FileImage, ShieldCheck, CheckCircle } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { getProvider } from '@/data'
import { formatINR } from '@/lib/dashboardCalculations'

interface CustomerDisplay {
  id: string
  name: string
  primary_contact: string
  alt_contact?: string
  id_proof_number?: string
  profile_photo_url?: string
  loan_count?: number
}

interface LoanDisplay {
  id: string
  customer_id: string
  customer?: CustomerDisplay
  asset_type: string
  asset_description: string
  asset_value: number
  loan_amount: number
  remaining_principal: number
  interest_rate_percent: number
  start_date: string
  due_date: string
  next_due_date: string
  term_months: number
  status: 'active' | 'overdue' | 'closed' | 'defaulted'
  notes?: string
  created_at: string
  assets?: AssetUploadItem[]
}

export default function Loans() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { orgId } = useAuth()
  const location = useLocation()
  const provider = getProvider()
  const params = new URLSearchParams(location.search)
  const statusFilter = params.get('status')
  const loanParam = params.get('loan') || params.get('loan_id')
  const customerParam = params.get('customer_id')

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    status: statusFilter || 'all',
    type: 'all',
    amountMin: '',
    amountMax: '',
    dueDateFrom: '',
    dueDateTo: '',
  })
  const [sort, setSort] = useState('created_at_desc')
  const [showForm, setShowForm] = useState(false)
  const [editingLoan, setEditingLoan] = useState<LoanDisplay | null>(null)
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [showLoanDetails, setShowLoanDetails] = useState<LoanDisplay | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDisplay | null>(null)
  const [assetImages, setAssetImages] = useState<AssetUploadItem[]>([])
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmClose, setConfirmClose] = useState<LoanDisplay | null>(null)
  const [paymentModal, setPaymentModal] = useState<{
    loan: LoanDisplay
    amount: string
    type: 'interest' | 'principal'
    notes: string
  } | null>(null)

  const [form, setForm] = useState({
    loan_amount: '',
    asset_type: 'gold',
    asset_description: '',
    asset_value: '',
    interest_rate_percent: '2.0',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    due_date: format(addMonths(new Date(), 12), 'yyyy-MM-dd'),
    term_months: '12',
    notes: '',
  })

  // Queries
  const { data: customers } = useQuery({
    queryKey: ['customers-with-loans', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const allCustomers = await provider.customers.list(orgId)
      const allLoans = await provider.loans.list(orgId)
      const activeLoansByCustomer: Record<string, number> = {}
      allLoans
        .filter(l => l.status === 'active' || l.status === 'overdue')
        .forEach(l => {
          activeLoansByCustomer[l.customer_id] = (activeLoansByCustomer[l.customer_id] || 0) + 1
        })

      return allCustomers.map(c => ({
        id: c.id,
        name: c.name,
        primary_contact: c.phone || '',
        alt_contact: c.alt_phone || undefined,
        id_proof_number: c.id_proof_number || undefined,
        profile_photo_url: c.profile_photo_url || undefined,
        loan_count: activeLoansByCustomer[c.id] || 0,
      }))
    },
    enabled: !!orgId,
  })

  // If customer_id was passed in URL query param, automatically select customer and open new loan modal
  useEffect(() => {
    if (customerParam && customers && customers.length > 0) {
      const match = customers.find(c => c.id === customerParam)
      if (match) {
        setSelectedCustomer(match)
        setShowForm(true)
      }
    }
  }, [customerParam, customers])

  const { data: loans } = useQuery({
    queryKey: ['loans-detailed', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const allLoans = await provider.loans.list(orgId)
      const allCustomers = await provider.customers.list(orgId)
      const customerMap = new Map(
        allCustomers.map(c => [
          c.id,
          {
            id: c.id,
            name: c.name,
            primary_contact: c.phone || '',
            profile_photo_url: c.profile_photo_url || undefined,
          },
        ])
      )

      const result: LoanDisplay[] = await Promise.all(
        allLoans.map(async l => {
          const assets = await provider.loanAssets.list(l.id)
          return {
            id: l.id,
            customer_id: l.customer_id,
            customer: customerMap.get(l.customer_id) || undefined,
            asset_type: l.asset_type || 'other',
            asset_description: l.asset_description || '',
            asset_value: Number(l.asset_value || 0),
            loan_amount: Number(l.loan_amount),
            remaining_principal: Number(l.remaining_principal),
            interest_rate_percent: Number(l.interest_rate_percent),
            start_date: l.start_date,
            due_date: l.due_date || l.next_due_date,
            next_due_date: l.next_due_date,
            term_months: Number(l.term_months || 12),
            status: l.status as LoanDisplay['status'],
            notes: l.notes || undefined,
            created_at: l.created_at,
            assets: assets.map(a => ({ id: a.id, url: a.file_url, name: a.file_name })),
          }
        })
      )
      return result
    },
    enabled: !!orgId,
  })

  // Auto-open specific loan if requested via URL param
  useEffect(() => {
    if (loanParam && loans && loans.length > 0) {
      const match = loans.find(l => l.id === loanParam)
      if (match) {
        setShowLoanDetails(match)
      }
    }
  }, [loanParam, loans])

  // Filter and sort
  const filteredLoans = useMemo(() => {
    let result = loans || []
    if (loanParam) {
      const single = result.filter(l => l.id === loanParam)
      if (single.length > 0) return single
    }
    if (search) {
      const s = search.toLowerCase()
      result = result.filter(
        l =>
          l.id.toLowerCase().includes(s) ||
          l.customer?.name.toLowerCase().includes(s) ||
          l.asset_type.toLowerCase().includes(s) ||
          l.asset_description.toLowerCase().includes(s)
      )
    }
    if (filters.status && filters.status !== 'all') {
      result = result.filter(l => l.status === filters.status)
    }
    if (filters.type && filters.type !== 'all') {
      result = result.filter(l => (l.asset_type || '').toLowerCase().includes(filters.type.toLowerCase()))
    }
    if (filters.amountMin) result = result.filter(l => l.loan_amount >= Number(filters.amountMin))
    if (filters.amountMax) result = result.filter(l => l.loan_amount <= Number(filters.amountMax))
    if (filters.dueDateFrom) result = result.filter(l => l.due_date >= filters.dueDateFrom)
    if (filters.dueDateTo) result = result.filter(l => l.due_date <= filters.dueDateTo)

    switch (sort) {
      case 'amount_desc':
        result.sort((a, b) => b.loan_amount - a.loan_amount)
        break
      case 'amount_asc':
        result.sort((a, b) => a.loan_amount - b.loan_amount)
        break
      case 'due_date_asc':
        result.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
        break
      case 'due_date_desc':
        result.sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime())
        break
      default:
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    }
    return result
  }, [loans, search, filters, sort, loanParam])

  const canSave = useMemo(
    () => selectedCustomer && Number(form.loan_amount) > 0 && form.asset_description.trim().length > 0,
    [selectedCustomer, form]
  )

  useEffect(() => {
    document.title = 'Loans Portfolio | PawnTrack'
  }, [])

  const resetForm = () => {
    setForm({
      loan_amount: '',
      asset_type: 'gold',
      asset_description: '',
      asset_value: '',
      interest_rate_percent: '2.0',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      due_date: format(addMonths(new Date(), 12), 'yyyy-MM-dd'),
      term_months: '12',
      notes: '',
    })
    setSelectedCustomer(null)
    setAssetImages([])
    setEditingLoan(null)
  }

  const saveLoan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId || !selectedCustomer) {
      toast({ title: 'Missing data', description: 'Please select a customer and provide loan details.' })
      return
    }

    try {
      if (editingLoan) {
        // Update existing loan
        await provider.loans.update(editingLoan.id, {
          asset_type: form.asset_type,
          asset_description: form.asset_description,
          asset_value: Number(form.asset_value || 0),
          loan_amount: Number(form.loan_amount),
          interest_rate_percent: Number(form.interest_rate_percent),
          start_date: form.start_date,
          due_date: form.due_date,
          term_months: Number(form.term_months),
          notes: form.notes || null,
        })

        // Process any staged new images for this existing loan
        for (const item of assetImages) {
          if (item.file && item.id.startsWith('staged-')) {
            const fileExt = item.file.name.split('.').pop() || 'jpg'
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
            const filePath = `${editingLoan.id}/${fileName}`

            const storageKey = await provider.storage.upload('loan_assets', filePath, item.file, {
              upsert: true,
              contentType: item.file.type || 'image/jpeg',
            })

            await provider.loanAssets.add({
              loan_id: editingLoan.id,
              file_url: storageKey,
              file_name: item.name,
              file_size: item.file.size,
              org_id: orgId,
            })
          }
        }

        toast({ title: 'Loan updated successfully' })
      } else {
        // Create new loan first to obtain the authentic loan ID
        const createdLoan = await provider.loans.create({
          org_id: orgId,
          customer_id: selectedCustomer.id,
          asset_type: form.asset_type,
          asset_description: form.asset_description,
          asset_value: Number(form.asset_value || 0),
          loan_amount: Number(form.loan_amount),
          remaining_principal: Number(form.loan_amount),
          interest_rate_percent: Number(form.interest_rate_percent),
          start_date: form.start_date,
          due_date: form.due_date,
          next_due_date: format(addMonths(parseISO(form.start_date), 1), 'yyyy-MM-dd'),
          term_months: Number(form.term_months),
          status: 'active',
          notes: form.notes || null,
          last_interest_calculated: null,
        })

        // Now upload staged collateral images under the genuine loan.id without violating RLS
        for (const item of assetImages) {
          if (item.file) {
            const fileExt = item.file.name.split('.').pop() || 'jpg'
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
            const filePath = `${createdLoan.id}/${fileName}`

            const storageKey = await provider.storage.upload('loan_assets', filePath, item.file, {
              upsert: true,
              contentType: item.file.type || 'image/jpeg',
            })

            await provider.loanAssets.add({
              loan_id: createdLoan.id,
              file_url: storageKey,
              file_name: item.name,
              file_size: item.file.size,
              org_id: orgId,
            })
          }
        }

        // Generate the initial monthly interest due
        const initialDueAmount = (Number(form.loan_amount) * Number(form.interest_rate_percent)) / 100
        await provider.dues.create({
          org_id: orgId,
          loan_id: createdLoan.id,
          due_date: format(addMonths(parseISO(form.start_date), 1), 'yyyy-MM-dd'),
          amount: Math.round(initialDueAmount * 100) / 100,
          due_type: 'interest',
          status: 'pending',
        })

        toast({ title: 'Loan created successfully', description: `Loan #${createdLoan.id.slice(0, 8)} active in vault.` })
      }

      resetForm()
      setShowForm(false)
      qc.invalidateQueries({ queryKey: ['loans-detailed'] })
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['assets'] })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred'
      toast({ title: 'Save failed', description: msg, variant: 'destructive' })
    }
  }

  const editLoan = (loan: LoanDisplay) => {
    setEditingLoan(loan)
    setSelectedCustomer(loan.customer || null)
    setAssetImages(loan.assets || [])
    setForm({
      loan_amount: loan.loan_amount.toString(),
      asset_type: loan.asset_type,
      asset_description: loan.asset_description,
      asset_value: loan.asset_value?.toString() || '',
      interest_rate_percent: loan.interest_rate_percent.toString(),
      start_date: loan.start_date,
      due_date: loan.due_date,
      term_months: loan.term_months?.toString() || '12',
      notes: loan.notes || '',
    })
    setShowForm(true)
  }

  const deleteLoan = async (loanId: string) => {
    try {
      await provider.loans.remove(loanId)
      toast({ title: 'Loan deleted' })
      qc.invalidateQueries({ queryKey: ['loans-detailed'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['assets'] })
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' })
    }
    setConfirmDelete(null)
  }

  const closeLoan = async (loan: LoanDisplay) => {
    try {
      await provider.loans.update(loan.id, { status: 'closed', remaining_principal: 0 })
      toast({ title: 'Loan closed', description: 'Remaining principal set to zero. Collateral ready for release.' })
      qc.invalidateQueries({ queryKey: ['loans-detailed'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['assets'] })
    } catch {
      toast({ title: 'Failed to close loan', variant: 'destructive' })
    }
    setConfirmClose(null)
  }

  const recordPayment = async () => {
    if (!paymentModal || !orgId || Number(paymentModal.amount) <= 0) return
    try {
      await provider.payments.create({
        loan_id: paymentModal.loan.id,
        amount: Number(paymentModal.amount),
        type: paymentModal.type,
        payment_date: format(new Date(), 'yyyy-MM-dd'),
        notes: paymentModal.notes || (paymentModal.type === 'interest' ? 'Monthly interest collection' : 'Principal paydown'),
        org_id: orgId,
      })

      toast({
        title: 'Payment recorded',
        description: `${paymentModal.type === 'interest' ? 'Interest' : 'Principal'} payment of ${formatINR(Number(paymentModal.amount))} logged.`,
      })
      qc.invalidateQueries({ queryKey: ['loans-detailed'] })
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
    } catch {
      toast({ title: 'Failed to record payment', variant: 'destructive' })
    }
    setPaymentModal(null)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-600 hover:bg-emerald-700">Active</Badge>
      case 'overdue':
        return <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Overdue</Badge>
      case 'closed':
        return <Badge variant="secondary">Closed</Badge>
      case 'defaulted':
        return <Badge variant="outline" className="text-amber-600 border-amber-600">Defaulted</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Loans Portfolio</h1>
          <p className="text-sm text-muted-foreground">Manage active collateral pledges, valuations, and payment schedules.</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true) }}>
          <Plus className="w-4 h-4 mr-2" /> Originate Loan
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search borrower or collateral..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
              <SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="defaulted">Defaulted</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.type} onValueChange={(v) => setFilters({ ...filters, type: v })}>
              <SelectTrigger><SelectValue placeholder="All Collateral Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="gold">Gold & Jewellery</SelectItem>
                <SelectItem value="car">Vehicles</SelectItem>
                <SelectItem value="property">Property Documents</SelectItem>
                <SelectItem value="other">Other Assets</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger><SelectValue placeholder="Sort by" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at_desc">Newest First</SelectItem>
                <SelectItem value="created_at_asc">Oldest First</SelectItem>
                <SelectItem value="amount_desc">Highest Principal</SelectItem>
                <SelectItem value="amount_asc">Lowest Principal</SelectItem>
                <SelectItem value="due_date_asc">Maturity: Soonest</SelectItem>
                <SelectItem value="due_date_desc">Maturity: Latest</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
            <Input type="number" placeholder="Min amount (₹)" value={filters.amountMin} onChange={(e) => setFilters({ ...filters, amountMin: e.target.value })} />
            <Input type="number" placeholder="Max amount (₹)" value={filters.amountMax} onChange={(e) => setFilters({ ...filters, amountMax: e.target.value })} />
            <Input type="date" placeholder="Due from" value={filters.dueDateFrom} onChange={(e) => setFilters({ ...filters, dueDateFrom: e.target.value })} />
            <Input type="date" placeholder="Due to" value={filters.dueDateTo} onChange={(e) => setFilters({ ...filters, dueDateTo: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      {/* Loans List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Loans ({filteredLoans.length})</CardTitle>
          <ExportButtons data={filteredLoans || []} filename="pawn-loans-portfolio" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredLoans.map((loan) => (
              <div
                key={loan.id}
                className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 border rounded-lg hover:bg-accent/40 transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <CustomerAvatar
                    photoPath={loan.customer?.profile_photo_url}
                    name={loan.customer?.name}
                    className="w-12 h-12 border shrink-0"
                    iconSize="w-6 h-6"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-base truncate">{loan.customer?.name || 'Customer'}</span>
                      <span className="text-xs text-muted-foreground font-mono">#{loan.id.slice(0, 8)}</span>
                      {getStatusBadge(loan.status)}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1 font-medium text-foreground">
                        <DollarSign className="w-3.5 h-3.5 text-primary" />
                        Principal: {formatINR(loan.remaining_principal)}
                      </div>
                      <div className="flex items-center gap-1">
                        <CreditCard className="w-3.5 h-3.5" />
                        <span className="capitalize">{loan.asset_type}</span> ({formatINR(loan.asset_value)})
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Due: {format(parseISO(loan.due_date), 'MMM dd, yyyy')}
                      </div>
                      <div className="flex items-center gap-1">
                        <FileImage className="w-3.5 h-3.5" />
                        {loan.assets?.length || 0} collateral photo(s)
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 truncate max-w-xl">
                      {loan.asset_description}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center shrink-0 flex-wrap">
                  {/* Record Payment enabled for active AND overdue loans */}
                  {(loan.status === 'active' || loan.status === 'overdue') && (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() =>
                        setPaymentModal({
                          loan,
                          amount: String((loan.remaining_principal * loan.interest_rate_percent) / 100),
                          type: 'interest',
                          notes: '',
                        })
                      }
                    >
                      Record Payment
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setShowLoanDetails(loan)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => editLoan(loan)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  {(loan.status === 'active' || loan.status === 'overdue') && (
                    <Button size="sm" variant="outline" onClick={() => setConfirmClose(loan)}>
                      Close
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(loan.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}

            {filteredLoans.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                No loans found matching your criteria.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loan Form Modal */}
      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLoan ? 'Edit Loan Terms' : 'Originate New Loan'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveLoan} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Borrower *</label>
              {selectedCustomer ? (
                <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
                  <CustomerAvatar
                    photoPath={selectedCustomer.profile_photo_url}
                    name={selectedCustomer.name}
                    className="w-10 h-10 border"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{selectedCustomer.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {selectedCustomer.primary_contact}
                      {selectedCustomer.id_proof_number && ` · ID: ${selectedCustomer.id_proof_number}`}
                    </div>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowCustomerPicker(true)}>
                    Change
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setSelectedCustomer(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="outline" className="w-full justify-start text-muted-foreground" onClick={() => setShowCustomerPicker(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Select Borrower from CRM
                </Button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Principal Amount (₹) *</label>
                <Input
                  type="number"
                  placeholder="250000"
                  value={form.loan_amount}
                  onChange={(e) => setForm({ ...form, loan_amount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Interest Rate (% per month) *</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="2.0"
                  value={form.interest_rate_percent}
                  onChange={(e) => setForm({ ...form, interest_rate_percent: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Collateral Type *</label>
                <Select value={form.asset_type} onValueChange={(v) => setForm({ ...form, asset_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gold">Gold & Jewellery</SelectItem>
                    <SelectItem value="car">Vehicle / Automobile</SelectItem>
                    <SelectItem value="property">Property Documents</SelectItem>
                    <SelectItem value="other">Other Luxury Asset</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Appraised Asset Value (₹)</label>
                <Input
                  type="number"
                  placeholder="375000"
                  value={form.asset_value}
                  onChange={(e) => setForm({ ...form, asset_value: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Origination Date *</label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Maturity / Due Date *</label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Asset & Weight Description *</label>
              <Textarea
                placeholder="Detailed description of collateral (e.g. 22k gold Hallmark necklace 45g, vehicle chassis/RC, or property survey number)..."
                value={form.asset_description}
                onChange={(e) => setForm({ ...form, asset_description: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Collateral Verification Images</label>
              <AssetImageUpload
                loanId={editingLoan?.id || 'temp'}
                images={assetImages}
                onImagesChange={setAssetImages}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Vault & Custody Notes</label>
              <Textarea
                placeholder="Safe locker location, pouch number, condition upon receipt..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSave}>
                {editingLoan ? 'Update Loan' : 'Originate Loan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Customer Picker */}
      <CustomerPickerModal
        open={showCustomerPicker}
        onClose={() => setShowCustomerPicker(false)}
        onSelect={(c) => setSelectedCustomer(c)}
        customers={customers || []}
      />

      {/* Loan Details Modal */}
      {showLoanDetails && (
        <Dialog open={!!showLoanDetails} onOpenChange={() => setShowLoanDetails(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span>Pawn Loan Details</span>
                <span className="text-xs text-muted-foreground font-mono">#{showLoanDetails.id}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-muted/40 rounded-lg border">
                <CustomerAvatar
                  photoPath={showLoanDetails.customer?.profile_photo_url}
                  name={showLoanDetails.customer?.name}
                  className="w-16 h-16 border"
                  iconSize="w-8 h-8"
                />
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{showLoanDetails.customer?.name}</h3>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{showLoanDetails.customer?.primary_contact}</span>
                  </div>
                </div>
                <div>{getStatusBadge(showLoanDetails.status)}</div>
              </div>

              <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
                <div className="p-3 bg-muted/20 border rounded-lg">
                  <div className="text-xs text-muted-foreground">Original Loan Principal</div>
                  <div className="text-lg font-bold">{formatINR(showLoanDetails.loan_amount)}</div>
                </div>
                <div className="p-3 bg-muted/20 border rounded-lg">
                  <div className="text-xs text-muted-foreground">Remaining Principal</div>
                  <div className="text-lg font-bold text-primary">{formatINR(showLoanDetails.remaining_principal)}</div>
                </div>
                <div className="p-3 bg-muted/20 border rounded-lg">
                  <div className="text-xs text-muted-foreground">Monthly Interest Rate</div>
                  <div className="text-lg font-bold">{showLoanDetails.interest_rate_percent}% / month</div>
                </div>
                <div className="p-3 bg-muted/20 border rounded-lg">
                  <div className="text-xs text-muted-foreground">Pledged Collateral Valuation</div>
                  <div className="text-lg font-bold text-emerald-600">{formatINR(showLoanDetails.asset_value)}</div>
                </div>
                <div className="p-3 bg-muted/20 border rounded-lg">
                  <div className="text-xs text-muted-foreground">Origination Date</div>
                  <div className="text-sm font-semibold">{format(parseISO(showLoanDetails.start_date), 'MMM dd, yyyy')}</div>
                </div>
                <div className="p-3 bg-muted/20 border rounded-lg">
                  <div className="text-xs text-muted-foreground">Maturity Date</div>
                  <div className="text-sm font-semibold">{format(parseISO(showLoanDetails.due_date), 'MMM dd, yyyy')}</div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-sm font-semibold">Collateral Details ({showLoanDetails.asset_type})</div>
                <div className="p-3 bg-muted/30 rounded-lg border text-sm">{showLoanDetails.asset_description}</div>
              </div>

              {showLoanDetails.assets && showLoanDetails.assets.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-semibold">Vault Collateral Photos ({showLoanDetails.assets.length})</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {showLoanDetails.assets.map((asset) => (
                      <div key={asset.id} className="relative group border rounded-lg overflow-hidden bg-background">
                        <StorageImage
                          bucket="loan_assets"
                          path={asset.url}
                          alt={asset.name}
                          className="w-full h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        />
                        <div className="p-1.5 bg-background/90 text-xs truncate border-t font-mono">{asset.name}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showLoanDetails.notes && (
                <div className="space-y-1.5">
                  <div className="text-sm font-semibold">Custody Notes</div>
                  <div className="p-3 bg-muted/30 rounded-lg border text-sm">{showLoanDetails.notes}</div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Record Payment Modal */}
      {paymentModal && (
        <Dialog open={!!paymentModal} onOpenChange={() => setPaymentModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Payment for Loan #{paymentModal.loan.id.slice(0, 8)}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-3 bg-muted/40 rounded-lg border space-y-1">
                <div className="font-semibold">{paymentModal.loan.customer?.name}</div>
                <div className="text-xs text-muted-foreground flex justify-between">
                  <span>Principal: {formatINR(paymentModal.loan.remaining_principal)}</span>
                  <span>Rate: {paymentModal.loan.interest_rate_percent}% / mo</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Payment Type</label>
                <Select
                  value={paymentModal.type}
                  onValueChange={(v: 'interest' | 'principal') =>
                    setPaymentModal({
                      ...paymentModal,
                      type: v,
                      amount:
                        v === 'interest'
                          ? String((paymentModal.loan.remaining_principal * paymentModal.loan.interest_rate_percent) / 100)
                          : String(paymentModal.loan.remaining_principal),
                    })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="interest">Interest Payment (Settles Due)</SelectItem>
                    <SelectItem value="principal">Principal Paydown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Amount (₹) *</label>
                <Input
                  type="number"
                  placeholder="Enter payment amount"
                  value={paymentModal.amount}
                  onChange={(e) => setPaymentModal({ ...paymentModal, amount: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Transaction Notes / Mode</label>
                <Input
                  placeholder="e.g. Cash / UPI / Cheque / Bank Transfer"
                  value={paymentModal.notes}
                  onChange={(e) => setPaymentModal({ ...paymentModal, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setPaymentModal(null)}>
                  Cancel
                </Button>
                <Button onClick={recordPayment} disabled={!paymentModal.amount || Number(paymentModal.amount) <= 0}>
                  Confirm Payment
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirm Delete */}
      <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Loan Record</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the loan, linked interest dues, and all collateral files.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && deleteLoan(confirmDelete)}>
              Delete Record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Close */}
      <AlertDialog open={!!confirmClose} onOpenChange={() => setConfirmClose(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close Loan & Release Collateral</AlertDialogTitle>
            <AlertDialogDescription>
              This marks the loan as fully settled and closed.
              {confirmClose?.status === 'overdue' && (
                <div className="mt-2 p-2 bg-destructive/10 text-destructive rounded-md text-xs font-semibold">
                  ⚠️ Note: This loan has overdue interest. Confirm that all outstanding sums are collected before releasing collateral.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmClose && closeLoan(confirmClose)}>
              Close Loan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}