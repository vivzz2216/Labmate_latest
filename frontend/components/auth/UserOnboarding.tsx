'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import Stepper, { Step } from '@/components/ui/Stepper'
import { apiService } from '@/lib/api'

interface UserOnboardingProps {
  isOpen: boolean
  onComplete: () => void
  onSkip?: () => void
}

interface UserProfileData {
  name: string
  university: string
  department: string
  year: string
  graduation: string
}

export default function UserOnboarding({ isOpen, onComplete, onSkip }: UserOnboardingProps) {
  const [formData, setFormData] = useState<UserProfileData>({
    name: '',
    university: '',
    department: '',
    year: '',
    graduation: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleInputChange = (field: keyof UserProfileData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setError('')
  }

  const handleComplete = async () => {
    setLoading(true)
    setError('')

    try {
      // Update user profile via API
      await apiService.updateUserProfile({
        name: formData.name,
        institution: formData.university,
        course: formData.department,
        profile_metadata: {
          year: formData.year,
          graduation_year: formData.graduation
        }
      })

      onComplete()
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to save profile')
    } finally {
      setLoading(false)
    }
  }

  const handleSkip = () => {
    if (onSkip) {
      onSkip()
    } else {
      onComplete()
    }
  }

  // Scroll to top when modal opens
  useEffect(() => {
    if (isOpen) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [isOpen])

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-black border border-white/20 rounded-2xl p-6 md:p-8 max-w-2xl w-full my-auto shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-black pb-4 border-b border-white/10">
              <h2 className="text-2xl font-bold text-white">
                Complete Your Profile
              </h2>
              {onSkip && (
                <button
                  onClick={handleSkip}
                  className="text-white/60 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              )}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm mb-6">
                {error}
              </div>
            )}

            <div className="bg-black/50 rounded-xl p-4 md:p-6">
              <Stepper
                initialStep={1}
                onFinalStepCompleted={handleComplete}
                backButtonText="Previous"
                nextButtonText="Next"
                stepCircleContainerClassName="bg-black border-white/20"
                contentClassName="bg-black/50"
                footerClassName="bg-black/50"
                nextButtonProps={{
                  disabled: loading,
                  style: loading ? { opacity: 0.6, cursor: 'not-allowed' } : {}
                }}
              >
                <Step>
                  <div className="space-y-4">
                    <h2 className="text-2xl font-bold text-white mb-4">Welcome! Let's get started</h2>
                    <p className="text-white/80 mb-6">
                      We need a few details to personalize your experience and help with your assignments.
                    </p>
                    <div>
                      <label className="block text-white/90 mb-2 font-medium">Full Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        placeholder="Enter your full name"
                        className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:border-purple-500 transition-colors"
                        required
                      />
                    </div>
                  </div>
                </Step>

                <Step>
                  <div className="space-y-4">
                    <h2 className="text-2xl font-bold text-white mb-4">University Information</h2>
                    <p className="text-white/80 mb-6">
                      Tell us about your university.
                    </p>
                    <div>
                      <label className="block text-white/90 mb-2 font-medium">University Name</label>
                      <input
                        type="text"
                        value={formData.university}
                        onChange={(e) => handleInputChange('university', e.target.value)}
                        placeholder="Enter your university name"
                        className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:border-purple-500 transition-colors"
                        required
                      />
                    </div>
                  </div>
                </Step>

                <Step>
                  <div className="space-y-4">
                    <h2 className="text-2xl font-bold text-white mb-4">Department</h2>
                    <p className="text-white/80 mb-6">
                      What department are you studying in?
                    </p>
                    <div>
                      <label className="block text-white/90 mb-2 font-medium">Department/Course</label>
                      <input
                        type="text"
                        value={formData.department}
                        onChange={(e) => handleInputChange('department', e.target.value)}
                        placeholder="e.g., Computer Science, Electrical Engineering"
                        className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:border-purple-500 transition-colors"
                        required
                      />
                    </div>
                  </div>
                </Step>

                <Step>
                  <div className="space-y-4">
                    <h2 className="text-2xl font-bold text-white mb-4">Academic Year</h2>
                    <p className="text-white/80 mb-6">
                      What year are you currently in?
                    </p>
                    <div>
                      <label className="block text-white/90 mb-2 font-medium">Current Year</label>
                      <select
                        value={formData.year}
                        onChange={(e) => handleInputChange('year', e.target.value)}
                        className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-lg text-white focus:outline-none focus:border-purple-500 transition-colors"
                        required
                      >
                        <option value="">Select your year</option>
                        <option value="1st Year">1st Year</option>
                        <option value="2nd Year">2nd Year</option>
                        <option value="3rd Year">3rd Year</option>
                        <option value="4th Year">4th Year</option>
                        <option value="Graduate">Graduate</option>
                      </select>
                    </div>
                  </div>
                </Step>

                <Step>
                  <div className="space-y-4">
                    <h2 className="text-2xl font-bold text-white mb-4">Graduation Year</h2>
                    <p className="text-white/80 mb-6">
                      When do you expect to graduate?
                    </p>
                    <div>
                      <label className="block text-white/90 mb-2 font-medium">Expected Graduation Year</label>
                      <input
                        type="text"
                        value={formData.graduation}
                        onChange={(e) => handleInputChange('graduation', e.target.value)}
                        placeholder="e.g., 2025, 2026"
                        className="w-full px-4 py-3 bg-black/50 border border-white/20 rounded-lg text-white placeholder-white/60 focus:outline-none focus:border-purple-500 transition-colors"
                        required
                      />
                    </div>
                  </div>
                </Step>
              </Stepper>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

