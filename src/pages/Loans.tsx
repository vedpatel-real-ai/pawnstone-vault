import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/useAuth'
import { format, addMonths, isAfter, parseISO } from 'date-fns'
import { ExportButtons } from '@/components/ExportButtons'
import { CustomerPickerModal } from '@/components/CustomerPickerModal'
import { AssetImageUpload } from '@/components/AssetImageUpload'
import { Search, Plus, Eye, Edit, Trash2, DollarSign, X, User, Phone, AlertTriangle, Calendar, CreditCard, FileImage } from 'lucide-react'
import { enqueue } from '@/lib/offlineQueue'
import { useLocation } from 'react-router-dom'

interface Customer {
  id: string
  name: string
  primary_contact: string
  alt_contact?: string
  id_proof_number?: string
  profile_photo_url?: string
  loan_count?: number
}

interface LoanAsset {
  id: string
  url: string
  name: string
}

interface Loan {
  id: string
  customer_id: string
  customer?: Customer
  asset_type: string
  asset_description: string
  asset_value: number
  loan_amount: number
  remaining_principal: number
  interest_rate_percent: number
  start_date: string
  due_date: string
  term_months: number
  status: 'active' | 'overdue' | 'closed'
  notes?: string
  created_at: string
  assets?: LoanAsset[]
}

