import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// Dashboard types (JOIN result: product name + table columns). Used by UI and API responses.
export type Vencimiento = {
  id?: string
  product_id?: string
  producto: string
  articulo: string
  vencimiento: string
  categoria: string
}
export type Vencido = {
  id?: string
  product_id?: string
  articulo: string
  nombre: string
  fecha_venci: string
  cant: number
}
export type Fallado = {
  id?: string
  product_id?: string
  articulo: string
  nombre: string
  cant: number
}
export type TrackerData = {
  vencimientos: Vencimiento[]
  vencidos: Vencido[]
  fallados: Fallado[]
}

// DB row types (table columns only). Used for inserts and internal queries.
export type ProductRow = { id: string; name: string; articulo?: string | null; created_at?: string }
export type VencimientoRow = {
  id: string
  product_id: string
  expiry_date: string
  category: string | null
  created_at?: string
}
export type VencidoRow = {
  id: string
  product_id: string
  expiry_date: string | null
  stock: number
  created_at?: string
}
export type FalladoRow = {
  id: string
  product_id: string
  stock: number
  created_at?: string
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Normalize ISO or YYYY-MM-DD to YYYY-MM-DD (no timezone). */
export function toDateOnly(dateStr: string): string {
  if (!dateStr?.trim()) return ""
  const i = dateStr.indexOf("T")
  return i >= 0 ? dateStr.slice(0, i) : dateStr.trim()
}

/** Format YYYY-MM-DD (or ISO) to dd/MM/yyyy. */
export function formatExpiryDate(dateStr: string): string {
  const ymd = toDateOnly(dateStr)
  if (!ymd) return dateStr
  const d = new Date(ymd + "T12:00:00")
  if (isNaN(d.getTime())) return dateStr
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

/** Days remaining until expiry (floor). Negative = already expired. Returns 0 if date is invalid. */
export function getDaysRemaining(expiryDateStr: string): number {
  const ymd = toDateOnly(expiryDateStr)
  if (!ymd) return 0
  const expiry = new Date(ymd + "T23:59:59").getTime()
  if (!Number.isFinite(expiry)) return 0
  const now = Date.now()
  return Math.floor((expiry - now) / (1000 * 60 * 60 * 24))
}
