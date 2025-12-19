import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface AdminOverview {
  total_users: number
  active_subscriptions: number
  total_uploads: number
  completed_jobs: number
  feedback_count: number
}

export interface AdminUserRow {
  id: number
  email: string
  name: string
  created_at: string | null
  last_login: string | null
  is_active: boolean
  subscription_active: boolean
  subscription_plan?: string | null
  subscription_expires_at?: string | null
  uploads_total: number
  assignments_completed: number
  jobs_completed: number
  reports_total: number
  feedback_count: number
}

export interface AdminFeedbackRow {
  id: number
  user_id: number | null
  user_email: string | null
  user_name: string | null
  rating: number | null
  message: string
  created_at: string | null
}

const adminApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
})

const ADMIN_AUTH_KEY = 'labmate_admin_basic'

export function saveAdminCreds(userId: string, password: string) {
  if (typeof window === 'undefined') return
  const token = btoa(`${userId}:${password}`)
  localStorage.setItem(ADMIN_AUTH_KEY, token)
}

export function clearAdminCreds() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(ADMIN_AUTH_KEY)
}

export function getAdminAuthHeader(): string | null {
  if (typeof window === 'undefined') return null
  const token = localStorage.getItem(ADMIN_AUTH_KEY)
  if (!token) return null
  return `Basic ${token}`
}

function authHeaders() {
  const auth = getAdminAuthHeader()
  return auth ? { Authorization: auth } : {}
}

export async function adminPing(userId: string, password: string) {
  const token = btoa(`${userId}:${password}`)
  const res = await adminApi.get('/api/admin/ping', {
    headers: { Authorization: `Basic ${token}` },
  })
  return res.data
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  const res = await adminApi.get('/api/admin/overview', { headers: authHeaders() })
  return res.data
}

export async function fetchAdminUsers(): Promise<{ users: AdminUserRow[] }> {
  const res = await adminApi.get('/api/admin/users', { headers: authHeaders() })
  return res.data
}

export async function fetchAdminFeedback(): Promise<{ feedback: AdminFeedbackRow[] }> {
  const res = await adminApi.get('/api/admin/feedback', { headers: authHeaders() })
  return res.data
}

export async function setUserSubscription(
  userId: number,
  body: { is_active: boolean; plan?: string; expires_at?: string | null }
) {
  const res = await adminApi.post(`/api/admin/subscription/${userId}`, body, { headers: authHeaders() })
  return res.data
}



