'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Mail, Lock, User, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/contexts/BasicAuthContext'
import { isValidEmail, validatePasswordStrength } from '@/lib/sanitize'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  
  const { login, signup } = useAuth()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!isMounted) return
    if (isOpen) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          onClose()
        }
      }
      document.addEventListener('keydown', handleKeyDown)

      return () => {
        document.body.style.overflow = originalOverflow
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [isMounted, isOpen, onClose])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isLogin) {
        await login(email, password)
      } else {
        // Client-side validation to avoid 422 spam (backend enforces strong password rules)
        if (!isValidEmail(email)) {
          setError('Please enter a valid email address')
          return
        }
        const { isValid, errors } = validatePasswordStrength(password)
        if (!isValid) {
          setError(errors.join('\n'))
          return
        }
        await signup(email, name, password)
      }
      onClose()
    } catch (err: any) {
      // Ensure we always render a string (FastAPI validation errors can be an array/object)
      const detail = err?.response?.data?.detail
      const msg =
        (typeof detail === 'string' && detail) ||
        (Array.isArray(detail) ? detail.map((d) => d?.msg).filter(Boolean).join('\n') : '') ||
        err?.message ||
        'Authentication failed'
      setError(String(msg))
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    setIsLogin(!isLogin)
    setError('')
    setEmail('')
    setName('')
    setPassword('')
  }

  if (!isMounted) {
    return null
  }

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-black border border-white/20 rounded-2xl p-8 max-w-md w-full shadow-2xl relative z-10"
            >
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold text-white">
                {isLogin ? 'Welcome Back' : 'Create Account'}
              </h2>
              <button
                onClick={onClose}
                className="text-white/60 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-black/50 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:border-purple-500 transition-colors"
                    required={!isLogin}
                  />
                </div>
              )}

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 w-5 h-5" />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-black/50 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:border-purple-500 transition-colors"
                    required
                    autoFocus
                  />
                </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 w-5 h-5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 bg-black/50 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:border-purple-500 transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm whitespace-pre-line">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white px-6 py-4 rounded-full font-semibold transition-all duration-300 flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-[1.02] disabled:hover:scale-100"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  isLogin ? 'Sign In' : 'Create Account'
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={switchMode}
                className="text-white/70 hover:text-white transition-colors text-sm font-medium"
              >
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <span className="text-purple-400 hover:text-purple-300 underline">
                  {isLogin ? "Sign up" : "Sign in"}
                </span>
              </button>
            </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  )

  return createPortal(modalContent, document.body)
}
