'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminPing, saveAdminCreds } from '@/lib/adminApi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function AdminLoginPage() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await adminPing(userId.trim(), password)
      saveAdminCreds(userId.trim(), password)
      router.push('/admin/dashboard')
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Admin login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0b1220] text-white flex items-center justify-center p-6">
      <Card className="w-full max-w-md bg-white/5 border border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Admin Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-white/80">User ID</label>
              <input
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="e.g. 2216"
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/80">Password</label>
              <input
                type="password"
                className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-white outline-none focus:border-white/30"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
              />
            </div>
            {error && <p className="text-sm text-red-300">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
            <p className="text-xs text-white/60">
              Route: <span className="font-mono">/admin</span> → <span className="font-mono">/admin/dashboard</span>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}



