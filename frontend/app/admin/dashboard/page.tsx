'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, LockKeyhole, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/contexts/BasicAuthContext'
import LabMateLogo from '@/components/brand/LabMateLogo'
import LoginModal from '@/components/auth/LoginModal'
import { fetchAdminOverview, fetchAdminUsers, fetchAdminPayments, type AdminOverview, type StudentPage, type PaymentPage, type PaymentMode } from '@/lib/adminApi'
import styles from './admin.module.css'

const money = (paise: number, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(paise / 100)
const number = (value: number) => new Intl.NumberFormat('en-IN').format(value)
const date = (value: string | null) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value)) : 'No activity recorded'

export default function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [students, setStudents] = useState<StudentPage | null>(null)
  const [payments, setPayments] = useState<PaymentPage | null>(null)
  const [tab, setTab] = useState<'students' | 'payments'>('students')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [mode, setMode] = useState<PaymentMode>('live')
  const [page, setPage] = useState(0)
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [denied, setDenied] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)

  useEffect(() => { try { localStorage.removeItem('labmate_admin_basic') } catch { /* No legacy storage to clear. */ } }, [])
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search); setPage(0) }, 250)
    return () => clearTimeout(timer)
  }, [search])
  useEffect(() => {
    if (authLoading) return
    if (!user) { setOverview(null); setLoading(false); return }
    const controller = new AbortController()
    setLoading(true); setError(''); setDenied(false)
    const detail = tab === 'students'
      ? fetchAdminUsers({ search: query, paid: filter === 'paid' ? true : filter === 'unpaid' ? false : undefined, active: filter === 'inactive' ? false : undefined, offset: page * 25, limit: 25 }, controller.signal)
      : fetchAdminPayments(mode, page * 25, controller.signal)
    Promise.all([fetchAdminOverview(controller.signal), detail]).then(([summary, records]) => {
      if (controller.signal.aborted) return
      setOverview(summary)
      if (tab === 'students') setStudents(records as StudentPage)
      else setPayments(records as PaymentPage)
    }).catch((err) => {
      if (controller.signal.aborted) return
      if ([401, 403].includes(err?.response?.status)) { setDenied(true); setOverview(null) }
      else setError('Dashboard data could not be loaded. Refresh to try again.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [authLoading, user?.id, user?.is_admin, tab, query, filter, mode, page, refresh])

  const total = tab === 'students' ? students?.total || 0 : payments?.total || 0
  const checkingAccess = authLoading || (!!user && !user.is_admin && !overview && loading && !denied)
  const allowed = !!user && (!!user.is_admin || !!overview) && !denied

  return <div className={styles.shell}>
    <header className={styles.header}>
      <Link href="/" aria-label="LabMate home" className={styles.brand}><LabMateLogo theme="light" /></Link>
      <span className={styles.owner}><ShieldCheck size={16} /> Owner dashboard</span>
      <Link href="/dashboard" className={styles.back}><ArrowLeft size={15} /> Student workspace</Link>
    </header>
    {checkingAccess ? <main className={styles.gate} aria-busy="true"><p>Checking your session…</p></main> : !allowed ?
      <main className={styles.gate}>
        <LockKeyhole size={30} /><h1>Owner access only</h1>
        <p>{user ? 'Your account does not have access to student or payment records.' : 'Sign in with your configured LabMate owner account to continue.'}</p>
        {!user && <button className={styles.primary} onClick={() => setLoginOpen(true)}>Sign in as owner</button>}
        <Link href="/dashboard">Return to LabMate</Link>
      </main> : <main className={styles.main}>
        <div className={styles.heading}>
          <div><h1>Platform overview</h1><p>Students, lab activity and credit-pack payments.</p></div>
          <button className={styles.refresh} disabled={loading} onClick={() => setRefresh(n => n + 1)}><RefreshCw size={15} className={loading ? styles.spinning : undefined} /> Refresh data</button>
        </div>
        <div className={styles.meta}>{overview ? <>Updated {date(overview.generated_at)} IST <span>·</span> {overview.owner_email}</> : 'Loading verified records…'}</div>
        {error && <div className={styles.error} role="alert">{error}</div>}
        {overview && <>
          <section className={styles.metrics} aria-label="Platform totals">
            <div><span>Registered students</span><strong>{number(overview.total_students)}</strong><small>{number(overview.enabled_students)} enabled accounts · owner excluded</small></div>
            <div><span>Active in 7 days</span><strong>{number(overview.active_students_7d)}</strong><small>Sign-in, upload or lab processing activity</small></div>
            <div><span>Paying students</span><strong>{number(overview.revenue.live.paying_students)}</strong><small>Verified live payments with retained funds</small></div>
            <div><span>Net revenue</span><strong>{money(overview.revenue.live.net_paise)}</strong><small>Live receipts after refunds, before gateway fees</small></div>
          </section>
          <section className={styles.activity} aria-label="Lab activity totals">
            <div><strong>{number(overview.uploads_total)}</strong><span>Manuals uploaded</span></div>
            <div><strong>{number(overview.completed_manuals)}</strong><span>Manuals completed</span></div>
            <div><strong>{number(overview.reports_total)}</strong><span>Reports created</span></div>
            <div><strong>{number(overview.running_manuals)}</strong><span>Queued or processing</span></div>
            <div><strong>{number(overview.failed_or_paused_manuals)}</strong><span>Failed or paused</span></div>
          </section>
          <section className={styles.revenue} aria-label="Revenue details">
            <div><span>Live gross receipts</span><strong>{money(overview.revenue.live.gross_paise)}</strong></div>
            <div><span>Live refunds</span><strong>{money(overview.revenue.live.refunds_paise)}</strong></div>
            <div><span>Captured live orders</span><strong>{number(overview.revenue.live.captured_orders)}</strong></div>
            <p><span className={styles.testBadge}>Test mode</span> {money(overview.revenue.test.net_paise)} simulated net receipts; excluded from revenue.</p>
          </section>
        </>}
        <section className={styles.records} aria-label="Student and payment records" aria-busy={loading}>
          <div className={styles.tabs} role="tablist" aria-label="Records">
            <button role="tab" aria-selected={tab === 'students'} aria-controls="owner-records" onClick={() => { setTab('students'); setPage(0) }}>Students {overview && <span>{number(overview.total_students)}</span>}</button>
            <button role="tab" aria-selected={tab === 'payments'} aria-controls="owner-records" onClick={() => { setTab('payments'); setPage(0) }}>Payments</button>
          </div>
          <div className={styles.tools}>
            {tab === 'students' ? <>
              <label className={styles.search}><Search size={16} /><input aria-label="Search students" placeholder="Search students by name or email" value={search} maxLength={120} onChange={e => setSearch(e.target.value)} /></label>
              <select aria-label="Student payment filter" value={filter} onChange={e => { setFilter(e.target.value); setPage(0) }}><option value="all">All students</option><option value="paid">Paid students · live</option><option value="unpaid">No retained live payment</option><option value="inactive">Disabled accounts</option></select>
            </> : <>
              <div><h2>Credit-pack purchases</h2><p>One-time payments. Pending orders are excluded from revenue.</p></div>
              <select aria-label="Payment mode" value={mode} onChange={e => { setMode(e.target.value as PaymentMode); setPage(0) }}><option value="live">Live payments</option><option value="test">Test payments · simulated</option></select>
            </>}
          </div>
          <div id="owner-records" role="tabpanel" tabIndex={0} className={styles.tableWrap}>
            {loading ? <p className={styles.empty} role="status">Loading records…</p> : error ? <p className={styles.empty}>Refresh to load records.</p> : total === 0 ? <div className={styles.empty}><h2>{tab === 'students' ? (query || filter !== 'all' ? 'No matching students' : 'No students yet') : `No ${mode} payments yet`}</h2><p>{tab === 'students' ? 'Registered student accounts will appear here.' : 'Recorded orders and verified payments will appear here.'}</p></div> : tab === 'students' ?
              <table><caption className={styles.srOnly}>Registered students and their platform usage</caption><thead><tr><th>Student</th><th>Last activity</th><th>Lab activity</th><th>Live payments</th><th>Credits · {overview?.billing_mode}</th><th>Account</th></tr></thead><tbody>
                {students?.users.map(student => <tr key={student.id}>
                  <td><strong>{student.name}</strong><span>{student.email}</span><small>{[student.institution, student.course].filter(Boolean).join(' · ') || 'Profile not completed'}</small><small>Joined {date(student.created_at)}</small></td>
                  <td>{date(student.last_activity)}<small>Last sign-in: {date(student.last_login)}</small></td>
                  <td><strong>{student.uploads_total} uploaded · {student.completed_manuals} completed</strong><small>{student.reports_total} reports · {student.failed_or_paused_manuals} failed or paused</small></td>
                  <td><span className={student.is_paying ? styles.paid : styles.neutral}>{student.is_paying ? 'Paid' : student.refunded_paise > 0 ? 'Fully refunded' : 'Free'}</span><strong>{money(student.net_paid_paise)}</strong><small>{student.paid_orders} captured orders · {money(student.refunded_paise)} refunded</small></td>
                  <td><strong>{student.credits[overview?.billing_mode || 'live'].balance} available</strong><small>{student.credits[overview?.billing_mode || 'live'].reserved} reserved</small></td>
                  <td><span className={student.is_active ? styles.enabled : styles.neutral}>{student.is_active ? 'Enabled' : 'Disabled'}</span></td>
                </tr>)}
              </tbody></table> :
              <table><caption className={styles.srOnly}>{mode === 'test' ? 'Simulated test' : 'Live'} credit-pack orders</caption><thead><tr><th>Student</th><th>Pack</th><th>Payment</th><th>Refund / net</th><th>Status</th><th>Reference</th></tr></thead><tbody>
                {payments?.payments.map(payment => <tr key={payment.id}>
                  <td><strong>{payment.name}</strong><span>{payment.email}</span></td>
                  <td><strong>{payment.pack_id.replace(/-/g, ' ')}</strong><small>{payment.credits} manual credits</small></td>
                  <td><strong>{money(payment.amount_paise, payment.currency)}</strong><small>{date(payment.fulfilled_at || payment.created_at)}</small></td>
                  <td><strong>{money(payment.net_paise, payment.currency)} net</strong><small>{money(payment.refunded_paise, payment.currency)} refunded</small></td>
                  <td><span className={payment.captured ? styles.paid : styles.neutral}>{payment.status.replace(/_/g, ' ')}</span>{payment.mode === 'test' && <small>Simulated payment</small>}</td>
                  <td className={styles.reference}>{payment.gateway_payment_id || 'Payment not captured'}<small>{payment.gateway_order_id || 'Order not created'}</small></td>
                </tr>)}
              </tbody></table>}
          </div>
          <footer className={styles.pagination}><span>{total ? `${page * 25 + 1}–${Math.min((page + 1) * 25, total)} of ${number(total)}` : '0 records'}</span><div><button aria-label="Previous page" disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)}><ArrowLeft size={16} /> Previous</button><button aria-label="Next page" disabled={(page + 1) * 25 >= total || loading} onClick={() => setPage(p => p + 1)}>Next <ArrowRight size={16} /></button></div></footer>
        </section>
        <p className={styles.footnote}>Student totals exclude your owner account. Financial totals use captured INR payment records and recorded refunds. Activity is recorded usage, not a live online-user count. All times are IST.</p>
      </main>}
    <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} redirectTo="/admin/dashboard" />
  </div>
}
