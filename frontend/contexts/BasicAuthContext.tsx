'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import api, { apiService, TokenResponse, BasicAuthUser } from '@/lib/api'

interface User {
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
  signup: (email: string, name: string, password: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
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
    // FastAPI/Pydantic validation errors: [{loc:..., msg:...}, ...]
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
    setAuthHeaders(null, null)
  }

  const checkProfileComplete = async (): Promise<boolean> => {
    try {
      const profile = await apiService.getUserProfile()
      const isComplete = profile?.is_complete || false
      setProfileComplete(isComplete)
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

  const handleAuthSuccess = async (response: TokenResponse) => {
    const userPayload = response?.user
    if (!userPayload) {
      throw new Error('Authentication succeeded but user data is missing in the response.')
    }

    const sanitizedUserData = sanitizeUser(userPayload)
    persistTokens(response)
    persistUser(sanitizedUserData)
    
    // Always redirect to dashboard - it will check profile and show onboarding if needed
    router.push('/dashboard')
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
          return
        }

        // Validate session with backend to ensure tokens are still valid
        const profile = await apiService.getUserProfile()
        setProfileComplete(profile?.is_complete || false)
        setUser(parsedUser)
      } catch (error) {
        console.error('Failed to validate stored session:', error)
        clearStoredSession()
        setUser(null)
        setProfileComplete(false)
      } finally {
        setLoading(false)
      }
    }

    initializeStoredSession()
  }, [])

  const signup = async (email: string, name: string, password: string) => {
    try {
      setLoading(true)
      const response = await apiService.signup(email, name, password)
      handleAuthSuccess(response)
    } catch (error: any) {
      // FIXED: Extract error message properly from axios error
      const errorMessage =
        formatApiErrorDetail(error?.response?.data?.detail) ||
        formatApiErrorDetail(error?.response?.data?.message) ||
        formatApiErrorDetail(error?.message) ||
        'Signup failed. Please check your information and try again.'
      console.error('Signup failed:', errorMessage, error)
      // Create a new error with the proper message
      const signupError = new Error(errorMessage)
      throw signupError
    } finally {
      setLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    try {
      setLoading(true)
      const response = await apiService.login(email, password)
      handleAuthSuccess(response)
    } catch (error: any) {
      // FIXED: Extract error message properly from axios error
      const errorMessage =
        formatApiErrorDetail(error?.response?.data?.detail) ||
        formatApiErrorDetail(error?.response?.data?.message) ||
        formatApiErrorDetail(error?.message) ||
        'Login failed. Please check your credentials and try again.'
      console.error('Login failed:', errorMessage, error)
      // Create a new error with the proper message
      const loginError = new Error(errorMessage)
      throw loginError
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      clearStoredSession()
      setUser(null)
      // Redirect to homepage
      router.push('/')
    } catch (error) {
      console.error('Signout failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCurrentUser = () => {
    return user
  }

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
