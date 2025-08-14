import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Search, User, Phone, CreditCard } from 'lucide-react'

interface Customer {
  id: string
  name: string
  primary_contact: string
  alt_contact?: string
  id_proof_number?: string
  profile_photo_url?: string
  loan_count?: number
}

interface CustomerPickerModalProps {
  open: boolean
  onClose: () => void
  onSelect: (customer: Customer) => void
  customers: Customer[]
}

export function CustomerPickerModal({ open, onClose, onSelect, customers }: CustomerPickerModalProps) {
  const [search, setSearch] = useState('')

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(search.toLowerCase()) ||
    customer.primary_contact.includes(search) ||
    customer.alt_contact?.includes(search) ||
    customer.id_proof_number?.toLowerCase().includes(search.toLowerCase())
  )

  const handleSelect = (customer: Customer) => {
    onSelect(customer)
    onClose()
    setSearch('')
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select Customer</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, contact, or ID proof..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2">
            {filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                onClick={() => handleSelect(customer)}
              >
                <Avatar className="w-12 h-12">
                  <AvatarImage src={customer.profile_photo_url} />
                  <AvatarFallback>
                    <User className="w-6 h-6" />
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium truncate">{customer.name}</h3>
                    {(customer.loan_count || 0) > 0 && (
                      <Badge variant="outline" className="text-xs">
                        {customer.loan_count} active loans
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                    <div className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {customer.primary_contact}
                    </div>
                    {customer.alt_contact && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {customer.alt_contact}
                      </div>
                    )}
                    {customer.id_proof_number && (
                      <div className="flex items-center gap-1">
                        <CreditCard className="w-3 h-3" />
                        {customer.id_proof_number}
                      </div>
                    )}
                  </div>
                </div>

                <Button size="sm" variant="outline">
                  Select
                </Button>
              </div>
            ))}
            
            {filteredCustomers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No customers found matching your search.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}