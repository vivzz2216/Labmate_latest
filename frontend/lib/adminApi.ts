import api from './api'

export type PaymentMode = 'live' | 'test'
export interface Revenue {
  gross_paise: number; refunds_paise: number; net_paise: number
  captured_orders: number; paying_students: number
}
export interface AdminOverview {
  generated_at: string; owner_email: string; billing_mode: PaymentMode
  total_students: number; enabled_students: number; active_students_7d: number
  students_with_uploads: number; uploads_total: number; reports_total: number
  completed_manuals: number; running_manuals: number; failed_or_paused_manuals: number
  revenue: Record<PaymentMode, Revenue>
}
export interface AdminUserRow {
  id: number; name: string; email: string; is_active: boolean
  created_at: string | null; last_login: string | null; last_activity: string | null
  institution: string | null; course: string | null
  uploads_total: number; completed_manuals: number; failed_or_paused_manuals: number; reports_total: number
  paid_orders: number; gross_paid_paise: number; refunded_paise: number; net_paid_paise: number; is_paying: boolean
  credits: Record<PaymentMode, { balance: number; reserved: number }>
}
export interface AdminPayment {
  id: string; user_id: number; name: string; email: string; mode: PaymentMode
  pack_id: string; amount_paise: number; currency: string; status: string; captured: boolean
  refunded_paise: number; net_paise: number; credits: number
  gateway_order_id: string | null; gateway_payment_id: string | null
  created_at: string | null; fulfilled_at: string | null
}
export interface StudentPage { users: AdminUserRow[]; total: number; offset: number; limit: number }
export interface PaymentPage { payments: AdminPayment[]; total: number; offset: number; limit: number; mode: PaymentMode }

export async function fetchAdminOverview(signal?: AbortSignal): Promise<AdminOverview> {
  return (await api.get('/api/admin/overview', { signal })).data
}
export async function fetchAdminUsers(params: { search: string; paid?: boolean; active?: boolean; offset: number; limit: number }, signal?: AbortSignal): Promise<StudentPage> {
  return (await api.get('/api/admin/users', { params, signal })).data
}
export async function fetchAdminPayments(mode: PaymentMode, offset: number, signal?: AbortSignal): Promise<PaymentPage> {
  return (await api.get('/api/admin/payments', { params: { mode, offset, limit: 25 }, signal })).data
}
