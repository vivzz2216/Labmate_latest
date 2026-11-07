'use client'

import {useEffect, useRef, useState, type FormEvent} from 'react'
import {ArrowLeft, ArrowRight, Check, Loader2} from 'lucide-react'
import LabMateLogo from '@/components/brand/LabMateLogo'
import {useAuth} from '@/contexts/BasicAuthContext'
import {apiService} from '@/lib/api'
import styles from './onboarding.module.css'

interface Props {isOpen: boolean; onComplete: () => void | Promise<void>}
const steps = ['Your details', 'College', 'Department', 'Academic year', 'Graduation']
const empty = {name: '', roll: '', institution: '', course: '', year: '', graduation: ''}

export default function UserOnboarding({isOpen, onComplete}: Props) {
  const {user} = useAuth()
  const [form, setForm] = useState(empty)
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const dialog = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    let active = true
    setFetching(true)
    setError('')
    apiService.getUserProfile({force: true}).then(data => {
      if (!active) return
      const profile = data.profile || data
      const meta = profile.profile_metadata || profile.metadata || {}
      setForm({name: profile.name || user?.name || '', roll: meta.roll_number || meta.usn || meta.roll_no || '',
        institution: profile.institution || '', course: profile.course || '', year: meta.year || '', graduation: String(meta.graduation_year || '')})
      setFetching(false)
    }).catch(() => {if (active) setError('Your saved profile could not load. Please retry.')})
    return () => {active = false}
  }, [isOpen, user?.id, retry])

  useEffect(() => {
    if (!isOpen) return
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape') event.preventDefault()
      if (event.key !== 'Tab') return
      const elements = dialog.current?.querySelectorAll<HTMLElement>('input:not(:disabled),select:not(:disabled),button:not(:disabled)')
      if (!elements?.length) return
      const first = elements[0], last = elements[elements.length - 1]
      if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) {event.preventDefault(); last.focus()}
      else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) {event.preventDefault(); first.focus()}
    }
    document.addEventListener('keydown', trap)
    return () => {document.body.style.overflow = overflow; document.removeEventListener('keydown', trap); previous?.focus()}
  }, [isOpen])

  useEffect(() => {if (!fetching) dialog.current?.querySelector<HTMLElement>('input,select')?.focus()}, [step, fetching])
  if (!isOpen) return null
  const change = (key: keyof typeof empty, value: string) => {setForm(current => ({...current, [key]: value})); setError('')}
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving || fetching) return
    const fields: (keyof typeof empty)[][] = [['name', 'roll'], ['institution'], ['course'], ['year'], ['graduation']]
    if (fields[step].some(key => !form[key].trim())) {setError('Please complete every field before continuing.'); return}
    if (step < 4) {setStep(step + 1); return}
    if (!/^(20\d{2}|2100)$/.test(form.graduation.trim())) {setError('Enter a graduation year between 2000 and 2100.'); return}
    setSaving(true)
    setError('')
    try {
      await apiService.updateUserProfile({name: form.name.trim(), institution: form.institution.trim(), course: form.course.trim(),
        profile_metadata: {roll_number: form.roll.trim(), usn: form.roll.trim(), year: form.year.trim(), graduation_year: form.graduation.trim()}})
      await onComplete()
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : err?.message || 'Your profile could not be saved. Please retry.')
    } finally {setSaving(false)}
  }
  const field = (key: keyof typeof empty, label: string, placeholder: string, maxLength: number) => (
    <label className={styles.field} htmlFor={`profile-${key}`}>
      <span>{label}</span>
      <input id={`profile-${key}`} name={key} value={form[key]} onChange={e => change(key, e.target.value)} placeholder={placeholder}
        required maxLength={maxLength} disabled={saving || fetching} autoComplete={key === 'name' ? 'name' : 'off'}
        inputMode={key === 'graduation' ? 'numeric' : 'text'} />
    </label>
  )
  return (
    <div className={styles.backdrop}>
      <div ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="profile-title" aria-describedby="profile-description">
        <header className={styles.brand}><LabMateLogo theme="dark" size="md" /><span>STUDENT PROFILE</span></header>
        <div className={styles.body}>
          <p className={styles.eyebrow}>Required before your first lab</p>
          <h1 id="profile-title">Your details.<br /><span>Your lab record.</span></h1>
          <p id="profile-description" className={styles.intro}>Complete your profile once. We use these details to personalize your code, screenshots, and lab reports.</p>
          <ol className={styles.progress} aria-label="Profile setup progress">
            {steps.map((label, index) => <li key={label} className={index === step ? styles.current : index < step ? styles.done : ''} aria-current={index === step ? 'step' : undefined}>
              <span>{index < step ? <Check size={14} aria-hidden="true" /> : index + 1}</span><small>{label}</small>
            </li>)}
          </ol>
          <form onSubmit={submit}>
            <div className={styles.stepTitle}><h2>{steps[step]}</h2><span>Step {step + 1} of 5</span></div>
            {step === 0 && <>{field('name', 'Full name', 'Your name as it should appear in your record', 200)}{field('roll', 'Roll number / USN', 'Your college roll number or USN', 80)}</>}
            {step === 1 && field('institution', 'College / university name', 'Your college or university', 300)}
            {step === 2 && field('course', 'Department / course', 'e.g. Computer Science and Engineering', 200)}
            {step === 3 && <label className={styles.field} htmlFor="profile-year"><span>Current academic year</span><select id="profile-year" value={form.year} onChange={e => change('year', e.target.value)} required disabled={saving || fetching}>
              <option value="">Select your year</option>{['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', 'Graduate'].map(year => <option key={year}>{year}</option>)}
              {form.year && !['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', 'Graduate'].includes(form.year) && <option>{form.year}</option>}
            </select></label>}
            {step === 4 && field('graduation', 'Graduation year', 'e.g. 2027', 4)}
            {error && <div className={styles.error} role="alert">{error}{fetching && <button type="button" onClick={() => setRetry(v => v + 1)}>Retry loading</button>}</div>}
            <footer className={styles.actions}>
              <button type="button" className={styles.back} disabled={step === 0 || saving || fetching} onClick={() => {setStep(step - 1); setError('')}}><ArrowLeft size={16} /> Previous</button>
              <button type="submit" className={styles.next} disabled={saving || fetching}>{saving || fetching ? <><Loader2 size={16} className={styles.spinner} />{saving ? 'Saving profile…' : 'Loading profile…'}</> : <>{step === 4 ? 'Save & continue to labs' : 'Continue'}<ArrowRight size={16} /></>}</button>
            </footer>
            <p className={styles.note}>All fields are required. You can edit your details later in your student profile.</p>
          </form>
        </div>
      </div>
    </div>
  )
}
