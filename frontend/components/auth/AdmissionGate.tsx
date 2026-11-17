'use client'

import {useCallback, useEffect, useRef, useState, type ReactNode} from 'react'
import {usePathname} from 'next/navigation'
import {useAuth} from '@/contexts/BasicAuthContext'
import api from '@/lib/api'

// Pages that do real work on the server. Everyone can sign in; when the app is full these pages show the waiting room instead.
const GATED = ['/dashboard', '/workspace', '/code-execution', '/labs', '/networks', '/mumbai-university']

interface AdmissionView {
  enabled: boolean
  status: 'active' | 'waiting'
  position: number
  waiting: number
  active: number
  limit: number
  estimated_wait_seconds: number
}

const ACTIVE_BEAT_MS = 30_000   // the server frees a slot when a page stops checking in (lease 120 s)
const WAITING_BEAT_MS = 8_000

function waitText(seconds: number): string {
  if (seconds < 60) return 'less than a minute'
  const minutes = Math.round(seconds / 60)
  return minutes === 1 ? 'about 1 minute' : `about ${minutes} minutes`
}

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx(), osc = ctx.createOscillator(), gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.value = 0.08
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.25)
  } catch { /* sound is optional */ }
}

export default function AdmissionGate({children}: {children: ReactNode}) {
  const pathname = usePathname()
  const {user, loading} = useAuth()
  const gated = GATED.some(path => pathname === path || pathname.startsWith(path + '/'))
  const userId = user?.id
  const [view, setView] = useState<AdmissionView | null>(null)
  const [notifyState, setNotifyState] = useState<'idle' | 'on' | 'blocked'>('idle')
  const wasWaiting = useRef(false)
  const originalTitle = useRef('')

  const admitted = useCallback(() => {
    beep()
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('LabMate is ready', {body: "It's your turn. You can start now."})
      }
    } catch { /* notifications are optional */ }
  }, [])

  useEffect(() => {
    if (!gated || loading || !userId) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const beat = async () => {
      let next = ACTIVE_BEAT_MS
      try {
        const {data} = await api.post<AdmissionView>('/api/admission/enter', {})
        if (stopped) return
        if (data.status === 'active' && wasWaiting.current) admitted()
        wasWaiting.current = data.status === 'waiting'
        next = data.status === 'waiting' ? WAITING_BEAT_MS : ACTIVE_BEAT_MS
        setView(data)
      } catch {
        /* if the check-in fails the app stays usable; the server still protects the heavy endpoints */
      }
      if (!stopped) timer = setTimeout(beat, next)
    }
    beat()
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
    }
  }, [gated, loading, userId, admitted])

  // While waiting, the tab title shows the place so a student in another tab sees it.
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!originalTitle.current) originalTitle.current = document.title
    if (view?.status === 'waiting') document.title = `(#${view.position}) LabMate – waiting`
    else if (originalTitle.current) document.title = originalTitle.current
  }, [view])

  const askToNotify = async () => {
    if (typeof Notification === 'undefined') { setNotifyState('blocked'); return }
    const result = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    setNotifyState(result === 'granted' ? 'on' : 'blocked')
  }

  if (!gated || loading || !user || !view || !view.enabled || view.status === 'active') return <>{children}</>

  const ahead = Math.max(0, view.position - 1)
  return (
    <main role="status" aria-live="polite" style={{minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#050506', color: '#e4e4e7', padding: '24px'}}>
      <section style={{maxWidth: 520, width: '100%', textAlign: 'center', border: '1px solid #27272a', borderRadius: 16, padding: '36px 28px', background: '#0b0b0d'}}>
        <p style={{margin: 0, fontSize: 13, letterSpacing: '.08em', textTransform: 'uppercase', color: '#a78bfa'}}>High traffic</p>
        <h1 style={{margin: '10px 0 8px', fontSize: 26, color: '#fafafa'}}>You&apos;re signed in. Please wait your turn.</h1>
        <p style={{margin: '0 0 22px', color: '#a1a1aa', lineHeight: 1.5}}>
          A lot of students are using LabMate at the same moment. We admit them in order so everyone&apos;s work runs properly.
          Keep this page open: you&apos;ll be let in automatically and we&apos;ll alert you.
        </p>
        <div style={{fontSize: 56, fontWeight: 700, color: '#fafafa', lineHeight: 1}}>#{view.position}</div>
        <p style={{margin: '8px 0 4px', color: '#d4d4d8'}}>
          {ahead === 0 ? "You're next." : `${ahead} ${ahead === 1 ? 'person is' : 'people are'} ahead of you.`}
        </p>
        <p style={{margin: '0 0 22px', color: '#a1a1aa'}}>Estimated wait: {waitText(view.estimated_wait_seconds)} (it updates as people leave)</p>
        <button type="button" onClick={askToNotify} disabled={notifyState === 'on'}
          style={{padding: '10px 18px', borderRadius: 10, border: '1px solid #3f3f46', background: notifyState === 'on' ? '#14532d' : '#18181b', color: '#fafafa', cursor: notifyState === 'on' ? 'default' : 'pointer'}}>
          {notifyState === 'on' ? 'We will alert you when it is your turn' : 'Alert me when it is my turn'}
        </button>
        {notifyState === 'blocked' && <p style={{margin: '10px 0 0', color: '#f59e0b', fontSize: 13}}>Notifications are blocked in this browser. The page will still let you in and play a sound.</p>}
        <p style={{margin: '18px 0 0', color: '#71717a', fontSize: 12}}>{view.active} of {view.limit} places in use · {view.waiting} waiting</p>
      </section>
    </main>
  )
}
