'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  clearAdminCreds,
  fetchAdminFeedback,
  fetchAdminOverview,
  fetchAdminUsers,
  getAdminAuthHeader,
  setUserSubscription,
  type AdminFeedbackRow,
  type AdminOverview,
  type AdminUserRow,
} from '@/lib/adminApi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function AdminDashboardPage() {
  const router = useRouter()
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [feedback, setFeedback] = useState<AdminFeedbackRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        String(u.id).includes(q)
    )
  }, [users, query])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [o, u, f] = await Promise.all([fetchAdminOverview(), fetchAdminUsers(), fetchAdminFeedback()])
      setOverview(o)
      setUsers(u.users || [])
      setFeedback(f.feedback || [])
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to load admin data'
      setError(msg)
      if (String(err?.response?.status) === '401') {
        clearAdminCreds()
        router.push('/admin')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const auth = getAdminAuthHeader()
    if (!auth) {
      router.push('/admin')
      return
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleSubscription = async (userId: number, current: boolean) => {
    try {
      await setUserSubscription(userId, { is_active: !current, plan: 'hobby', expires_at: null })
      await load()
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to update subscription')
    }
  }

  const signOut = () => {
    clearAdminCreds()
    router.push('/admin')
  }

  return (
    <div className="min-h-screen bg-[#0b1220] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            <p className="text-white/60 text-sm">
              Users, subscriptions, assignments progress, and student feedback
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={load} className="border-white/15 text-white hover:bg-white/10">
              Refresh
            </Button>
            <Button variant="outline" onClick={signOut} className="border-white/15 text-white hover:bg-white/10">
              Sign out
            </Button>
          </div>
        </div>

        {error && (
          <Card className="bg-red-500/10 border-red-500/30">
            <CardContent className="p-4 text-red-200 text-sm">{error}</CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-5">
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-white/70">Users</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{overview?.total_users ?? '—'}</CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-white/70">Active Subs</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{overview?.active_subscriptions ?? '—'}</CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-white/70">Uploads</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{overview?.total_uploads ?? '—'}</CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-white/70">Completed Jobs</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{overview?.completed_jobs ?? '—'}</CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-white/70">Feedback</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{overview?.feedback_count ?? '—'}</CardContent>
          </Card>
        </div>

        <Card className="bg-white/5 border-white/10">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-white">Users</CardTitle>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name/email/id…"
              className="w-full max-w-sm rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none"
            />
          </CardHeader>
          <CardContent className="overflow-auto">
            {loading ? (
              <p className="text-white/60 text-sm">Loading…</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-white/70">
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 pr-3">User</th>
                    <th className="text-left py-2 pr-3">Joined</th>
                    <th className="text-left py-2 pr-3">Subscription</th>
                    <th className="text-right py-2 pr-3">Uploads</th>
                    <th className="text-right py-2 pr-3">Assignments Done</th>
                    <th className="text-right py-2 pr-3">Jobs Done</th>
                    <th className="text-right py-2 pr-3">Feedback</th>
                    <th className="text-right py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="border-b border-white/5">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{u.name}</div>
                        <div className="text-white/60">{u.email}</div>
                        <div className="text-white/40 text-xs">ID: {u.id}</div>
                      </td>
                      <td className="py-2 pr-3 text-white/70">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="py-2 pr-3">
                        <div className={u.subscription_active ? 'text-green-300' : 'text-white/60'}>
                          {u.subscription_active ? `Active (${u.subscription_plan || 'hobby'})` : 'None'}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-right">{u.uploads_total}</td>
                      <td className="py-2 pr-3 text-right">{u.assignments_completed}</td>
                      <td className="py-2 pr-3 text-right">{u.jobs_completed}</td>
                      <td className="py-2 pr-3 text-right">{u.feedback_count}</td>
                      <td className="py-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-white/15 text-white hover:bg-white/10"
                          onClick={() => toggleSubscription(u.id, u.subscription_active)}
                        >
                          {u.subscription_active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-white/60">
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Student Feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-white/60 text-sm">Loading…</p>
            ) : feedback.length === 0 ? (
              <p className="text-white/60 text-sm">No feedback yet.</p>
            ) : (
              feedback.slice(0, 30).map((f) => (
                <div key={f.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm">
                      <span className="font-medium">{f.user_name || 'Unknown user'}</span>{' '}
                      <span className="text-white/60">{f.user_email ? `(${f.user_email})` : ''}</span>
                      {typeof f.rating === 'number' && (
                        <span className="ml-2 text-yellow-300">Rating: {f.rating}/5</span>
                      )}
                    </div>
                    <div className="text-xs text-white/50">
                      {f.created_at ? new Date(f.created_at).toLocaleString() : ''}
                    </div>
                  </div>
                  <div className="mt-2 text-white/80 whitespace-pre-wrap text-sm">{f.message}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-white/50">
          Admin routes: <span className="font-mono">/admin</span> and <span className="font-mono">/admin/dashboard</span>
        </p>
      </div>
    </div>
  )
}



