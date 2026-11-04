'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api, { apiService, TokenResponse, BasicAuthUser } from '@/lib/api'

interface User {
  is_admin?: boolean
  id: number
  email: string
  name: string
  profile_picture?: string
  created_at: string
  last_login: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  profileComplete: boolean
  signup: (email: string, name: string, password: string, redirectTo?: string) => Promise<void>
  login: (email: string, password: string, redirectTo?: string) => Promise<void>
  signOut: () => Promise<void>
  getCurrentUser: () => User | null
  checkProfileComplete: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const USER_STORAGE_KEY = 'labmate_user'
const ACCESS_TOKEN_KEY = 'labmate_access_token'
const REFRESH_TOKEN_KEY = 'labmate_refresh_token'
const CSRF_TOKEN_KEY = 'labmate_csrf_token'

const sanitizeUser = (userData: BasicAuthUser): User => ({
  is_admin: userData.is_admin === true,
  id: userData.id,
  email: userData.email,
  name: (userData.name || '').replace(/[<>]/g, ''),
  profile_picture: userData.profile_picture,
  created_at: userData.created_at,
  last_login: userData.last_login,
})

const setAuthHeaders = (accessToken?: string | null, csrfToken?: string | null) => {
  if (accessToken) {
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
  } else {
    delete api.defaults.headers.common['Authorization']
  }

  if (csrfToken) {
    api.defaults.headers.common['X-CSRF-Token'] = csrfToken
  } else {
    delete api.defaults.headers.common['X-CSRF-Token']
  }
}

const formatApiErrorDetail = (detail: any): string => {
  if (!detail) return ''
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) => (typeof d?.msg === 'string' ? d.msg : null))
      .filter(Boolean) as string[]
    if (msgs.length) return msgs.join('\n')
    try {
      return JSON.stringify(detail)
    } catch {
      return String(detail)
    }
  }
  if (typeof detail === 'object') {
    if (typeof (detail as any).message === 'string') return (detail as any).message
    try {
      return JSON.stringify(detail)
    } catch {
      return String(detail)
    }
  }
  return String(detail)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileComplete, setProfileComplete] = useState(true)
  const router = useRouter()

  const persistTokens = (tokens: TokenResponse) => {
    if (typeof window === 'undefined') return

    const { access_token, refresh_token, csrf_token } = tokens

    if (access_token) {
      localStorage.setItem(ACCESS_TOKEN_KEY, access_token)
    } else {
      localStorage.removeItem(ACCESS_TOKEN_KEY)
    }

    if (refresh_token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token)
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY)
    }

    if (csrf_token) {
      localStorage.setItem(CSRF_TOKEN_KEY, csrf_token)
    } else {
      localStorage.removeItem(CSRF_TOKEN_KEY)
    }

    setAuthHeaders(access_token, csrf_token)
  }

  const loadStoredTokens = () => {
    if (typeof window === 'undefined') {
      return { accessToken: null, refreshToken: null, csrfToken: null }
    }

    const storedAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY)
    const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    const storedCsrfToken = localStorage.getItem(CSRF_TOKEN_KEY)
    setAuthHeaders(storedAccessToken, storedCsrfToken)

    return {
      accessToken: storedAccessToken,
      refreshToken: storedRefreshToken,
      csrfToken: storedCsrfToken,
    }
  }

  const persistUser = (userData: User) => {
    if (typeof window === 'undefined') return
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData))
    setUser(userData)
  }

  const clearStoredSession = () => {
    if (typeof window === 'undefined') return
    localStorage.removeItem(USER_STORAGE_KEY)
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(CSRF_TOKEN_KEY)
    apiService.invalidateAssignmentsCache()
    apiService.invalidateProfileCache()
    apiService.clearSessionCaches()
    setAuthHeaders(null, null)
  }

  const checkProfileComplete = async (): Promise<boolean> => {
    try {
      const profile = await apiService.getUserProfile()
      const isComplete = profile?.is_complete || false
      setProfileComplete(isComplete)
      if (typeof profile?.is_admin === 'boolean') {
        setUser((prev) => {
          if (!prev || (prev.is_admin === profile.is_admin && (!profile.name || prev.name === profile.name))) return prev
          const updated = { ...prev, name: profile.name || prev.name, is_admin: profile.is_admin === true }
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated))
          return updated
        })
      }
      return isComplete
    } catch (error) {
      console.error('Failed to check profile:', error)
      const status = (error as any)?.response?.status
      if (status === 401) {
        clearStoredSession()
        setUser(null)
      }
      return false
    }
  }

  const handleAuthSuccess = async (response: TokenResponse, redirectTo = '/dashboard') => {
    const userPayload = response?.user
    if (!userPayload) {
      throw new Error('Authentication succeeded but user data is missing in the response.')
    }

    const sanitizedUserData = sanitizeUser(userPayload)
    apiService.clearSessionCaches()
    persistTokens(response)
    persistUser(sanitizedUserData)

    // Homepage actions can send the user directly to the upload studio after sign-in.
    const destination = redirectTo === '/code-execution' || (redirectTo === '/admin/dashboard' && response.user.is_admin === true) || /^\/checkout\?pack=(quick-lab|lab-pack|semester-pack)$/.test(redirectTo || '') ? redirectTo! : '/dashboard'
    router.push(destination)
  }

  useEffect(() => {
    const initializeStoredSession = async () => {
      try {
        const tokens = loadStoredTokens()
        const storedUser = typeof window !== 'undefined'
          ? localStorage.getItem(USER_STORAGE_KEY)
          : null

        if (
          !tokens.accessToken ||
          !tokens.refreshToken ||
          !tokens.csrfToken ||
          !storedUser
        ) {
          clearStoredSession()
          setUser(null)
          setProfileComplete(false)
          setLoading(false)
          return
        }

        const parsedUser = JSON.parse(storedUser)
        const isValidStructure =
          parsedUser &&
          typeof parsedUser === 'object' &&
          parsedUser.id &&
          parsedUser.email &&
          parsedUser.name

        if (!isValidStructure) {
          console.warn('Invalid user data structure, clearing storage')
          clearStoredSession()
          setUser(null)
          setProfileComplete(false)
          setLoading(false)
          return
        }

        // Optimistically hydrate user immediately so UI renders in 0ms without blocking on network
        setUser(parsedUser)
        setLoading(false)

        // Validate session with backend in background and sync server-derived is_admin / profileComplete
        try {
          const profile = await apiService.getUserProfile({ force: true })
          setProfileComplete(profile?.is_complete || false)
          const verifiedUser = { ...parsedUser, is_admin: profile?.is_admin === true }
          setUser(verifiedUser)
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(verifiedUser))
        } catch (profileError: any) {
          const status = profileError?.response?.status
          if (status !== 401 && status !== 403) {
            return
          }
          clearStoredSession()
          setUser(null)
          setProfileComplete(false)
        }
      } catch {
        clearStoredSession()
        setUser(null)
        setProfileComplete(false)
        setLoading(false)
      }
    }

    initializeStoredSession()
  }, [])

  const signup = async (email: string, name: string, password: string, redirectTo?: string) => {
    try {
      setLoading(true)
      const response = await apiService.signup(email, name, password)
      await handleAuthSuccess(response, redirectTo)
    } catch (error: any) {
      const errorMessage =
        formatApiErrorDetail(error?.response?.data?.detail) ||
        formatApiErrorDetail(error?.response?.data?.message) ||
        formatApiErrorDetail(error?.message) ||
        'Signup failed. Please check your information and try again.'
      console.error('Signup failed:', errorMessage, error)
      const signupError = new Error(errorMessage)
      throw signupError
    } finally {
      setLoading(false)
    }
  }

  const login = async (email: string, password: string, redirectTo?: string) => {
    try {
      setLoading(true)
      const response = await apiService.login(email, password)
      await handleAuthSuccess(response, redirectTo)
    } catch (error: any) {
      const errorMessage =
        formatApiErrorDetail(error?.response?.data?.detail) ||
        formatApiErrorDetail(error?.response?.data?.message) ||
        formatApiErrorDetail(error?.message) ||
        'Login failed. Please check your credentials and try again.'
      console.error('Login failed:', errorMessage, error)
      const loginError = new Error(errorMessage)
      throw loginError
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      await apiService.logout()
    } catch (error) {
      console.error('Server signout could not be confirmed:', error)
    } finally {
      clearStoredSession()
      setUser(null)
      router.push('/')
      setLoading(false)
    }
  }

  const getCurrentUser = () => {
    return user
  }

  useEffect(() => {
    const syncAccount = (event: StorageEvent) => {
      if (event.key !== USER_STORAGE_KEY) return
      try {
        const previous = event.oldValue ? JSON.parse(event.oldValue) : null
        const next = event.newValue ? JSON.parse(event.newValue) : null
        if (!next || next.id !== previous?.id) {
          apiService.clearSessionCaches()
          setProfileComplete(false)
        } else apiService.invalidateProfileCache()
        if (next && Number.isSafeInteger(next.id) && typeof next.email === 'string') {
          setAuthHeaders(localStorage.getItem(ACCESS_TOKEN_KEY), localStorage.getItem(CSRF_TOKEN_KEY))
          setUser(sanitizeUser(next))
        } else {
          setAuthHeaders(null, null)
          setUser(null)
          setProfileComplete(false)
        }
      } catch {
        apiService.clearSessionCaches()
        setAuthHeaders(null, null)
        setUser(null)
        setProfileComplete(false)
      }
    }
    window.addEventListener('storage', syncAccount)
    return () => window.removeEventListener('storage', syncAccount)
  }, [])

  const value = {
    user,
    loading,
    profileComplete,
    signup,
    login,
    signOut,
    getCurrentUser,
    checkProfileComplete
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
