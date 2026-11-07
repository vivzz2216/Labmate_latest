'use client'

import {useEffect, useState, type ReactNode} from 'react'
import {usePathname} from 'next/navigation'
import {useAuth} from '@/contexts/BasicAuthContext'
import UserOnboarding from './UserOnboarding'

export default function ProfileGate({children}: {children: ReactNode}) {
  const pathname = usePathname()
  const {user, loading, checkProfileComplete} = useAuth()
  const protectedPage = ['/dashboard', '/workspace', '/code-execution'].some(path => pathname === path || pathname.startsWith(path + '/'))
  const [checked, setChecked] = useState('')
  const [complete, setComplete] = useState(false)
  const key = `${user?.id || ''}:${pathname}`
  useEffect(() => {
    let active = true
    if (!protectedPage || loading || !user) return
    checkProfileComplete().then(done => {if (active) {setComplete(done); setChecked(key)}})
    return () => {active = false}
  }, [protectedPage, loading, user?.id, key])
  if (!protectedPage || (!loading && !user)) return <>{children}</>
  if (loading || checked !== key) return <div role="status" style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#050506',color:'#a1a1aa'}}>Loading your profile…</div>
  if (!complete) return <UserOnboarding isOpen onComplete={async () => {
    if (!await checkProfileComplete()) throw new Error('Your profile is incomplete. Please check every field and try again.')
    setComplete(true)
  }} />
  return <>{children}</>
}