export default function Loans() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const { orgId } = useAuth()
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const statusFilter = params.get('status')
  const loanParam = params.get('loan')

  // State
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    status: statusFilter || '',
    type: '',
    amountMin: '',
    amountMax: '',
    dueDateFrom: '',
    dueDateTo: ''
  })
  const [sort, setSort] = useState('created_at_desc')
  const [showForm, setShowForm] = useState(false)
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null)
  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [showLoanDetails, setShowLoanDetails] = useState<Loan | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [assetImages, setAssetImages] = useState<LoanAsset[]>([])
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmClose, setConfirmClose] = useState<Loan | null>(null)
  const [paymentModal, setPaymentModal] = useState<{ loan: Loan; amount: string } | null>(null)

  const [form, setForm] = useState({
    loan_amount: '',
    asset_type: 'gold',
    asset_description: '',
    asset_value: '',
    interest_rate_percent: '2.5',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    due_date: format(addMonths(new Date(), 1), 'yyyy-MM-dd'),
    term_months: '12',
    notes: ''
  })

  // Queries
  const { data: customers } = useQuery({
    queryKey: ['customers-with-loans'],
    queryFn: async () => {
      const { data: customers } = await supabase
        .from('customers')
        .select('id, name, primary_contact, alt_contact, id_proof_number, profile_photo_url')
        .order('name')

      const { data: loanCounts } = await supabase
        .from('loans')
        .select('customer_id')
        .eq('status', 'active')

      const customerLoanMap = loanCounts?.reduce((acc: Record<string, number>, loan) => {
        acc[loan.customer_id] = (acc[loan.customer_id] || 0) + 1
        return acc
      }, {}) || {}

      return customers?.map(customer => ({
        ...customer,
        loan_count: customerLoanMap[customer.id] || 0
      })) || []
    }
  })

  const { data: loans } = useQuery({
    queryKey: ['loans-detailed'],
    queryFn: async () => {
      const { data: loans } = await supabase
        .from('loans')
        .select(`
          *,
          customer:customers(id, name, primary_contact, profile_photo_url)
        `)
        .order('created_at', { ascending: false })

      // Get asset images for each loan
      const loansWithAssets = await Promise.all(
        (loans || []).map(async (loan) => {
          const { data: assets } = await supabase
            .from('loan_assets')
            .select('id, file_url, file_name')
            .eq('loan_id', loan.id)

          return {
            ...loan,
            assets: assets?.map(asset => ({
              id: asset.id,
              url: asset.file_url,
              name: asset.file_name
            })) || []
          }
        })
      )

      return loansWithAssets
    }
  })

  // Auto-update overdue loans
  useEffect(() => {
    if (!loans) return

    const updateOverdueLoans = async () => {
      const today = new Date()
      const overdueLoans = loans.filter(loan => 
        loan.status === 'active' && 
        loan.due_date && 
        isAfter(today, parseISO(loan.due_date))
      )

      if (overdueLoans.length > 0) {
        await Promise.all(
          overdueLoans.map(loan =>
            supabase
              .from('loans')
              .update({ status: 'overdue' })
              .eq('id', loan.id)
          )
        )
        qc.invalidateQueries({ queryKey: ['loans-detailed'] })
      }
    }

    updateOverdueLoans()
  }, [loans, qc])

  // Filter and sort loans
  const filteredLoans = useMemo(() => {
    let result = loans || []

    // URL filters
    if (loanParam) return result.filter(l => l.id === loanParam)
    if (statusFilter) result = result.filter(l => l.status === statusFilter)

    // Search
    if (search) {
      const searchLower = search.toLowerCase()
      result = result.filter(loan =>
        loan.id.toLowerCase().includes(searchLower) ||
        loan.customer?.name.toLowerCase().includes(searchLower) ||
        loan.asset_type.toLowerCase().includes(searchLower) ||
        loan.asset_description.toLowerCase().includes(searchLower)
      )
    }

    // Filters
    if (filters.status) result = result.filter(l => l.status === filters.status)
    if (filters.type) result = result.filter(l => l.asset_type === filters.type)
    if (filters.amountMin) result = result.filter(l => l.loan_amount >= Number(filters.amountMin))
    if (filters.amountMax) result = result.filter(l => l.loan_amount <= Number(filters.amountMax))
    if (filters.dueDateFrom) result = result.filter(l => l.due_date >= filters.dueDateFrom)
    if (filters.dueDateTo) result = result.filter(l => l.due_date <= filters.dueDateTo)

    // Sort
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
  }, [loans, search, filters, sort, statusFilter, loanParam])

  const canSave = useMemo(() => 
    selectedCustomer && 
    Number(form.loan_amount) > 0 && 
    form.asset_description && 
    assetImages.length > 0
  , [selectedCustomer, form, assetImages])

  useEffect(() => { 
    document.title = 'Loans | PawnTrack' 
  }, [])

  const resetForm = () => {
    setForm({
      loan_amount: '',
      asset_type: 'gold',
      asset_description: '',
      asset_value: '',
      interest_rate_percent: '2.5',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      due_date: format(addMonths(new Date(), 1), 'yyyy-MM-dd'),
      term_months: '12',
      notes: ''
    })
    setSelectedCustomer(null)
    setAssetImages([])
    setEditingLoan(null)
  }

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer)
  }

  const saveLoan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId || !selectedCustomer) {
      toast({ title: 'Missing data', description: 'Please select customer and fill required fields.' })
      return
    }

    const payload = {
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
      term_months: Number(form.term_months),
      status: 'active' as const,
      notes: form.notes || null
    }

    try {
      let loanId: string

      if (editingLoan) {
        const { error } = await supabase
          .from('loans')
          .update(payload)
          .eq('id', editingLoan.id)
        
        if (error) throw error
        loanId = editingLoan.id
        toast({ title: 'Loan updated' })
      } else {
        const { data, error } = await supabase
          .from('loans')
          .insert(payload)
          .select()
          .single()
        
        if (error) throw error
        loanId = data.id
        toast({ title: 'Loan created' })
      }

      // Handle asset images for new loans
      if (!editingLoan && assetImages.length > 0) {
        await Promise.all(
          assetImages.map(asset =>
            supabase
              .from('loan_assets')
              .insert({
                loan_id: loanId,
                file_url: asset.url,
                file_name: asset.name,
                file_size: 0 // We'll need to track this properly
              })
          )
        )
      }

      resetForm()
      setShowForm(false)
      qc.invalidateQueries({ queryKey: ['loans-detailed'] })
    } catch (err) {
      await enqueue({ id: crypto.randomUUID(), type: 'create_loan', payload })
      toast({ title: 'Offline', description: 'Saved locally. Will sync when online.' })
    }
  }

  const editLoan = (loan: Loan) => {
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
      notes: loan.notes || ''
    })
    setShowForm(true)
  }

  const deleteLoan = async (loanId: string) => {
    try {
      // Delete asset images first
      const { data: assets } = await supabase
        .from('loan_assets')
        .select('file_url')
        .eq('loan_id', loanId)

      if (assets) {
        // Delete from storage
        const filePaths = assets.map(asset => {
          const urlParts = asset.file_url.split('/loan_assets/')
          return urlParts.length > 1 ? urlParts[1] : null
        }).filter(Boolean)

        if (filePaths.length > 0) {
          await supabase.storage.from('loan_assets').remove(filePaths)
        }

        // Delete from database
        await supabase.from('loan_assets').delete().eq('loan_id', loanId)
      }

      // Delete loan
      const { error } = await supabase.from('loans').delete().eq('id', loanId)
      if (error) throw error

      toast({ title: 'Loan deleted' })
      qc.invalidateQueries({ queryKey: ['loans-detailed'] })
    } catch (error) {
      console.error('Delete error:', error)
      toast({ title: 'Delete failed', variant: 'destructive' })
    }
    setConfirmDelete(null)
  }

  const closeLoan = async (loan: Loan) => {
    try {
      const { error } = await supabase
        .from('loans')
        .update({ status: 'closed', remaining_principal: 0 })
        .eq('id', loan.id)

      if (error) throw error

      toast({ title: 'Loan closed successfully' })
      qc.invalidateQueries({ queryKey: ['loans-detailed'] })
    } catch (error) {
      console.error('Close loan error:', error)
      toast({ title: 'Failed to close loan', variant: 'destructive' })
    }
    setConfirmClose(null)
  }

  const recordPayment = async () => {
    if (!paymentModal) return

    try {
      const { error } = await supabase
        .from('payments')
        .insert({
          loan_id: paymentModal.loan.id,
          amount: Number(paymentModal.amount),
          type: 'interest',
          payment_date: format(new Date(), 'yyyy-MM-dd'),
          notes: 'Interest payment'
        })

      if (error) throw error

      toast({ title: 'Payment recorded' })
      qc.invalidateQueries({ queryKey: ['loans-detailed'] })
    } catch (error) {
      console.error('Payment error:', error)
      toast({ title: 'Failed to record payment', variant: 'destructive' })
    }
    setPaymentModal(null)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default">Active</Badge>
      case 'overdue':
        return <Badge variant="destructive">Overdue</Badge>
      case 'closed':
        return <Badge variant="secondary">Closed</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Loans</h1>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Loan
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search loans..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filters.status} onValueChange={(v) => setFilters({...filters, status: v})}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.type} onValueChange={(v) => setFilters({...filters, type: v})}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All types</SelectItem>
                <SelectItem value="gold">Gold</SelectItem>
                <SelectItem value="car">Vehicle</SelectItem>
                <SelectItem value="property">Property</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at_desc">Newest first</SelectItem>
                <SelectItem value="created_at_asc">Oldest first</SelectItem>
                <SelectItem value="amount_desc">Highest amount</SelectItem>
                <SelectItem value="amount_asc">Lowest amount</SelectItem>
                <SelectItem value="due_date_asc">Due soonest</SelectItem>
                <SelectItem value="due_date_desc">Due latest</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-4 mt-4">
            <Input
              type="number"
              placeholder="Min amount"
              value={filters.amountMin}
              onChange={(e) => setFilters({...filters, amountMin: e.target.value})}
            />
            <Input
              type="number"
              placeholder="Max amount"
              value={filters.amountMax}
              onChange={(e) => setFilters({...filters, amountMax: e.target.value})}
            />
            <Input
              type="date"
              placeholder="Due from"
              value={filters.dueDateFrom}
              onChange={(e) => setFilters({...filters, dueDateFrom: e.target.value})}
            />
            <Input
              type="date"
              placeholder="Due to"
              value={filters.dueDateTo}
              onChange={(e) => setFilters({...filters, dueDateTo: e.target.value})}
            />
          </div>
        </CardContent>
      </Card>

      {/* Loans List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Loans ({filteredLoans.length})</CardTitle>
          <ExportButtons data={filteredLoans || []} filename="loans" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredLoans.map((loan) => (
              <div key={loan.id} className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={loan.customer?.profile_photo_url} />
                  <AvatarFallback>
                    <User className="w-6 h-6" />
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium truncate">{loan.customer?.name}</h3>
                    {getStatusBadge(loan.status)}
                    {loan.status === 'overdue' && <AlertTriangle className="w-4 h-4 text-destructive" />}
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      ${loan.loan_amount.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Due: {format(parseISO(loan.due_date), 'MMM dd, yyyy')}
                    </div>
                    <div className="flex items-center gap-1">
                      <CreditCard className="w-3 h-3" />
                      {loan.asset_type}
                    </div>
                    <div className="flex items-center gap-1">
                      <FileImage className="w-3 h-3" />
                      {loan.assets?.length || 0} images
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {loan.status === 'active' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPaymentModal({ loan, amount: '' })}
                    >
                      Record Payment
                    </Button>
                  )}
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowLoanDetails(loan)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => editLoan(loan)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>

                  {loan.status === 'active' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setConfirmClose(loan)}
                    >
                      Close
                    </Button>
                  )}
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmDelete(loan.id)}
                  >
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
      <Dialog open={showForm} onOpenChange={(open) => {
        setShowForm(open)
        if (!open) resetForm()
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLoan ? 'Edit Loan' : 'Create New Loan'}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={saveLoan} className="space-y-6">
            {/* Customer Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Customer *</label>
              {selectedCustomer ? (
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={selectedCustomer.profile_photo_url} />
                    <AvatarFallback>
                      <User className="w-5 h-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-medium">{selectedCustomer.name}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {selectedCustomer.primary_contact}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowCustomerPicker(true)}
                  >
                    Change
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedCustomer(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowCustomerPicker(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Select Customer
                </Button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Loan Amount *</label>
                <Input
                  type="number"
                  placeholder="Enter loan amount"
                  value={form.loan_amount}
                  onChange={(e) => setForm({...form, loan_amount: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Interest Rate (% per month) *</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="2.5"
                  value={form.interest_rate_percent}
                  onChange={(e) => setForm({...form, interest_rate_percent: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date *</label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({...form, start_date: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Due Date *</label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({...form, due_date: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Loan Type *</label>
                <Select value={form.asset_type} onValueChange={(v) => setForm({...form, asset_type: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="car">Vehicle</SelectItem>
                    <SelectItem value="property">Property</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Asset Value</label>
                <Input
                  type="number"
                  placeholder="Enter asset value"
                  value={form.asset_value}
                  onChange={(e) => setForm({...form, asset_value: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Asset Description *</label>
              <Textarea
                placeholder="Describe the asset..."
                value={form.asset_description}
                onChange={(e) => setForm({...form, asset_description: e.target.value})}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Asset Images *</label>
              <AssetImageUpload
                loanId={editingLoan?.id || 'temp'}
                images={assetImages}
                onImagesChange={setAssetImages}
                disabled={!editingLoan && !selectedCustomer}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                placeholder="Additional notes..."
                value={form.notes}
                onChange={(e) => setForm({...form, notes: e.target.value})}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSave}>
                {editingLoan ? 'Update Loan' : 'Create Loan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Customer Picker Modal */}
      <CustomerPickerModal
        open={showCustomerPicker}
        onClose={() => setShowCustomerPicker(false)}
        onSelect={handleCustomerSelect}
        customers={customers || []}
      />

      {/* Loan Details Modal */}
      {showLoanDetails && (
        <Dialog open={!!showLoanDetails} onOpenChange={() => setShowLoanDetails(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Loan Details</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Customer Info */}
              <div className="flex items-center gap-4 p-4 bg-accent/50 rounded-lg">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={showLoanDetails.customer?.profile_photo_url} />
                  <AvatarFallback>
                    <User className="w-8 h-8" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium text-lg">{showLoanDetails.customer?.name}</h3>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    {showLoanDetails.customer?.primary_contact}
                  </div>
                </div>
                <div className="ml-auto">
                  {getStatusBadge(showLoanDetails.status)}
                </div>
              </div>

              {/* Loan Info */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Loan Amount</div>
                  <div className="text-lg font-medium">${showLoanDetails.loan_amount.toLocaleString()}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Interest Rate</div>
                  <div className="text-lg font-medium">{showLoanDetails.interest_rate_percent}% / month</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Asset Type</div>
                  <div className="text-lg font-medium capitalize">{showLoanDetails.asset_type}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Start Date</div>
                  <div className="text-lg font-medium">{format(parseISO(showLoanDetails.start_date), 'MMM dd, yyyy')}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Due Date</div>
                  <div className="text-lg font-medium">{format(parseISO(showLoanDetails.due_date), 'MMM dd, yyyy')}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Remaining Principal</div>
                  <div className="text-lg font-medium">${showLoanDetails.remaining_principal.toLocaleString()}</div>
                </div>
              </div>

              {/* Asset Description */}
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Asset Description</div>
                <div className="p-3 bg-accent/30 rounded-lg">{showLoanDetails.asset_description}</div>
              </div>

              {/* Asset Images */}
              {showLoanDetails.assets && showLoanDetails.assets.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Asset Images ({showLoanDetails.assets.length})</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {showLoanDetails.assets.map((asset) => (
                      <div key={asset.id} className="relative group">
                        <img
                          src={asset.url}
                          alt={asset.name}
                          className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(asset.url, '_blank')}
                        />
                        <div className="absolute bottom-2 left-2 right-2 bg-black/70 text-white text-xs p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                          {asset.name}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {showLoanDetails.notes && (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Notes</div>
                  <div className="p-3 bg-accent/30 rounded-lg">{showLoanDetails.notes}</div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Payment Modal */}
      {paymentModal && (
        <Dialog open={!!paymentModal} onOpenChange={() => setPaymentModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Interest Payment</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="p-3 bg-accent/30 rounded-lg">
                <div className="font-medium">{paymentModal.loan.customer?.name}</div>
                <div className="text-sm text-muted-foreground">
                  Loan: ${paymentModal.loan.loan_amount.toLocaleString()} @ {paymentModal.loan.interest_rate_percent}%
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Payment Amount</label>
                <Input
                  type="number"
                  placeholder="Enter payment amount"
                  value={paymentModal.amount}
                  onChange={(e) => setPaymentModal({...paymentModal, amount: e.target.value})}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setPaymentModal(null)}>
                  Cancel
                </Button>
                <Button 
                  onClick={recordPayment}
                  disabled={!paymentModal.amount || Number(paymentModal.amount) <= 0}
                >
                  Record Payment
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
            <AlertDialogTitle>Delete Loan</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the loan and all associated asset images. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && deleteLoan(confirmDelete)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Close Loan */}
      <AlertDialog open={!!confirmClose} onOpenChange={() => setConfirmClose(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close Loan</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the loan as closed and set the remaining principal to zero. Make sure all payments have been collected.
              {confirmClose?.status === 'overdue' && (
                <div className="mt-2 p-2 bg-destructive/10 text-destructive rounded-lg text-sm">
                  ⚠️ This loan is currently overdue. Please confirm that all dues have been settled.
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