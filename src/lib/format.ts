import type { LocationContext } from './database.types'

export function firstName(fullName: string | null, email: string): string {
  if (fullName && fullName.trim()) return fullName.trim().split(/\s+/)[0]
  return email.split('@')[0]
}

export function contextLabel(ctx: LocationContext | null): string {
  switch (ctx) {
    case 'office':
      return 'Office'
    case 'remote':
      return 'Remote'
    default:
      return 'Unknown'
  }
}

export function csvCell(value: unknown): string {
  const s = value == null ? '' : String(value)
  // Guard against CSV injection in spreadsheet apps and quote as needed.
  const needsQuote = /[",\n\r]/.test(s)
  const sanitized = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return needsQuote ? `"${sanitized.replace(/"/g, '""')}"` : sanitized
}

export function toCsv(rows: (string | number | null)[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
