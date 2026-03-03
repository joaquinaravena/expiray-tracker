import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format YYYY-MM-DD to dd/MM/yyyy */
export function formatExpiryDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00")
  if (isNaN(d.getTime())) return dateStr
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

/** Days remaining until expiry (floor). Negative = already expired. */
export function getDaysRemaining(expiryDateStr: string): number {
  const expiry = new Date(expiryDateStr + "T23:59:59").getTime()
  const now = Date.now()
  return Math.floor((expiry - now) / (1000 * 60 * 60 * 24))
}
