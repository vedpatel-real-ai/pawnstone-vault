import { Button } from '@/components/ui/button'
import Papa from 'papaparse'
import jsPDF from 'jspdf'

type ExportProps<T> = {
  data: T[]
  filename: string
}

export function ExportButtons<T>({ data, filename }: ExportProps<T>) {
  const handleCSV = () => {
    const csv = Papa.unparse(data as any)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${filename}.csv`
    link.click()
  }

  const handlePDF = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    doc.setFontSize(12)
    const lineHeight = 18
    let y = 40
    const json = data as any[]
    doc.text(filename, 40, y)
    y += 24
    json.forEach((row, idx) => {
      const text = Object.entries(row).map(([k,v]) => `${k}: ${String(v)}`).join('  |  ')
      doc.text(text.substring(0, 1100), 40, y)
      y += lineHeight
      if (y > 780) { doc.addPage(); y = 40 }
    })
    doc.save(`${filename}.pdf`)
  }

  return (
    <div className="flex gap-2">
      <Button onClick={handleCSV} variant="secondary">Export CSV</Button>
      <Button onClick={handlePDF} variant="secondary">Export PDF</Button>
    </div>
  )
}
